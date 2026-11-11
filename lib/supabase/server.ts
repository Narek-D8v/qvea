import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Клиент Supabase для серверных компонентов, действий и route-обработчиков.
 * Работает от имени вошедшего пользователя, поэтому все RLS-политики применяются.
 */
export async function createClient() {
  // Читаем cookies до проверки окружения: это делает страницу динамической
  // и не даёт Next.js пререндерить её на этапе сборки.
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Не заданы NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY. Скопируйте .env.example в .env.local и заполните значения из проекта Supabase.",
    );
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Вызов из серверного компонента: обновление сессии делает proxy.ts.
        }
      },
    },
  });
}
