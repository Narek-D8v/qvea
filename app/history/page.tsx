import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, plural, POLL_STATUS_LABEL, pollStatusClass } from "@/lib/format";

export const metadata: Metadata = {
  title: "История голосований — Qvea",
};

interface VoteRow {
  poll_id: string;
  created_at: string;
  polls: {
    id: string;
    title: string;
    status: "draft" | "open" | "closed";
    rooms: { code: string; title: string } | null;
  } | null;
}

interface HistoryItem {
  pollId: string;
  title: string;
  status: "draft" | "open" | "closed";
  votedAt: string;
  room: { code: string; title: string } | null;
}

export default async function HistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect(`/auth/login?next=${encodeURIComponent("/history")}`);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("votes")
    .select("poll_id, created_at, polls(id, title, status, rooms(code, title))")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(300);

  // В голосовании с несколькими вариантами на один опрос приходится несколько
  // строк — оставляем по одному пункту истории на голосование.
  const seen = new Set<string>();
  const items: HistoryItem[] = [];

  for (const row of ((data ?? []) as unknown as VoteRow[])) {
    if (!row.polls || seen.has(row.poll_id)) continue;
    seen.add(row.poll_id);
    items.push({
      pollId: row.polls.id,
      title: row.polls.title,
      status: row.polls.status,
      votedAt: row.created_at,
      room: row.polls.rooms,
    });
  }

  return (
    <main className="container">
      <div className="page-head">
        <div>
          <h1 className="page-title">История голосований</h1>
          <p className="page-sub">
            Все голосования, в которых вы голосовали. Свои голоса видите только вы, организатор — только в режиме с
            именами.
          </p>
        </div>
        <Link className="btn btn--secondary" href="/rooms?role=staff">
          <svg className="icon">
            <use href="#i-users" />
          </svg>
          Мои комнаты
        </Link>
      </div>

      {error ? (
        <div className="alert alert--danger" role="alert">
          <svg className="icon">
            <use href="#i-error" />
          </svg>
          <div>
            <p className="alert__title">Не получилось загрузить историю</p>
            <p className="alert__text">Обновите страницу через минуту.</p>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="panel empty">
          <svg className="icon" style={{ width: 28, height: 28 }}>
            <use href="#i-history" />
          </svg>
          <p style={{ margin: 0 }}>
            Пока пусто. Зайдите в комнату по коду и проголосуйте — голосования появятся здесь.
          </p>
          <Link className="btn btn--secondary btn--sm" href="/join">
            Войти по коду
          </Link>
        </div>
      ) : (
        <section className="stack--md" style={{ display: "grid", gap: "var(--space-3)" }}>
          {items.map((item) => (
            <Link
              key={item.pollId}
              href={item.room ? `/r/${item.room.code}/p/${item.pollId}` : "/rooms"}
              className="card card--interactive"
            >
              <div className="card__body">
                <div className="row" style={{ gap: "var(--space-2)" }}>
                  <span className={pollStatusClass(item.status)}>{POLL_STATUS_LABEL[item.status]}</span>
                  {item.room ? <span className="small faint">{item.room.title}</span> : null}
                </div>
                <h2 className="card__title">{item.title}</h2>
                <p className="card__text" style={{ marginBottom: 0 }}>
                  Ваш голос учтён · {formatDate(item.votedAt)}
                  {item.room ? (
                    <>
                      {" · "}
                      <span className="code-chip">{item.room.code}</span>
                    </>
                  ) : null}
                </p>
              </div>
            </Link>
          ))}
        </section>
      )}

      {items.length > 0 ? (
        <p className="small faint" style={{ marginTop: "var(--space-4)" }}>
          {items.length} {plural(items.length, ["голосование", "голосования", "голосований"])} в истории.
        </p>
      ) : null}
    </main>
  );
}
