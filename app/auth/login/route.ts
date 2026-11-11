import type { NextRequest } from "next/server";
import { createRouteClient } from "@/lib/supabase/route";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const nextParam = url.searchParams.get("next") ?? "/rooms";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/rooms";

  const { supabase, redirect } = createRouteClient(request);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${url.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: { prompt: "select_account" },
    },
  });

  if (error || !data.url) {
    return redirect(new URL("/?error=AUTH_REQUIRED", url.origin));
  }

  return redirect(data.url);
}
