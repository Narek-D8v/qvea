export const ERROR_MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: "Нужно войти в аккаунт.",
  TITLE_REQUIRED: "Введите название.",
  BAD_LIMIT: "Лимит участников должен быть положительным числом.",
  BAD_MODE: "Неизвестный режим голосования.",
  BAD_STATUS: "Неизвестный статус голосования.",
  BAD_MAX_CHOICES: "Максимум вариантов должен быть не меньше двух.",
  ROOM_NOT_FOUND: "Комната с таким кодом не найдена. Проверьте код.",
  ROOM_FULL: "В комнате закончились места для участников.",
  CODE_GENERATION_FAILED: "Не удалось создать код комнаты. Попробуйте ещё раз.",
  NOT_AN_ADMIN: "Это действие доступно только организаторам комнаты.",
  NOT_THE_OWNER: "Удалить комнату может только её создатель.",
  LIMIT_TOO_SMALL: "Лимит меньше числа участников, которые уже присоединились.",
  USER_NOT_FOUND: "Пользователь с такой почтой ещё не входил на сайт.",
  CANNOT_REMOVE_OWNER: "Создателя комнаты нельзя исключить.",
  LAST_ADMIN: "Нельзя убрать последнего организатора комнаты.",
  NOT_ENOUGH_OPTIONS: "Нужно минимум два варианта ответа.",
  POLL_NOT_FOUND: "Голосование не найдено.",
  POLL_NOT_OPEN: "Голосование уже закрыто или ещё не началось.",
  LOCKED_AFTER_VOTES: "После первых голосов нельзя менять режим и правила выбора.",
  OPTION_HAS_VOTES: "Нельзя удалить вариант, за который уже голосовали.",
  NOT_A_MEMBER: "Вы не участник этой комнаты.",
  SINGLE_CHOICE: "В этом голосовании можно выбрать только один вариант.",
  TOO_MANY_CHOICES: "Выбрано больше вариантов, чем разрешено.",
  INVALID_OPTION: "Один из вариантов не относится к этому голосованию.",
  ALREADY_VOTED: "Голос уже учтён, изменить его нельзя.",
  NO_CHOICE: "Выберите хотя бы один вариант.",
  RESULTS_HIDDEN: "Результаты станут видны после закрытия голосования.",
  NOT_IDENTIFIED: "Это голосование анонимное.",
  UNKNOWN: "Что-то пошло не так. Попробуйте ещё раз.",
};

export const OK_MESSAGES: Record<string, string> = {
  room_created: "Комната создана. Поделитесь кодом или QR-кодом.",
  room_updated: "Настройки комнаты сохранены.",
  poll_created: "Голосование создано.",
  poll_updated: "Голосование обновлено.",
  vote: "Голос учтён. Спасибо!",
  admin_added: "Организатор добавлен.",
  member_removed: "Участник исключён из комнаты.",
  left: "Вы покинули комнату.",
  closed: "Голосование закрыто, результаты опубликованы.",
  opened: "Голосование открыто.",
  copied: "Скопировано.",
};

export function errorMessage(code?: string | null): string | null {
  if (!code) return null;
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES.UNKNOWN;
}

export function okMessage(code?: string | null): string | null {
  if (!code) return null;
  return OK_MESSAGES[code] ?? null;
}

/** Приводит текст ошибки RPC к известному коду. */
export function errorCode(error: { message?: string; details?: string } | null): string {
  if (!error) return "UNKNOWN";
  const raw = `${error.message ?? ""} ${error.details ?? ""}`;
  const found = Object.keys(ERROR_MESSAGES).find((code) => raw.includes(code));
  return found ?? "UNKNOWN";
}
