"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { errorCode } from "@/lib/messages";

async function requireUser(): Promise<{ supabase: SupabaseClient }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  return { supabase };
}

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

interface DraftOption {
  id: string | null;
  label: string;
}

function parseOptions(formData: FormData): DraftOption[] {
  const raw = formData.get("options");
  if (typeof raw !== "string") return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map((item) => ({
        id: typeof item.id === "string" && item.id.length > 0 ? item.id : null,
        label: typeof item.label === "string" ? item.label.trim() : "",
      }))
      .filter((item) => item.label.length > 0);
  } catch {
    return [];
  }
}

export async function createPollAction(formData: FormData) {
  const { supabase } = await requireUser();

  const roomId = text(formData, "room_id");
  const code = text(formData, "code");
  const title = text(formData, "title");
  const description = text(formData, "description");
  const mode = text(formData, "mode") === "identified" ? "identified" : "anonymous";
  const multi = text(formData, "multi_select") === "1";
  const maxRaw = text(formData, "max_choices");
  const maxChoices = multi && maxRaw ? Number(maxRaw) : null;
  const status = text(formData, "status") === "draft" ? "draft" : "open";
  const options = parseOptions(formData).map((option) => option.label);

  if (options.length < 2) redirect(`/r/${code}/polls/new?error=NOT_ENOUGH_OPTIONS`);

  const { data, error } = await supabase.rpc("create_poll", {
    p_room_id: roomId,
    p_title: title,
    p_description: description || null,
    p_mode: mode,
    p_multi_select: multi,
    p_max_choices: Number.isFinite(maxChoices) ? maxChoices : null,
    p_options: options,
    p_status: status,
  });

  if (error) redirect(`/r/${code}/polls/new?error=${errorCode(error)}`);

  revalidatePath(`/r/${code}`);
  redirect(`/r/${code}/p/${data as string}?ok=poll_created`);
}

export async function updatePollAction(formData: FormData) {
  const { supabase } = await requireUser();

  const pollId = text(formData, "poll_id");
  const code = text(formData, "code");
  const title = text(formData, "title");
  const description = text(formData, "description");
  const mode = text(formData, "mode") === "identified" ? "identified" : "anonymous";
  const multi = text(formData, "multi_select") === "1";
  const maxRaw = text(formData, "max_choices");
  const maxChoices = multi && maxRaw ? Number(maxRaw) : null;
  const options = parseOptions(formData);

  if (options.length < 2) redirect(`/r/${code}/p/${pollId}/edit?error=NOT_ENOUGH_OPTIONS`);

  const { error } = await supabase.rpc("update_poll", {
    p_poll_id: pollId,
    p_title: title,
    p_description: description || null,
    p_mode: mode,
    p_multi_select: multi,
    p_max_choices: Number.isFinite(maxChoices) ? maxChoices : null,
    p_options: options,
  });

  if (error) redirect(`/r/${code}/p/${pollId}/edit?error=${errorCode(error)}`);

  revalidatePath(`/r/${code}/p/${pollId}`);
  redirect(`/r/${code}/p/${pollId}?ok=poll_updated`);
}

export async function setPollStatusAction(formData: FormData) {
  const { supabase } = await requireUser();

  const pollId = text(formData, "poll_id");
  const code = text(formData, "code");
  const status = text(formData, "status");

  const { error } = await supabase.rpc("set_poll_status", { p_poll_id: pollId, p_status: status });
  if (error) redirect(`/r/${code}/p/${pollId}?error=${errorCode(error)}`);

  revalidatePath(`/r/${code}`);
  revalidatePath(`/r/${code}/p/${pollId}`);
  redirect(`/r/${code}/p/${pollId}?ok=${status === "closed" ? "closed" : "opened"}`);
}

export async function deletePollAction(formData: FormData) {
  const { supabase } = await requireUser();

  const pollId = text(formData, "poll_id");
  const code = text(formData, "code");

  const { error } = await supabase.rpc("delete_poll", { p_poll_id: pollId });
  if (error) redirect(`/r/${code}/p/${pollId}?error=${errorCode(error)}`);

  revalidatePath(`/r/${code}`);
  redirect(`/r/${code}`);
}

export async function castVoteAction(formData: FormData) {
  const { supabase } = await requireUser();

  const pollId = text(formData, "poll_id");
  const code = text(formData, "code");

  const optionIds = formData
    .getAll("option")
    .filter((value): value is string => typeof value === "string" && value.length > 0);

  if (optionIds.length === 0) {
    redirect(`/r/${code}/p/${pollId}?error=NO_CHOICE`);
  }

  const { error } = await supabase.rpc("cast_vote", {
    p_poll_id: pollId,
    p_option_ids: optionIds,
  });

  if (error) redirect(`/r/${code}/p/${pollId}?error=${errorCode(error)}`);

  revalidatePath(`/r/${code}/p/${pollId}`);
  redirect(`/r/${code}/p/${pollId}?ok=vote`);
}
