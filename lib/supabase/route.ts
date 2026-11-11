import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

interface PendingCookie {
  name: string;
  value: string;
  options?: CookieOptions;
}

/**
 * Клиент Supabase для route-обработчиков входа и выхода.
 * Собранные им cookies явно переносятся на редирект: так PKCE-verifier
 * и обновлённая сессия не теряются при ответе с перенаправлением.
 */
export function createRouteClient(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Не заданы переменные окружения Supabase.");
  }

  const pending: PendingCookie[] = [];

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          pending.push({ name, value, options });
        });
      },
    },
  });

  function redirect(target: string | URL) {
    const response = NextResponse.redirect(target);
    pending.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });
    return response;
  }

  return { supabase, redirect };
}
