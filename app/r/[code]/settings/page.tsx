import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { loadRoom, type ProfilePublic, type RoomRole } from "@/lib/room";
import { Flash } from "@/components/Flash";
import { CopyButton } from "@/components/CopyButton";
import { QrCode } from "@/components/QrCode";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import {
  addAdminAction,
  deleteRoomAction,
  removeMemberAction,
  updateRoomAction,
} from "@/app/actions/rooms";
import { getSiteUrl } from "@/lib/site";
import { initials, plural } from "@/lib/format";

interface MemberRow {
  user_id: string;
  role: RoomRole;
  joined_at: string;
}

export default async function RoomSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { code } = await params;
  const query = await searchParams;

  const supabase = await createClient();
  const user = await getCurrentUser();

  if (!user) redirect(`/auth/login?next=${encodeURIComponent(`/r/${code}/settings`)}`);

  const access = await loadRoom(supabase, code, user.id);
  if (access.status !== "ok") redirect("/rooms");
  if (!access.isAdmin) redirect(`/r/${access.room.code}?error=NOT_AN_ADMIN`);

  const { room, role } = access;

  const { data: membersData } = await supabase
    .from("room_members")
    .select("user_id, role, joined_at")
    .eq("room_id", room.id)
    .order("joined_at", { ascending: true });

  const members = (membersData ?? []) as MemberRow[];
  const ids = members.map((member) => member.user_id);

  let profiles = new Map<string, ProfilePublic>();
  if (ids.length > 0) {
    const { data: profilesData } = await supabase
      .from("profiles_public")
      .select("id, full_name, avatar_url")
      .in("id", ids);

    profiles = new Map(((profilesData ?? []) as ProfilePublic[]).map((profile) => [profile.id, profile]));
  }

  const admins = members.filter((member) => member.role !== "voter");
  const voters = members.filter((member) => member.role === "voter");
  const shareUrl = `${await getSiteUrl()}/r/${room.code}`;

  function nameOf(member: MemberRow) {
    return profiles.get(member.user_id)?.full_name ?? "Участник";
  }

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
          <h1 className="page-title">Настройки комнаты</h1>
          <p className="page-sub">
            Название, лимит участников и состав организаторов. Здесь же — QR-код и ссылка для входа.
          </p>
        </div>
      </div>

      <Flash error={query.error} ok={query.ok} />

      <div className="grid grid--2" style={{ marginTop: "var(--space-4)" }}>
        <form action={updateRoomAction} className="panel stack">
          <h2 className="section__title">Комната</h2>

          <input type="hidden" name="room_id" value={room.id} />
          <input type="hidden" name="code" value={room.code} />

          <div className="field" style={{ maxWidth: "none" }}>
            <label className="field__label" htmlFor="settings-title">
              Название
            </label>
            <input
              className="input"
              id="settings-title"
              name="title"
              required
              maxLength={120}
              defaultValue={room.title}
            />
          </div>

          <div className="field" style={{ maxWidth: "none" }}>
            <label className="field__label" htmlFor="settings-description">
              Описание
            </label>
            <textarea
              className="input"
              id="settings-description"
              name="description"
              maxLength={500}
              defaultValue={room.description ?? ""}
            />
          </div>

          <div className="field" style={{ maxWidth: 240 }}>
            <label className="field__label" htmlFor="settings-limit">
              Максимум участников
            </label>
            <input
              className="input"
              id="settings-limit"
              name="max_participants"
              type="number"
              min={1}
              max={10000}
              defaultValue={room.max_participants ?? ""}
              placeholder="Без ограничения"
            />
            <span className="field__hint">
              Сейчас в комнате {voters.length} {plural(voters.length, ["участник", "участника", "участников"])}.
              Организаторы в лимит не входят.
            </span>
          </div>

          <SubmitButton className="btn" pendingText="Сохраняем">
            Сохранить
          </SubmitButton>
        </form>

        <div className="panel stack stack--md">
          <h2 className="section__title">Вход в комнату</h2>
          <p className="xs muted" style={{ margin: 0 }}>
            QR-код и ссылка ведут прямо в комнату. Участнику останется войти через Google — и он увидит все
            голосования.
          </p>

          <QrCode value={shareUrl} />

          <div className="row" style={{ gap: "var(--space-2)" }}>
            <span className="code-chip code-chip--lg">{room.code}</span>
            <CopyButton value={room.code} label="Код" copiedLabel="Готово" className="btn btn--secondary btn--sm" />
          </div>

          <code className="input-code">{shareUrl}</code>
          <CopyButton value={shareUrl} label="Копировать ссылку" copiedLabel="Ссылка скопирована" className="btn btn--secondary btn--sm" />

          <p className="xs faint" style={{ margin: 0 }}>
            Совет: распечатайте QR-код или покажите его на проекторе.
          </p>
        </div>
      </div>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Организаторы</h2>
          <span className="xs faint">Могут всё, кроме удаления комнаты</span>
        </div>

        <div className="panel stack stack--md">
          <div className="stack stack--sm">
            {admins.map((member) => (
              <div className="row row--between" key={member.user_id} style={{ gap: "var(--space-3)" }}>
                <div className="row" style={{ gap: "var(--space-3)", minWidth: 0 }}>
                  {profiles.get(member.user_id)?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className="avatar"
                      src={profiles.get(member.user_id)?.avatar_url ?? ""}
                      alt=""
                      referrerPolicy="no-referrer"
                    />
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
                      {initials(nameOf(member))}
                    </span>
                  )}

                  <span className="stack" style={{ gap: 0, minWidth: 0 }}>
                    <span className="small">
                      {nameOf(member)}
                      {member.user_id === user.id ? <span className="faint"> · это вы</span> : null}
                    </span>
                    <span className="xs muted">
                      {member.role === "owner" ? "Создатель комнаты" : "Организатор"}
                    </span>
                  </span>
                </div>

                {member.role !== "owner" ? (
                  <form action={removeMemberAction}>
                    <input type="hidden" name="room_id" value={room.id} />
                    <input type="hidden" name="code" value={room.code} />
                    <input type="hidden" name="user_id" value={member.user_id} />
                    <ConfirmSubmit
                      className="btn btn--ghost btn--sm"
                      message={`Исключить ${nameOf(member)} из комнаты? Права организатора будут сняты.`}
                      pendingText="Исключаем"
                    >
                      Исключить
                    </ConfirmSubmit>
                  </form>
                ) : (
                  <span className="badge badge--primary">Создатель</span>
                )}
              </div>
            ))}
          </div>

          <hr className="divider" style={{ margin: 0 }} />

          <form action={addAdminAction} className="stack stack--sm">
            <input type="hidden" name="room_id" value={room.id} />
            <input type="hidden" name="code" value={room.code} />

            <div className="field" style={{ maxWidth: "none" }}>
              <label className="field__label" htmlFor="admin-email">
                Добавить организатора по почте Google
              </label>
              <div className="row" style={{ gap: "var(--space-2)" }}>
                <input
                  className="input grow"
                  id="admin-email"
                  name="email"
                  type="email"
                  required
                  placeholder="colleague@example.com"
                  autoComplete="off"
                />
                <SubmitButton className="btn btn--secondary" pendingText="Добавляем">
                  Добавить
                </SubmitButton>
              </div>
              <span className="field__hint">
                Человек должен хотя бы раз войти на сайт через Google. Он получит права организатора и доступ ко
                всем голосованиям комнаты.
              </span>
            </div>
          </form>
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Участники</h2>
          <span className="xs faint">
            {voters.length} {plural(voters.length, ["человек", "человека", "человек"])}
          </span>
        </div>

        <div className="panel">
          {voters.length === 0 ? (
            <p className="small muted" style={{ margin: 0 }}>
              Пока никто не присоединился. Поделитесь кодом или QR-кодом комнаты.
            </p>
          ) : (
            <div className="stack stack--sm">
              {voters.map((member) => (
                <div className="row row--between" key={member.user_id} style={{ gap: "var(--space-3)" }}>
                  <div className="row" style={{ gap: "var(--space-3)", minWidth: 0 }}>
                    {profiles.get(member.user_id)?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className="avatar"
                        src={profiles.get(member.user_id)?.avatar_url ?? ""}
                        alt=""
                        referrerPolicy="no-referrer"
                      />
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
                        {initials(nameOf(member))}
                      </span>
                    )}
                    <span className="small">
                      {nameOf(member)}
                      {member.user_id === user.id ? <span className="faint"> · это вы</span> : null}
                    </span>
                  </div>

                  <form action={removeMemberAction}>
                    <input type="hidden" name="room_id" value={room.id} />
                    <input type="hidden" name="code" value={room.code} />
                    <input type="hidden" name="user_id" value={member.user_id} />
                    <ConfirmSubmit
                      className="btn btn--ghost btn--sm"
                      message={`Исключить ${nameOf(member)} из комнаты?`}
                      pendingText="Исключаем"
                    >
                      Исключить
                    </ConfirmSubmit>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {role === "owner" ? (
        <section className="section">
          <div className="section__head">
            <h2 className="section__title">Удаление комнаты</h2>
          </div>

          <div className="panel stack">
            <p className="small muted" style={{ margin: 0 }}>
              Удалятся все голосования, варианты и голоса. Доступна только создателю комнаты.
            </p>
            <form action={deleteRoomAction}>
              <input type="hidden" name="room_id" value={room.id} />
              <input type="hidden" name="code" value={room.code} />
              <ConfirmSubmit
                className="btn btn--danger"
                message={`Удалить комнату «${room.title}» со всеми голосованиями?`}
                pendingText="Удаляем"
              >
                <svg className="icon">
                  <use href="#i-trash" />
                </svg>
                Удалить комнату
              </ConfirmSubmit>
            </form>
          </div>
        </section>
      ) : null}

    </main>
  );
}
