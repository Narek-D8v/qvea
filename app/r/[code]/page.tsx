import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadRoom, type Poll, type PollStats } from "@/lib/room";
import { Flash } from "@/components/Flash";
import { CopyButton } from "@/components/CopyButton";
import { QrCode } from "@/components/QrCode";
import { SubmitButton } from "@/components/SubmitButton";
import { leaveRoomAction } from "@/app/actions/rooms";
import { getSiteUrl } from "@/lib/site";
import { POLL_STATUS_LABEL, plural, pollStatusClass } from "@/lib/format";

export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { code } = await params;
  const query = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/auth/login?next=${encodeURIComponent(`/r/${code}`)}`);

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
            <p className="alert__text">
              Организатор ограничил число участников. Попросите его увеличить лимит или исключить того, кто уже
              вышел из класса.
            </p>
          </div>
        </div>
        <Link className="btn btn--secondary" href="/rooms" style={{ marginTop: "var(--space-4)" }}>
          <svg className="icon">
            <use href="#i-arrow-left" />
          </svg>
          Мои комнаты
        </Link>
      </main>
    );
  }

  const { room, role, isAdmin } = access;

  const [{ data: pollsData }, { data: membersData }] = await Promise.all([
    supabase
      .from("polls")
      .select("id, room_id, title, description, mode, multi_select, max_choices, status, allow_change, created_at, closed_at")
      .eq("room_id", room.id)
      .order("created_at", { ascending: false }),
    supabase.from("room_members").select("user_id, role").eq("room_id", room.id),
  ]);

  const polls = (pollsData ?? []) as Poll[];
  const pollIds = polls.map((poll) => poll.id);
  const members = (membersData ?? []) as { user_id: string; role: string }[];
  const voterCount = members.filter((member) => member.role === "voter").length;

  const optionCounts = new Map<string, number>();
  const votedPolls = new Set<string>();
  const stats = new Map<string, PollStats>();

  if (pollIds.length > 0) {
    const [{ data: optionsData }, { data: votesData }, { data: statsData }] = await Promise.all([
      supabase.from("poll_options").select("poll_id").in("poll_id", pollIds),
      supabase.from("votes").select("poll_id").eq("user_id", user.id).in("poll_id", pollIds),
      supabase.from("poll_stats").select("poll_id, votes_count, voters_count, updated_at").in("poll_id", pollIds),
    ]);

    for (const option of (optionsData ?? []) as { poll_id: string }[]) {
      optionCounts.set(option.poll_id, (optionCounts.get(option.poll_id) ?? 0) + 1);
    }
    for (const vote of (votesData ?? []) as { poll_id: string }[]) {
      votedPolls.add(vote.poll_id);
    }
    for (const item of (statsData ?? []) as PollStats[]) {
      stats.set(item.poll_id, item);
    }
  }

  const order: Record<string, number> = { open: 0, draft: 1, closed: 2 };
  const sortedPolls = [...polls].sort(
    (a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3) || b.created_at.localeCompare(a.created_at),
  );

  const shareUrl = `${await getSiteUrl()}/r/${room.code}`;
  const roleLabel = role === "owner" ? "Создатель комнаты" : role === "admin" ? "Организатор" : "Участник";

  return (
    <main className="container">
      <Link className="btn btn--ghost btn--sm" href="/rooms">
        <svg className="icon">
          <use href="#i-arrow-left" />
        </svg>
        Все комнаты
      </Link>

      <div className="page-head" style={{ marginTop: "var(--space-3)" }}>
        <div>
          <div className="row" style={{ gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
            <span className="badge badge--primary">{roleLabel}</span>
            {room.max_participants ? (
              <span className="badge">
                {voterCount} из {room.max_participants} участников
              </span>
            ) : (
              <span className="badge">
                {voterCount} {plural(voterCount, ["участник", "участника", "участников"])}
              </span>
            )}
          </div>

          <h1 className="page-title">{room.title}</h1>
          {room.description ? <p className="page-sub">{room.description}</p> : null}
        </div>

        <div className="row">
          {isAdmin ? (
            <>
              <Link className="btn btn--secondary" href={`/r/${room.code}/settings`}>
                <svg className="icon">
                  <use href="#i-settings" />
                </svg>
                Настройки
              </Link>
              <Link className="btn" href={`/r/${room.code}/polls/new`}>
                <svg className="icon">
                  <use href="#i-plus" />
                </svg>
                Новое голосование
              </Link>
            </>
          ) : null}
        </div>
      </div>

      <Flash error={query.error} ok={query.ok} />

      <div className="room-layout" style={{ marginTop: "var(--space-4)" }}>
        <section>
          <div className="section__head">
            <h2 className="section__title">Голосования</h2>
            {isAdmin ? <span className="xs faint">Черновики видите только вы</span> : null}
          </div>

          {sortedPolls.length === 0 ? (
            <div className="panel empty">
              <svg className="icon" style={{ width: 28, height: 28 }}>
                <use href="#i-vote" />
              </svg>
              <p style={{ margin: 0 }}>
                {isAdmin
                  ? "Голосований пока нет. Создайте первое — участники увидят его сразу после открытия."
                  : "Организатор ещё не открыл ни одного голосования."}
              </p>
              {isAdmin ? (
                <Link className="btn" href={`/r/${room.code}/polls/new`}>
                  Создать голосование
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="grid grid--polls">
              {sortedPolls.map((poll) => {
                const count = optionCounts.get(poll.id) ?? 0;
                const pollStats = stats.get(poll.id);

                return (
                  <Link key={poll.id} href={`/r/${room.code}/p/${poll.id}`} className="card card--interactive">
                    <div className="card__body">
                      <div className="row" style={{ gap: "var(--space-2)" }}>
                        <span className={pollStatusClass(poll.status)}>{POLL_STATUS_LABEL[poll.status]}</span>
                        <span className="badge">{poll.mode === "anonymous" ? "Анонимно" : "С именами"}</span>
                        {votedPolls.has(poll.id) && poll.status !== "draft" ? (
                          <span className="badge badge--success">Вы голосовали</span>
                        ) : null}
                      </div>

                      <h3 className="card__title">{poll.title}</h3>
                      {poll.description ? <p className="card__text">{poll.description}</p> : null}

                      <p className="xs faint" style={{ margin: 0 }}>
                        {count} {plural(count, ["вариант", "варианта", "вариантов"])} ·{" "}
                        {poll.multi_select
                          ? poll.max_choices
                            ? `до ${poll.max_choices} вариантов`
                            : "несколько вариантов"
                          : "один вариант"}
                        {isAdmin && pollStats ? ` · проголосовали ${pollStats.voters_count}` : ""}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {!isAdmin ? (
            <form action={leaveRoomAction} style={{ marginTop: "var(--space-6)" }}>
              <input type="hidden" name="room_id" value={room.id} />
              <input type="hidden" name="code" value={room.code} />
              <SubmitButton className="btn btn--ghost btn--sm" pendingText="Выходим">
                Покинуть комнату
              </SubmitButton>
            </form>
          ) : null}
        </section>

        <aside className="stack">
          <div className="panel stack stack--md">
            <h2 className="feature__title">Поделиться комнатой</h2>
            <p className="xs muted" style={{ margin: 0 }}>
              Покажите QR-код или продиктуйте код. Один вход — и участнику доступны все голосования комнаты.
            </p>

            <QrCode value={shareUrl} />

            <div className="row" style={{ gap: "var(--space-2)" }}>
              <span className="code-chip code-chip--lg">{room.code}</span>
              <CopyButton value={room.code} label="Код" copiedLabel="Готово" className="btn btn--secondary btn--sm" />
            </div>

            <code className="input-code">{shareUrl}</code>
            <CopyButton value={shareUrl} label="Копировать ссылку" copiedLabel="Ссылка скопирована" className="btn btn--secondary btn--sm" />
          </div>

          <div className="panel stack stack--sm">
            <h2 className="feature__title">Памятка</h2>
            <p className="xs muted" style={{ margin: 0 }}>
              {isAdmin
                ? "Результаты видны вам во время голосования и всем — после закрытия. Голоса можно менять до закрытия."
                : "Пока голосование идёт, результаты скрыты. После закрытия итоги увидят все участники комнаты."}
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
