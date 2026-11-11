import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Flash } from "@/components/Flash";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; ok?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const requested = params.next;
  const next = requested && requested.startsWith("/") && !requested.startsWith("//") ? requested : "/rooms";

  if (user) redirect(next);

  const loginHref = `/auth/login?next=${encodeURIComponent(next)}`;

  return (
    <main className="container">
      <section className="hero">
        <span className="hero__eyebrow">
          <svg className="icon" style={{ width: 16, height: 16 }}>
            <use href="#i-shield" />
          </svg>
          Бесплатно · вход через Google · без установки приложений
        </span>

        <h1 className="hero__title">Голосования класса без поднятых рук</h1>

        <p className="hero__lead">
          Откройте комнату, покажите QR-код — и участники голосуют со своих телефонов. Внутри комнаты может
          быть сколько угодно голосований: по темам, урокам и вопросам. Код вводить заново не нужно.
        </p>

        <Flash error={params.error} ok={params.ok} />

        <div className="hero__actions">
          <a className="btn btn--lg" href={loginHref}>
            <svg className="icon icon--fill" style={{ fill: "currentColor", stroke: "none" }}>
              <use href="#i-google" />
            </svg>
            Войти через Google
          </a>
          <Link className="btn btn--secondary btn--lg" href="/join">
            У меня есть код
          </Link>
        </div>

        <p className="xs faint" style={{ margin: 0, maxWidth: "58ch" }}>
          Вход через Google нужен, чтобы в комнату не попадали боты и чтобы у каждого участника был ровно один
          голос. Почту и имя видит только организатор комнаты.
        </p>
      </section>

      <section className="section">
        <div className="grid grid--3">
          <article className="feature">
            <span className="feature__icon">
              <svg className="icon">
                <use href="#i-qr" />
              </svg>
            </span>
            <h2 className="feature__title">Комната по коду или QR</h2>
            <p className="feature__text">
              Одна ссылка на всю комнату. Участник сканирует код один раз — дальше он выбирает голосование в
              интерфейсе.
            </p>
          </article>

          <article className="feature">
            <span className="feature__icon">
              <svg className="icon">
                <use href="#i-vote" />
              </svg>
            </span>
            <h2 className="feature__title">Несколько голосований</h2>
            <p className="feature__text">
              Отдельные темы внутри одной комнаты: можно голосовать по каждой, не создавая новую комнату и не
              раздавая новый код.
            </p>
          </article>

          <article className="feature">
            <span className="feature__icon">
              <svg className="icon">
                <use href="#i-chart" />
              </svg>
            </span>
            <h2 className="feature__title">Живые результаты</h2>
            <p className="feature__text">
              Организатор видит, как растут голоса в реальном времени. Участникам итоги открываются после
              закрытия голосования.
            </p>
          </article>

          <article className="feature">
            <span className="feature__icon">
              <svg className="icon">
                <use href="#i-lock" />
              </svg>
            </span>
            <h2 className="feature__title">Анонимно или с именами</h2>
            <p className="feature__text">
              В анонимном режиме организатор видит только счётчики — это ограничение на уровне базы данных, а не
              интерфейса. В именном участники заранее видят предупреждение.
            </p>
          </article>
        </div>
      </section>

      <section className="section">
        <h2 className="section__title">Как это работает</h2>
        <div className="grid grid--3" style={{ marginTop: "var(--space-4)" }}>
          <article className="panel stack stack--sm">
            <span className="badge badge--primary">Шаг 1</span>
            <h3 className="feature__title">Создайте комнату</h3>
            <p className="feature__text">
              Название, при желании лимит участников. Комната сразу получает короткий код и QR-код.
            </p>
          </article>

          <article className="panel stack stack--sm">
            <span className="badge badge--primary">Шаг 2</span>
            <h3 className="feature__title">Добавьте голосования</h3>
            <p className="feature__text">
              Тема, варианты, один или несколько ответов, анонимность. Черновики участникам не видны.
            </p>
          </article>

          <article className="panel stack stack--sm">
            <span className="badge badge--primary">Шаг 3</span>
            <h3 className="feature__title">Закройте и покажите итоги</h3>
            <p className="feature__text">
              После закрытия результаты видят все участники комнаты — как окончательный протокол.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
