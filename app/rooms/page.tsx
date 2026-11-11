import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { createRoomAction, joinRoomAction } from "@/app/actions/rooms";
import type { Room, RoomRole } from "@/lib/room";
import { plural } from "@/lib/format";

interface MembershipRow {
  role: RoomRole;
  joined_at: string;
  rooms: Room | null;
}

export default async function RoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/auth/login?next=${encodeURIComponent("/rooms")}`);

  const { data } = await supabase
    .from("room_members")
    .select("role, joined_at, rooms(id, code, title, description, max_participants, owner_id, created_at)")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false });

  const memberships = (data ?? []) as unknown as MembershipRow[];
  const rooms = memberships.filter((row) => row.rooms).map((row) => ({ ...row, rooms: row.rooms as Room }));
  const roomIds = rooms.map((row) => row.rooms.id);

  const openPolls = new Map<string, number>();
  const memberCounts = new Map<string, number>();

  if (roomIds.length > 0) {
    const [{ data: polls }, { data: members }] = await Promise.all([
      supabase.from("polls").select("room_id, status").in("room_id", roomIds).eq("status", "open"),
      supabase.from("room_members").select("room_id").in("room_id", roomIds),
    ]);

    for (const poll of (polls ?? []) as { room_id: string }[]) {
      openPolls.set(poll.room_id, (openPolls.get(poll.room_id) ?? 0) + 1);
    }

    for (const member of (members ?? []) as { room_id: string }[]) {
      memberCounts.set(member.room_id, (memberCounts.get(member.room_id) ?? 0) + 1);
    }
  }

  return (
    <main className="container">
      <div className="page-head">
        <div>
          <h1 className="page-title">Ваши комнаты</h1>
          <p className="page-sub">
            Комната — это общий код для класса или группы. Внутри комнаты может быть сколько угодно голосований.
          </p>
        </div>
        <Link className="btn btn--secondary" href="/join">
          <svg className="icon">
            <use href="#i-qr" />
          </svg>
          Войти по коду
        </Link>
      </div>

      <Flash error={params.error} ok={params.ok} />

      <section className="section" style={{ marginTop: "var(--space-4)" }}>
        {rooms.length === 0 ? (
          <div className="panel empty">
            <svg className="icon" style={{ width: 28, height: 28 }}>
              <use href="#i-vote" />
            </svg>
            <p style={{ margin: 0 }}>Пока нет ни одной комнаты. Создайте свою или войдите по коду организатора.</p>
          </div>
        ) : (
          <div className="grid grid--polls">
            {rooms.map(({ rooms: room, role }) => {
              const count = memberCounts.get(room.id) ?? 0;
              const open = openPolls.get(room.id) ?? 0;

              return (
                <Link key={room.id} href={`/r/${room.code}`} className="card card--interactive">
                  <div className="card__body">
                    <div className="row" style={{ gap: "var(--space-2)" }}>
                      {role === "owner" ? (
                        <span className="badge badge--primary">Создатель</span>
                      ) : role === "admin" ? (
                        <span className="badge badge--primary">Организатор</span>
                      ) : (
                        <span className="badge">Участник</span>
                      )}
                      {open > 0 ? (
                        <span className="badge badge--success">
                          {open} {plural(open, ["голосование", "голосования", "голосований"])}
                        </span>
                      ) : null}
                    </div>

                    <h2 className="card__title">{room.title}</h2>
                    {room.description ? <p className="card__text">{room.description}</p> : null}

                    <div className="row" style={{ gap: "var(--space-2)", marginTop: "var(--space-1)" }}>
                      <span className="code-chip" aria-label={`Код комнаты ${room.code}`}>
                        {room.code}
                      </span>
                      <span className="xs faint">
                        {count} {plural(count, ["участник", "участника", "участников"])}
                        {room.max_participants ? ` из ${room.max_participants}` : ""}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="section">
        <div className="grid grid--2">
          <form action={createRoomAction} className="panel stack">
            <div>
              <h2 className="section__title">Создать комнату</h2>
              <p className="small muted" style={{ margin: "var(--space-1) 0 0" }}>
                Вы станете её создателем и сможете добавлять других организаторов.
              </p>
            </div>

            <div className="field" style={{ maxWidth: "none" }}>
              <label className="field__label" htmlFor="room-title">
                Название
              </label>
              <input
                className="input"
                id="room-title"
                name="title"
                required
                maxLength={120}
                placeholder="Например: Русский язык, 8 «Б»"
              />
            </div>

            <div className="field" style={{ maxWidth: "none" }}>
              <label className="field__label" htmlFor="room-description">
                Описание <span className="faint">— необязательно</span>
              </label>
              <textarea
                className="input"
                id="room-description"
                name="description"
                maxLength={500}
                placeholder="Для чего эта комната"
              />
            </div>

            <div className="field" style={{ maxWidth: 220 }}>
              <label className="field__label" htmlFor="room-limit">
                Максимум участников
              </label>
              <input
                className="input"
                id="room-limit"
                name="max_participants"
                type="number"
                min={1}
                max={10000}
                placeholder="Без ограничения"
              />
              <span className="field__hint">Пусто — без ограничения. Организаторы не считаются.</span>
            </div>

            <SubmitButton className="btn" pendingText="Создаём">
              <svg className="icon">
                <use href="#i-plus" />
              </svg>
              Создать комнату
            </SubmitButton>
          </form>

          <form action={joinRoomAction} className="panel stack">
            <div>
              <h2 className="section__title">Войти по коду</h2>
              <p className="small muted" style={{ margin: "var(--space-1) 0 0" }}>
                Код из шести символов — его показывает организатор или QR-код на экране.
              </p>
            </div>

            <div className="field" style={{ maxWidth: "none" }}>
              <label className="field__label" htmlFor="join-code">
                Код комнаты
              </label>
              <input
                className="input mono"
                id="join-code"
                name="code"
                required
                autoComplete="off"
                spellCheck={false}
                maxLength={12}
                placeholder="K7M2Q9"
                style={{ letterSpacing: ".18em", textTransform: "uppercase" }}
              />
            </div>

            <input type="hidden" name="back" value="/rooms" />

            <SubmitButton className="btn btn--secondary" pendingText="Входим">
              Войти
            </SubmitButton>
          </form>
        </div>
      </section>
    </main>
  );
}
