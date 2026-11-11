"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

interface Props {
  children: ReactNode;
  className?: string;
  message: string;
  pendingText?: string;
}

export function ConfirmSubmit({ children, className = "btn btn--danger", message, pendingText }: Props) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      aria-busy={pending || undefined}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {pending && pendingText ? pendingText : children}
    </button>
  );
}
