import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  loadRoom,
  type IdentifiedBallot,
  type Poll,
  type PollOption,
  type PollResultRow,
  type PollStats,
} from "@/lib/room";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { LiveResults } from "@/components/LiveResults";
import { PollWatcher } from "@/components/PollWatcher";
import { castVoteAction, deletePollAction, setPollStatusAction } from "@/app/actions/polls";
import { POLL_STATUS_LABEL, formatDate, initials, plural, pollStatusClass } from "@/lib/format";

export default async function PollPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string; pollId: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { code, pollId } = await params;
  const query = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/auth/login?next=${encodeURIComponent(`/r/${code}/p/${pollId}`)}`);

  const access = await loadRoom(supabase, code);
  if (access.status === "not_found") notFound();

  if (access.status === "full") {
    return (
      <main className="container container--narrow">
        <div className="alert alert--warning" role="alert">
          <svg className="icon">
            <use href="#i-warn" />
          </svg>
          <div>
            <p className="alert__title">В комнате нет свободных мест</p>
            <p className="alert__text">Попросите организатора увеличить лимит участников.</p>
          </div>
        </div>
        <Link className="btn btn--secondary" href="/rooms" style={{ marginTop: "var(--space-4)" }}>
          Мои комнаты
        </Link>
      </main>
    );
  }

  const { room, isAdmin } = access;

  const { data: pollData } = await supabase
    .from("polls")
    .select(
      "id, room_id, title, description, mode, multi_select, max_choices, status, allow_change, created_at, closed_at",
    )
    .eq("id", pollId)
    .eq("room_id", room.id)
    .maybeSingle<Poll>();

  if (!pollData) notFound();
  const poll = pollData;

  const [{ data: optionsData }, { data: myVotesData }, { data: statsData }] = await Promise.all([
    supabase
      .from("poll_options")
      .select("id, poll_id, label, sort_order")
      .eq("poll_id", poll.id)
      .order("sort_order", { ascending: true }),
    supabase.from("votes").select("option_id").eq("poll_id", poll.id).eq("user_id", user.id),
    supabase.from("poll_stats").select("poll_id, votes_count, voters_count, updated_at").eq("poll_id", poll.id).maybeSingle<PollStats>(),
  ]);

  const options = (optionsData ?? []) as PollOption[];
  const myOptions = new Set((myVotesData ?? []).map((row) => (row as { option_id: string }).option_id));
  const hasVoted = myOptions.size > 0;
  const stats = statsData ?? null;

  const { data: resultsData, error: resultsError } = await supabase.rpc("poll_results", {
    p_poll_id: poll.id,
  });
  const results = resultsError ? null : ((resultsData ?? []) as PollResultRow[]);

  let ballots: IdentifiedBallot[] = [];
  if (isAdmin && poll.mode === "identified") {
    const { data: ballotsData } = await supabase.rpc("identified_ballots", { p_poll_id: poll.id });
    ballots = (ballotsData ?? []) as IdentifiedBallot[];
  }

  const ballotRows = new Map<
    string,
    { name: string; avatar: string | null; options: string[]; createdAt: string }
  >();
  for (const ballot of ballots) {
    const current = ballotRows.get(ballot.user_id) ?? {
      name: ballot.full_name ?? "Участник",
      avatar: ballot.avatar_url,
      options: [],
      createdAt: ballot.created_at,
    };
    current.options.push(ballot.option_label);
    ballotRows.set(ballot.user_id, current);
  }

  const canVote = poll.status === "open" && (!hasVoted || poll.allow_change);
  const showResults = results !== null;

  return (
    <main className="container">
      <Link className="btn btn--ghost btn--sm" href={`/r/${room.code}`}>
        <svg className="icon">
          <use href="#i-arrow-left" />
        </svg>
        {room.title}
      </Link>

      <div className="page-head" style={{ marginTop: "var(--space-3)" }}>
        <div>
          <div className="row" style={{ gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
            <span className={pollStatusClass(poll.status)}>{POLL_STATUS_LABEL[poll.status]}</span>
            <span className="badge">{poll.mode === "anonymous" ? "Анонимно" : "С именами"}</span>
            <span className="badge">{poll.multi_select ? "Несколько вариантов" : "Один вариант"}</span>
            {hasVoted ? <span className="badge badge--success">Вы голосовали</span> : null}
          </div>

          <h1 className="page-title">{poll.title}</h1>
          {poll.description ? <p className="page-sub">{poll.description}</p> : null}
        </div>

        {isAdmin ? (
          <div className="row">
            <Link className="btn btn--secondary" href={`/r/${room.code}/p/${poll.id}/edit`}>
              <svg className="icon">
                <use href="#i-edit" />
              </svg>
              Редактировать
            </Link>
          </div>
        ) : null}
      </div>

      <Flash error={query.error} ok={query.ok} />

      <PollWatcher pollId={poll.id} />

      <div className="room-layout" style={{ marginTop: "var(--space-4)" }}>
        <div className="stack stack--lg">
          {poll.status === "draft" ? (
            <div className="alert alert--warning" role="alert">
              <svg className="icon">
                <use href="#i-lock" />
              </svg>
              <div>
                <p className="alert__title">Черновик</p>
                <p className="alert__text">
                  Участники не видят это голосование. Проверьте формулировки и откройте его кнопкой справа.
                </p>
              </div>
            </div>
          ) : null}

          {poll.status === "closed" ? (
            <div className="alert" role="status">
              <svg className="icon">
                <use href="#i-check" />
              </svg>
              <div>
                <p className="alert__title">Голосование закрыто</p>
                <p className="alert__text">
                  Итоги окончательные и доступны всем участникам комнаты
                  {poll.closed_at ? ` · ${formatDate(poll.closed_at)}` : ""}.
                </p>
              </div>
            </div>
          ) : null}

          {canVote ? (
            <section className="panel stack">
              <div className="stack stack--sm">
                <h2 className="section__title">{hasVoted ? "Ваш голос" : "Ваш ответ"}</h2>
                <p className="small muted" style={{ margin: 0 }}>
                  {poll.multi_select
                    ? poll.max_choices
                      ? `Можно выбрать до ${poll.max_choices} ${plural(poll.max_choices, ["варианта", "вариантов", "вариантов"])}.`
                      : "Можно выбрать несколько вариантов."
                    : "Выберите один вариант."}
                </p>
              </div>

              {poll.mode === "identified" ? (
                <div className="banner-note">
                  <svg className="icon">
                    <use href="#i-eye" />
                  </svg>
                  <span>
                    Это голосование с именами: организаторы комнаты увидят, что вы выбрали. Ваши ответы не видны
                    другим участникам.
                  </span>
                </div>
              ) : (
                <div className="banner-note">
                  <svg className="icon">
                    <use href="#i-lock" />
                  </svg>
                  <span>
                    Голосование анонимное: организаторы видят только счётчики голосов и не могут узнать, кто как
                    проголосовал.
                  </span>
                </div>
              )}

              <form action={castVoteAction} className="stack">
                <input type="hidden" name="poll_id" value={poll.id} />
                <input type="hidden" name="code" value={room.code} />

                <div className="vote-list">
                  {options.map((option) => (
                    <label className="vote-option" key={option.id}>
                      <input
                        type={poll.multi_select ? "checkbox" : "radio"}
                        name="option"
                        value={option.id}
                        required={!poll.multi_select}
                        defaultChecked={myOptions.has(option.id)}
                      />
                      <span className="vote-option__label">{option.label}</span>
                    </label>
                  ))}
                </div>

                {options.length === 0 ? (
                  <p className="small muted" style={{ margin: 0 }}>
                    У голосования ещё нет вариантов.
                  </p>
                ) : null}

                <div className="row">
                  <SubmitButton className="btn" pendingText="Отправляем">
                    {hasVoted ? "Сохранить голос" : "Проголосовать"}
                  </SubmitButton>
                  {hasVoted ? (
                    <span className="xs faint">Можно менять, пока голосование не закрыли.</span>
                  ) : null}
                </div>
              </form>
            </section>
          ) : poll.status === "open" && hasVoted ? (
            <div className="banner-note">
              <svg className="icon">
                <use href="#i-check" />
              </svg>
              <span>Ваш голос учтён. Изменить его уже нельзя — голосование закрыто для правок.</span>
            </div>
          ) : null}

          {showResults && results ? (
            <section className="panel stack">
              <div className="section__head" style={{ marginBottom: 0 }}>
                <h2 className="section__title">
                  {poll.status === "closed" ? "Итоги голосования" : hasVoted || isAdmin ? "Результаты" : "Результаты"}
                </h2>
                {poll.status === "open" && isAdmin ? (
                  <span className="live-dot">обновляются в реальном времени</span>
                ) : null}
              </div>

              <LiveResults pollId={poll.id} initialRows={results} live={poll.status === "open" && isAdmin} />

              {poll.status === "open" && isAdmin ? (
                <p className="xs faint" style={{ margin: 0 }}>
                  Участники увидят эти результаты после закрытия голосования. Голоса можно менять до закрытия.
                </p>
              ) : null}
            </section>
          ) : poll.status !== "draft" ? (
            <section className="panel stack">
              <h2 className="section__title">Результаты</h2>
              <div className="banner-note">
                <svg className="icon">
                  <use href="#i-lock" />
                </svg>
                <span>
                  Результаты скрыты, пока голосование идёт. Как только организатор его закроет, итоги появятся на
                  этой странице автоматически.
                </span>
              </div>
            </section>
          ) : null}
        </div>

        <aside className="stack">
          {isAdmin ? (
            <div className="panel stack stack--md">
              <h2 className="feature__title">Управление</h2>

              <div className="stack stack--sm">
                <span className="stat__label">Проголосовали</span>
                <span className="stat__value">
                  {stats?.voters_count ?? 0}
                  {stats ? <span className="xs faint"> · {stats.votes_count} голосов</span> : null}
                </span>
              </div>

              <div className="stack stack--sm">
                {poll.status !== "open" ? (
                  <form action={setPollStatusAction}>
                    <input type="hidden" name="poll_id" value={poll.id} />
                    <input type="hidden" name="code" value={room.code} />
                    <input type="hidden" name="status" value="open" />
                    <SubmitButton className="btn btn--block" pendingText="Открываем">
                      <svg className="icon">
                        <use href="#i-play" />
                      </svg>
                      {poll.status === "closed" ? "Открыть заново" : "Открыть голосование"}
                    </SubmitButton>
                  </form>
                ) : (
                  <form action={setPollStatusAction}>
                    <input type="hidden" name="poll_id" value={poll.id} />
                    <input type="hidden" name="code" value={room.code} />
                    <input type="hidden" name="status" value="closed" />
                    <SubmitButton className="btn btn--danger btn--block" pendingText="Закрываем">
                      <svg className="icon">
                        <use href="#i-stop" />
                      </svg>
                      Закрыть и опубликовать итоги
                    </SubmitButton>
                  </form>
                )}

                <Link className="btn btn--secondary btn--block" href={`/r/${room.code}/p/${poll.id}/edit`}>
                  Изменить вопрос и варианты
                </Link>

                <form action={deletePollAction}>
                  <input type="hidden" name="poll_id" value={poll.id} />
                  <input type="hidden" name="code" value={room.code} />
                  <ConfirmSubmit
                    className="btn btn--ghost btn--block"
                    message="Удалить голосование вместе со всеми голосами? Это действие нельзя отменить."
                    pendingText="Удаляем"
                  >
                    <svg className="icon">
                      <use href="#i-trash" />
                    </svg>
                    Удалить голосование
                  </ConfirmSubmit>
                </form>
              </div>
            </div>
          ) : (
            <div className="panel stack stack--sm">
              <h2 className="feature__title">Как это работает</h2>
              <p className="xs muted" style={{ margin: 0 }}>
                Голос засчитывается сразу. Итоги откроются, когда организатор закроет голосование — страница
                обновится сама.
              </p>
            </div>
          )}

          {isAdmin && poll.mode === "identified" ? (
            <div className="panel stack stack--sm">
              <h2 className="feature__title">Кто как голосовал</h2>
              {ballotRows.size === 0 ? (
                <p className="xs muted" style={{ margin: 0 }}>
                  Пока нет голосов.
                </p>
              ) : (
                <div className="stack stack--sm">
                  {[...ballotRows.entries()].map(([userId, row]) => (
                    <div key={userId} className="row" style={{ gap: "var(--space-2)", alignItems: "flex-start" }}>
                      {row.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className="avatar" src={row.avatar} alt="" referrerPolicy="no-referrer" />
                      ) : (
                        <span
                          className="avatar"
                          aria-hidden="true"
                          style={{
                            display: "grid",
                            placeItems: "center",
                            fontSize: "var(--fs-xs)",
                            fontWeight: "var(--fw-semibold)",
                          }}
                        >
                          {initials(row.name)}
                        </span>
                      )}
                      <span className="stack" style={{ gap: 0 }}>
                        <span className="small">{row.name}</span>
                        <span className="xs muted">{row.options.join(", ")}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <p className="xs faint" style={{ margin: 0 }}>
                Видно только организаторам. Участники предупреждены об этом до голосования.
              </p>
            </div>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
