"use client";

import { useRef, useState, useTransition } from "react";
import { updateAvatarAction } from "@/app/actions/profile";

const MAX_INPUT = 10 * 1024 * 1024;
const OUTPUT_SIZE = 320;

/** Уменьшает картинку в браузере, чтобы аватар весил десятки килобайт. */
async function shrink(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, OUTPUT_SIZE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return file;

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
    if (!blob) return file;

    return new File([blob], "avatar.jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export function AvatarForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setPreview(null);

    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Подойдёт JPEG, PNG или WebP.");
      return;
    }
    if (file.size > MAX_INPUT) {
      setError("Файл больше 10 МБ. Выберите картинку поменьше.");
      return;
    }

    setError(null);
    setPreview(URL.createObjectURL(file));
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError("Выберите файл с картинкой.");
      return;
    }

    setError(null);

    startTransition(async () => {
      const prepared = await shrink(file);
      const formData = new FormData();
      formData.append("avatar", prepared);
      await updateAvatarAction(formData);
    });
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <div>
        <h2 className="section__title">Сменить аватар</h2>
        <p className="small muted" style={{ margin: "var(--space-1) 0 0" }}>
          По умолчанию стоит фотография из Google. Своя картинка обрежется в круг — квадратное фото подходит лучше всего.
        </p>
      </div>

      <div className="avatar-picker">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="avatar avatar--lg" src={preview} alt="Предпросмотр аватара" />
        ) : (
          <span className="avatar avatar--lg avatar--initials" aria-hidden="true">
            <svg className="icon">
              <use href="#i-camera" />
            </svg>
          </span>
        )}

        <div className="grow">
          <input
            ref={inputRef}
            className="input input--file"
            id="avatar-file"
            name="avatar"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onPick}
            disabled={pending}
          />
          <span className="field__hint">JPEG, PNG или WebP. Мы сами уменьшим картинку до 320 px.</span>
        </div>
      </div>

      {error ? (
        <p className="small" style={{ color: "var(--color-danger-text)", margin: 0 }} role="alert">
          {error}
        </p>
      ) : null}

      <div className="row">
        <button className="btn" type="submit" disabled={pending} aria-busy={pending || undefined}>
          <svg className="icon">
            <use href="#i-camera" />
          </svg>
          {pending ? "Загружаем…" : "Сохранить аватар"}
        </button>
      </div>
    </form>
  );
}
