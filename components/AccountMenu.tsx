"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { initials } from "@/lib/format";

interface Props {
  name: string;
  email: string | null;
  avatarUrl: string | null;
}

function Avatar({ name, avatarUrl, size }: { name: string; avatarUrl: string | null; size?: "lg" }) {
  const className = `avatar${size === "lg" ? " avatar--lg" : ""}`;

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img className={className} src={avatarUrl} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async" />
    );
  }

  return (
    <span className={`${className} avatar--initials`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function AccountMenu({ name, email, avatarUrl }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  // Дропдаун не должен оставаться открытым после перехода по ссылке.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="account-menu" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="account-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Аккаунт"
        onClick={() => setOpen((value) => !value)}
      >
        <Avatar name={name} avatarUrl={avatarUrl} />
        <span className="userbox__meta">
          <span className="userbox__name">{name}</span>
          {email ? <small>{email}</small> : null}
        </span>
        <svg className="icon account-trigger__chevron" aria-hidden="true">
          <use href="#i-chevron-down" />
        </svg>
      </button>

      {open ? (
        <div className="account-menu__panel" aria-label="Аккаунт">
          <div className="account-menu__head">
            <Avatar name={name} avatarUrl={avatarUrl} size="lg" />
            <div className="account-menu__who">
              <strong>{name}</strong>
              {email ? <small>{email}</small> : null}
            </div>
          </div>

          <div className="account-menu__list">
            <Link className="account-menu__item" href="/profile">
              <svg className="icon" aria-hidden="true">
                <use href="#i-user" />
              </svg>
              <span className="account-menu__label">Профиль</span>
            </Link>

            <Link className="account-menu__item" href="/rooms?role=staff">
              <svg className="icon" aria-hidden="true">
                <use href="#i-users" />
              </svg>
              <span className="account-menu__label">Мои комнаты</span>
            </Link>

            <Link className="account-menu__item" href="/history">
              <svg className="icon" aria-hidden="true">
                <use href="#i-history" />
              </svg>
              <span className="account-menu__label">История голосований</span>
            </Link>
          </div>

          <div className="account-menu__foot">
            <a className="account-menu__item account-menu__item--danger" href="/auth/logout">
              <svg className="icon" aria-hidden="true">
                <use href="#i-logout" />
              </svg>
              <span className="account-menu__label">Выйти</span>
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
