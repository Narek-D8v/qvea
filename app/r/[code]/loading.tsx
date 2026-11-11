/**
 * Пока сервер собирает комнату, пользователь сразу видит отклик на клик,
 * а не застывшую прошлую страницу.
 */
export default function RoomLoading() {
  return (
    <main className="container">
      <div className="panel stack" aria-busy="true" aria-live="polite">
        <div className="row" style={{ gap: "var(--space-3)" }}>
          <span className="badge">Загружаем</span>
          <span className="small muted">Готовим комнату…</span>
        </div>
        <div className="skeleton skeleton--title" />
        <div className="skeleton skeleton--line" />
        <div className="skeleton skeleton--line" style={{ width: "60%" }} />
      </div>
    </main>
  );
}
