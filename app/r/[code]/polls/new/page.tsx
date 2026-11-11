import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { loadRoom } from "@/lib/room";
import { Flash } from "@/components/Flash";
import { PollForm } from "@/components/PollForm";
import { createPollAction } from "@/app/actions/polls";

export default async function NewPollPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { code } = await params;
  const query = await searchParams;

  const supabase = await createClient();
  const user = await getCurrentUser();

  if (!user) redirect(`/auth/login?next=${encodeURIComponent(`/r/${code}/polls/new`)}`);

  const access = await loadRoom(supabase, code, user.id);
  if (access.status !== "ok") redirect("/rooms");
  if (!access.isAdmin) redirect(`/r/${access.room.code}?error=NOT_AN_ADMIN`);

  return (
    <main className="container container--narrow">
      <Link className="btn btn--ghost btn--sm" href={`/r/${access.room.code}`}>
        <svg className="icon">
          <use href="#i-arrow-left" />
        </svg>
        {access.room.title}
      </Link>

      <div className="page-head" style={{ marginTop: "var(--space-3)" }}>
        <div>
          <h1 className="page-title">Новое голосование</h1>
          <p className="page-sub">
            Одно голосование — одна тема. Участники увидят его в комнате и смогут проголосовать без нового кода.
          </p>
        </div>
      </div>

      <Flash error={query.error} />

      <div className="panel" style={{ marginTop: "var(--space-4)" }}>
        <PollForm
          action={createPollAction}
          submitLabel="Создать голосование"
          withStatus
          hiddenFields={{ room_id: access.room.id, code: access.room.code }}
        />
      </div>
    </main>
  );
}
