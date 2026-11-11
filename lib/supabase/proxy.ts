import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/", "/auth"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || (path !== "/" && pathname.startsWith(`${path}/`)),
  );
}

/** Есть ли в запросе cookie сессии Supabase (в том числе разбитая на части). */
function hasSessionCookie(request: NextRequest) {
  return request.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token"));
}

function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/rooms";
}

function redirectTo(request: NextRequest, path: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/";
  url.search = "";
  url.searchParams.set("next", `${path}${request.nextUrl.search}`);
  return NextResponse.redirect(url);
}

/**
 * Обновляет сессию Supabase и закрывает приватные страницы от неавторизованных.
 *
 * Анонимные запросы (а их большинство — статика, лендинг, первые визиты)
 * выходят здесь же, без единого сетевого вызова. Для запросов с сессией JWT
 * проверяется через `getClaims` — локально, если проект на асимметричных
 * ключах подписи, и только протухший токен требует обновления.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const pathname = request.nextUrl.pathname;

  // Быстрый путь: сессии нет — не ходим в Supabase вообще.
  if (!hasSessionCookie(request)) {
    return isPublic(pathname) ? response : redirectTo(request, pathname);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(headers ?? {}).forEach(([header, value]) => {
          response.headers.set(header, value);
        });
      },
    },
  });

  let userId: string | null = null;
  try {
    const { data, error } = await supabase.auth.getClaims();
    userId = error ? null : ((data?.claims as { sub?: string } | undefined)?.sub ?? null);
  } catch {
    // Сбой Auth не должен ронять весь сайт: считаем запрос анонимным и уводим на вход.
    userId = null;
  }

  if (!userId) {
    return isPublic(pathname) ? response : redirectTo(request, pathname);
  }

  // Вошедшему пользователю лендинг не нужен: сразу в комнаты или по ссылке.
  if (pathname === "/" && !request.nextUrl.searchParams.has("error") && !request.nextUrl.searchParams.has("ok")) {
    const target = safeNext(request.nextUrl.searchParams.get("next"));
    const nextUrl = request.nextUrl.clone();
    const parsed = new URL(target, request.url);
    nextUrl.pathname = parsed.pathname;
    nextUrl.search = parsed.search;
    return NextResponse.redirect(nextUrl);
  }

  return response;
}
