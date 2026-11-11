import { createServerClient, type CookieOptions } from "@supabase/ssr";
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

/**
 * Обновляет сессию Supabase и закрывает приватные страницы от неавторизованных.
 *
 * Анонимные запросы (а их большинство — статика, лендинг, первые визиты)
 * выходят здесь же, без единого сетевого вызова. Для запросов с сессией JWT
 * проверяется через `getClaims` — локально, если проект на асимметричных
 * ключах подписи. Истёкший токен обновляется по refresh-токену: без этого
 * через час после входа сайт «забывал» пользователя.
 */
export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Cookie, которые нужно отдать браузеру с этим ответом (обновлённые токены,
  // удалённые чанки старой сессии).
  const pendingCookies: { name: string; value: string; options?: CookieOptions }[] = [];
  const pendingHeaders: Record<string, string> = {};

  /** Любой ответ (включая редирект) должен унести свежие cookie сессии. */
  function finish(response: NextResponse) {
    pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    Object.entries(pendingHeaders).forEach(([header, value]) => response.headers.set(header, value));
    return response;
  }

  function nextResponse() {
    return finish(NextResponse.next({ request }));
  }

  function redirectTo(path: string) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    url.searchParams.set("next", `${path}${request.nextUrl.search}`);
    return finish(NextResponse.redirect(url));
  }

  // Быстрый путь: сессии нет — не ходим в Supabase вообще.
  if (!hasSessionCookie(request)) {
    return isPublic(pathname) ? nextResponse() : redirectTo(pathname);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return nextResponse();
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          pendingCookies.push({ name, value, options });
        });
        Object.entries(headers ?? {}).forEach(([header, value]) => {
          pendingHeaders[header] = value;
        });
      },
    },
  });

  async function readUserId(): Promise<string | null> {
    try {
      const { data, error } = await supabase.auth.getClaims();
      const sub = (data?.claims as { sub?: string } | undefined)?.sub;
      if (!error && sub) return sub;
    } catch {
      // Сбой проверки — ниже попробуем обновить сессию.
    }

    // `getClaims` проверяет exp и на истёкшем токене просто возвращает ошибку,
    // а на сервере автообновление выключено. Поэтому обновляем сессию сами:
    // это и продлевает вход, и отдаёт браузеру новые cookie.
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (!error && data.session?.user) return data.session.user.id;
    } catch {
      // Нет валидного refresh-токена — считаем запрос анонимным.
    }

    return null;
  }

  let userId: string | null = null;
  try {
    userId = await readUserId();
  } catch {
    // Сбой Auth не должен ронять весь сайт: считаем запрос анонимным и уводим на вход.
    userId = null;
  }

  if (!userId) {
    return isPublic(pathname) ? nextResponse() : redirectTo(pathname);
  }

  // Вошедшему пользователю лендинг не нужен: сразу в комнаты или по ссылке.
  if (pathname === "/" && !request.nextUrl.searchParams.has("error") && !request.nextUrl.searchParams.has("ok")) {
    const target = safeNext(request.nextUrl.searchParams.get("next"));
    const nextUrl = request.nextUrl.clone();
    const parsed = new URL(target, request.url);
    nextUrl.pathname = parsed.pathname;
    nextUrl.search = parsed.search;
    return finish(NextResponse.redirect(nextUrl));
  }

  return nextResponse();
}
