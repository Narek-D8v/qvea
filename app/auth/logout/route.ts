import type { NextRequest } from "next/server";
import { createRouteClient } from "@/lib/supabase/route";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const { supabase, redirect } = createRouteClient(request);

  await supabase.auth.signOut();

  return redirect(new URL("/", url.origin));
}
