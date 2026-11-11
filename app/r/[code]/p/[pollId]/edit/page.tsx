import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { loadRoom, type Poll, type PollOption, type PollStats } from "@/lib/room";
import { Flash } from "@/components/Flash";
import { PollForm } from "@/components/PollForm";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { deletePollAction, updatePollAction } from "@/app/actions/polls";

export default async function EditPollPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string; pollId: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { code, pollId } = await params;
  const query = await searchParams;

  const supabase = await createClient();
  const user = await getCurrentUser();

  if (!user) redirect(`/auth/login?next=${encodeURIComponent(`/r/${code}/p/${pollId}/edit`)}`);

  const access = await loadRoom(supabase, code, user.id);
  if (access.status !== "ok") redirect("/rooms");
  if (!access.isAdmin) redirect(`/r/${access.room.code}?error=NOT_AN_ADMIN`);

  const { room } = access;

  const { data: poll } = await supabase
    .from("polls")
    .select(
      "id, room_id, title, description, mode, multi_select, max_choices, status, allow_change, created_at, closed_at",
    )
    .eq("id", pollId)
    .eq("room_id", room.id)
    .maybeSingle<Poll>();

  if (!poll) notFound();

  const [{ data: optionsData }, { data: statsData }] = await Promise.all([
    supabase
      .from("poll_options")
      .select("id, poll_id, label, sort_order")
      .eq("poll_id", poll.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("poll_stats")
      .select("poll_id, votes_count, voters_count, updated_at")
      .eq("poll_id", poll.id)
      .maybeSingle<PollStats>(),
  ]);

  const options = (optionsData ?? []) as PollOption[];
  const stats = statsData ?? null;
  const locked = (stats?.votes_count ?? 0) > 0;

  return (
    <main className="container container--narrow">
      <Link className="btn btn--ghost btn--sm" href={`/r/${room.code}/p/${poll.id}`}>
        <svg className="icon">
          <use href="#i-arrow-left" />
        </svg>
        К голосованию
      </Link>

      <div className="page-head" style={{ marginTop: "var(--space-3)" }}>
        <div>
          <h1 className="page-title">Редактирование</h1>
          <p className="page-sub">
            {locked
              ? "Голоса уже есть: можно править формулировки и добавлять варианты, но не удалять проголосованные и не менять режим."
              : "Пока голосов нет, можно менять всё — в том числе анонимность и правила выбора."}
          </p>
        </div>
      </div>

      <Flash error={query.error} ok={query.ok} />

      <div className="panel" style={{ marginTop: "var(--space-4)" }}>
        <PollForm
          action={updatePollAction}
          submitLabel="Сохранить изменения"
          locked={locked}
          hiddenFields={{ poll_id: poll.id, code: room.code }}
          initial={{
            title: poll.title,
            description: poll.description ?? "",
            mode: poll.mode,
            multiSelect: poll.multi_select,
            maxChoices: poll.max_choices ? String(poll.max_choices) : "",
            options: options.map((option) => ({ id: option.id, label: option.label })),
          }}
        />
      </div>

      <div className="panel stack" style={{ marginTop: "var(--space-4)" }}>
        <h2 className="section__title">Удаление</h2>
        <p className="small muted" style={{ margin: 0 }}>
          Голосование и все голоса по нему удалятся без возможности восстановления.
        </p>
        <form action={deletePollAction}>
          <input type="hidden" name="poll_id" value={poll.id} />
          <input type="hidden" name="code" value={room.code} />
          <ConfirmSubmit
            className="btn btn--danger"
            message="Удалить голосование вместе со всеми голосами?"
            pendingText="Удаляем"
          >
            <svg className="icon">
              <use href="#i-trash" />
            </svg>
            Удалить голосование
          </ConfirmSubmit>
        </form>
      </div>
    </main>
  );
}
