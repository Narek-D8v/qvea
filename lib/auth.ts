import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export interface CurrentUser {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

interface Claims {
  sub?: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    name?: string;
    avatar_url?: string;
    picture?: string;
  };
}

/**
 * Пользователь текущего запроса. Обёрнут в `cache`, поэтому шапка, страница и
 * вложенные загрузки делят один вызов вместо нескольких одинаковых.
 *
 * Используется `getClaims`: для проектов с асимметричными ключами подписи JWT
 * проверяется локально, без сетевого запроса к Supabase. Если проект на
 * симметричном секрете, supabase-js сам сходит на сервер — как `getUser()`.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();

  let claims: Claims;
  try {
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data) return null;
    claims = data.claims as unknown as Claims;
  } catch {
    return null;
  }
  if (!claims.sub) return null;

  const meta = claims.user_metadata ?? {};

  return {
    id: claims.sub,
    email: claims.email ?? null,
    name: meta.full_name ?? meta.name ?? null,
    avatarUrl: meta.avatar_url ?? meta.picture ?? null,
  };
});
