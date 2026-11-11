"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

interface Props {
  children: ReactNode;
  className?: string;
  pendingText?: string;
  name?: string;
  value?: string;
  title?: string;
}

export function SubmitButton({ children, className = "btn", pendingText, name, value, title }: Props) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={className}
      aria-busy={pending || undefined}
      disabled={pending}
      name={name}
      value={value}
      title={title}
    >
      {pending && pendingText ? pendingText : children}
    </button>
  );
}
