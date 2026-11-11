import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { initials } from "@/lib/format";
import { ThemeToggle } from "./ThemeToggle";

export async function SiteHeader() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: { full_name: string | null; avatar_url: string | null } | null = null;

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle<{ full_name: string | null; avatar_url: string | null }>();
    profile = data;
  }

  const name = profile?.full_name ?? user?.email ?? "Профиль";

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link href={user ? "/rooms" : "/"} className="brand">
          <span className="brand__mark" aria-hidden="true">
            Q
          </span>
          Qvea
        </Link>

        <div className="row" style={{ gap: "var(--space-2)" }}>
          <ThemeToggle />

          {user ? (
            <>
              <Link href="/join" className="btn btn--ghost btn--sm" title="Войти в комнату по коду">
                <svg className="icon">
                  <use href="#i-qr" />
                </svg>
                <span className="hide-sm">По коду</span>
              </Link>

              <div className="userbox">
                {profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="avatar" src={profile.avatar_url} alt="" referrerPolicy="no-referrer" />
                ) : (
                  <span className="avatar" aria-hidden="true" />
                )}
                <span className="userbox__meta">
                  <span className="userbox__name">{name}</span>
                  <small>{user.email}</small>
                </span>
              </div>

              <a className="btn btn--secondary btn--icon btn--sm" href="/auth/logout" title="Выйти">
                <svg className="icon">
                  <use href="#i-logout" />
                </svg>
              </a>
            </>
          ) : (
            <a className="btn btn--sm" href="/auth/login">
              Войти
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
