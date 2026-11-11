import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { Flash } from "@/components/Flash";
import { AvatarForm } from "@/components/AvatarForm";
import { initials } from "@/lib/format";

export const metadata: Metadata = {
  title: "Профиль — Qvea",
};

interface ProfileRow {
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const params = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect(`/auth/login?next=${encodeURIComponent("/profile")}`);

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("full_name, email, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const profile = (data ?? null) as ProfileRow | null;
  const name = profile?.full_name ?? user.name ?? "Без имени";
  const email = profile?.email ?? user.email;
  const avatarUrl = profile?.avatar_url ?? user.avatarUrl;
  const isGoogleAvatar = Boolean(avatarUrl && avatarUrl.includes("googleusercontent.com"));

  return (
    <main className="container container--narrow">
      <div className="page-head">
        <div>
          <h1 className="page-title">Профиль</h1>
          <p className="page-sub">Так вас видят участники комнат: имя и аватар.</p>
        </div>
      </div>

      <Flash error={params.error} ok={params.ok} />

      <section className="grid grid--2" style={{ marginTop: "var(--space-4)" }}>
        <div className="panel stack">
          <div className="profile-id">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="avatar avatar--xl"
                src={avatarUrl}
                alt={`Аватар ${name}`}
                referrerPolicy="no-referrer"
                decoding="async"
              />
            ) : (
              <span className="avatar avatar--xl avatar--initials" aria-hidden="true">
                {initials(name)}
              </span>
            )}

            <div className="stack--sm" style={{ display: "grid", gap: "var(--space-1)", minWidth: 0 }}>
              <h2 className="section__title" style={{ margin: 0 }}>
                {name}
              </h2>
              {email ? <p className="small muted" style={{ margin: 0, wordBreak: "break-word" }}>{email}</p> : null}
              {avatarUrl ? (
                <span className={isGoogleAvatar ? "badge" : "badge badge--primary"}>
                  {isGoogleAvatar ? "Аватар из Google" : "Свой аватар"}
                </span>
              ) : null}
            </div>
          </div>

          <div className="banner-note">
            <svg className="icon" aria-hidden="true">
              <use href="#i-info" />
            </svg>
            <span>
              Имя и почта приходят из Google-аккаунта — поменять их можно в настройках самого Google. Аватар меняется
              здесь и виден всем, с кем вы в одной комнате.
            </span>
          </div>

          <div className="menu">
            <Link className="btn btn--secondary btn--sm" href="/rooms?role=staff">
              <svg className="icon">
                <use href="#i-users" />
              </svg>
              Мои комнаты
            </Link>
            <Link className="btn btn--ghost btn--sm" href="/history">
              <svg className="icon">
                <use href="#i-history" />
              </svg>
              История голосований
            </Link>
          </div>
        </div>

        <div className="panel">
          <AvatarForm />
        </div>
      </section>
    </main>
  );
}
