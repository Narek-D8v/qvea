import type { NextRequest } from "next/server";
import { createRouteClient } from "@/lib/supabase/route";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? "/rooms";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/rooms";

  const { supabase, redirect } = createRouteClient(request);

  if (!code) {
    return redirect(new URL("/?error=AUTH_REQUIRED", url.origin));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return redirect(new URL("/?error=AUTH_REQUIRED", url.origin));
  }

  return redirect(new URL(next, url.origin));
}
