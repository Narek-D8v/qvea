"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    setTheme(current === "dark" ? "dark" : "light");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("ds-theme", next);
    } catch {
      // Приватный режим браузера — тема просто не запомнится.
    }
    setTheme(next);
  }

  return (
    <button
      className="btn btn--ghost btn--icon btn--sm"
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
      title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
    >
      <svg className="icon">
        <use href={theme === "dark" ? "#i-sun" : "#i-moon"} />
      </svg>
    </button>
  );
}
