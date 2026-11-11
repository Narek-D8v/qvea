"use client";

import { useState } from "react";
import type { PollMode } from "@/lib/room";
import { SubmitButton } from "./SubmitButton";

export interface DraftOption {
  id: string | null;
  label: string;
}

interface Props {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  initial?: {
    title: string;
    description: string;
    mode: PollMode;
    multiSelect: boolean;
    maxChoices: string;
    options: DraftOption[];
  };
  /** После первых голосов режим и правила выбора менять нельзя. */
  locked?: boolean;
  withStatus?: boolean;
  hiddenFields?: Record<string, string>;
}

export function PollForm({
  action,
  submitLabel,
  initial,
  locked = false,
  withStatus = false,
  hiddenFields = {},
}: Props) {
  const [options, setOptions] = useState<DraftOption[]>(
    initial?.options.length ? initial.options : [{ id: null, label: "" }, { id: null, label: "" }],
  );
  const [multi, setMulti] = useState(initial?.multiSelect ?? false);

  const filled = options.filter((option) => option.label.trim().length > 0);

  function updateOption(index: number, label: string) {
    setOptions((current) => current.map((option, i) => (i === index ? { ...option, label } : option)));
  }

  function addOption() {
    setOptions((current) => (current.length >= 20 ? current : [...current, { id: null, label: "" }]));
  }

  function removeOption(index: number) {
    setOptions((current) => (current.length <= 2 ? current : current.filter((_, i) => i !== index)));
  }

  return (
    <form action={action} className="stack">
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      {locked ? (
        <>
          <input type="hidden" name="mode" value={initial?.mode ?? "anonymous"} />
          <input type="hidden" name="multi_select" value={initial?.multiSelect ? "1" : ""} />
          <input type="hidden" name="max_choices" value={initial?.maxChoices ?? ""} />
        </>
      ) : null}

      <div className="field field--wide" style={{ maxWidth: "none" }}>
        <label className="field__label" htmlFor="poll-title">
          Тема голосования
        </label>
        <input
          className="input"
          id="poll-title"
          name="title"
          required
          maxLength={160}
          defaultValue={initial?.title ?? ""}
          placeholder="Например: Какой рассказ читаем на следующем уроке"
        />
      </div>

      <div className="field" style={{ maxWidth: "none" }}>
        <label className="field__label" htmlFor="poll-description">
          Описание <span className="faint">— необязательно</span>
        </label>
        <textarea
          className="input"
          id="poll-description"
          name="description"
          maxLength={1000}
          defaultValue={initial?.description ?? ""}
          placeholder="Пара слов о том, зачем это голосование"
        />
        <span className="field__hint">До 1000 символов.</span>
      </div>

      <div className="stack stack--sm">
        <span className="field__label">Кто видит, как проголосовал участник</span>

        {locked ? (
          <div className="banner-note">
            <svg className="icon">
              <use href="#i-lock" />
            </svg>
            <span>
              Голоса уже есть, поэтому режим и правила выбора зафиксированы: {initial?.mode === "identified" ? "идентифицированное" : "анонимное"}
              {initial?.multiSelect ? ", несколько вариантов" : ", один вариант"}.
            </span>
          </div>
        ) : (
          <>
            <label className="check">
              <input type="radio" name="mode" value="anonymous" defaultChecked={(initial?.mode ?? "anonymous") === "anonymous"} />
              <span>
                Анонимно
                <small>Организатор видит только счётчики, но не то, кто как проголосовал.</small>
              </span>
            </label>
            <label className="check">
              <input type="radio" name="mode" value="identified" defaultChecked={initial?.mode === "identified"} />
              <span>
                С именами
                <small>Организатор видит, кто как проголосовал. Участники предупреждены об этом до голосования.</small>
              </span>
            </label>
          </>
        )}
      </div>

      <div className="stack stack--sm">
        <span className="field__label">Варианты ответа</span>
        <div className="options-editor">
          {options.map((option, index) => (
            <div className="option-row" key={option.id ?? `new-${index}`}>
              <span className="option-row__handle">{index + 1}</span>
              <input
                className="input"
                value={option.label}
                maxLength={200}
                placeholder={index === 0 ? "Первый вариант" : "Ещё вариант"}
                onChange={(event) => updateOption(index, event.target.value)}
                aria-label={`Вариант ${index + 1}`}
              />
              <button
                className="btn btn--ghost btn--icon btn--sm"
                type="button"
                onClick={() => removeOption(index)}
                disabled={options.length <= 2}
                aria-label={`Удалить вариант ${index + 1}`}
                title="Удалить вариант"
              >
                <svg className="icon">
                  <use href="#i-x" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        <div className="row">
          <button className="btn btn--secondary btn--sm" type="button" onClick={addOption} disabled={options.length >= 20}>
            <svg className="icon">
              <use href="#i-plus" />
            </svg>
            Добавить вариант
          </button>
          <span className="xs faint">Минимум два варианта, максимум 20.</span>
        </div>

        <input type="hidden" name="options" value={JSON.stringify(filled)} />
      </div>

      <div className="stack stack--sm">
        <span className="field__label">Сколько вариантов можно выбрать</span>
        {locked ? (
          <span className="small muted">
            {initial?.multiSelect ? `Несколько, максимум ${initial.maxChoices || "без ограничения"}.` : "Один вариант."}
          </span>
        ) : (
          <>
            <label className="switch">
              <input
                type="checkbox"
                name="multi_select"
                value="1"
                checked={multi}
                onChange={(event) => setMulti(event.target.checked)}
              />
              <span>Разрешить несколько вариантов</span>
            </label>
            {multi ? (
              <div className="field" style={{ maxWidth: 220 }}>
                <label className="field__label" htmlFor="poll-max">
                  Максимум вариантов
                </label>
                <input
                  className="input"
                  id="poll-max"
                  name="max_choices"
                  type="number"
                  min={2}
                  max={20}
                  defaultValue={initial?.maxChoices ?? ""}
                  placeholder="Без ограничения"
                />
                <span className="field__hint">Пусто — можно выбрать все.</span>
              </div>
            ) : null}
          </>
        )}
      </div>

      {withStatus ? (
        <div className="field" style={{ maxWidth: 280 }}>
          <label className="field__label" htmlFor="poll-status">
            После создания
          </label>
          <select className="input" id="poll-status" name="status" defaultValue="open">
            <option value="open">Сразу открыть для голосования</option>
            <option value="draft">Сохранить черновиком</option>
          </select>
        </div>
      ) : null}

      <div className="row">
        <SubmitButton className="btn" pendingText="Сохраняем">
          {submitLabel}
        </SubmitButton>
        <span className="xs faint">Голоса можно менять до закрытия голосования.</span>
      </div>
    </form>
  );
}
