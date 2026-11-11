import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container container--narrow">
      <div className="panel stack empty" style={{ marginTop: "var(--space-6)" }}>
        <span className="badge badge--warning">404</span>
        <h1 className="page-title" style={{ margin: 0 }}>
          Страница не найдена
        </h1>
        <p className="muted" style={{ margin: 0, maxWidth: "48ch" }}>
          Возможно, организатор удалил комнату или голосование, либо в ссылке опечатка.
        </p>
        <div className="row">
          <Link className="btn" href="/rooms">
            Мои комнаты
          </Link>
          <Link className="btn btn--secondary" href="/join">
            Войти по коду
          </Link>
        </div>
      </div>
    </main>
  );
}
