import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { ThemeToggle } from "./ThemeToggle";
import { AccountMenu } from "./AccountMenu";

export async function SiteHeader() {
  // Имя и аватар уже есть в JWT от Google — отдельный запрос к profiles не нужен.
  const user = await getCurrentUser();
  const name = user?.name ?? user?.email ?? "Профиль";

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

              <AccountMenu name={name} email={user.email} avatarUrl={user.avatarUrl} />
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
