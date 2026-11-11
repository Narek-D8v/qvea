import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { joinRoomAction } from "@/app/actions/rooms";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; code?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/auth/login?next=${encodeURIComponent("/join")}`);

  return (
    <main className="container container--narrow">
      <div className="page-head">
        <div>
          <h1 className="page-title">Вход в комнату</h1>
          <p className="page-sub">
            Введите шестизначный код, который показал организатор. Если код в QR-коде — просто отсканируйте его
            камерой телефона, вход произойдёт автоматически.
          </p>
        </div>
      </div>

      <Flash error={params.error} ok={params.ok} />

      <form action={joinRoomAction} className="panel stack" style={{ marginTop: "var(--space-4)" }}>
        <div className="field" style={{ maxWidth: "none" }}>
          <label className="field__label" htmlFor="code">
            Код комнаты
          </label>
          <input
            className="input mono"
            id="code"
            name="code"
            required
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={12}
            defaultValue={params.code ?? ""}
            placeholder="Например, K7M2Q9"
            style={{ letterSpacing: ".18em", textTransform: "uppercase", fontSize: "var(--fs-lg)" }}
          />
          <span className="field__hint">Код состоит из 6 символов: буквы и цифры.</span>
        </div>

        <input type="hidden" name="back" value="/join" />

        <div className="row">
          <SubmitButton className="btn" pendingText="Входим">
            Войти в комнату
          </SubmitButton>
          <Link className="btn btn--ghost" href="/rooms">
            Мои комнаты
          </Link>
        </div>
      </form>
    </main>
  );
}
