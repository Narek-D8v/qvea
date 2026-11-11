import { errorMessage, okMessage } from "@/lib/messages";

interface Props {
  error?: string | null;
  ok?: string | null;
  hint?: string | null;
}

export function Flash({ error, ok }: Props) {
  const errorText = errorMessage(error);
  const okText = okMessage(ok);

  if (!errorText && !okText) return null;

  if (errorText) {
    return (
      <div className="alert alert--danger" role="alert">
        <svg className="icon">
          <use href="#i-error" />
        </svg>
        <div>
          <p className="alert__title">Не получилось</p>
          <p className="alert__text">{errorText}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="alert alert--success" role="status">
      <svg className="icon">
        <use href="#i-check" />
      </svg>
      <div>
        <p className="alert__title">Готово</p>
        <p className="alert__text">{okText}</p>
      </div>
    </div>
  );
}
