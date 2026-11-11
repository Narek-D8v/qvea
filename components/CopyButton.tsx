"use client";

import { useState } from "react";

interface Props {
  value: string;
  label?: string;
  className?: string;
  copiedLabel?: string;
}

export function CopyButton({
  value,
  label = "Копировать",
  copiedLabel = "Скопировано",
  className = "btn btn--secondary btn--sm",
}: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button className={className} type="button" onClick={copy}>
      <svg className="icon">
        <use href={copied ? "#i-check" : "#i-copy"} />
      </svg>
      {copied ? copiedLabel : label}
    </button>
  );
}
