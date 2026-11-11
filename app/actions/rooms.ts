"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { errorCode } from "@/lib/messages";

async function requireUser(): Promise<{ supabase: SupabaseClient; userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  return { supabase, userId: user.id };
}

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function createRoomAction(formData: FormData) {
  const { supabase } = await requireUser();

  const title = text(formData, "title");
  const description = text(formData, "description");
  const limitRaw = text(formData, "max_participants");
  const limit = limitRaw ? Number(limitRaw) : null;

  if (!title) redirect("/rooms?error=TITLE_REQUIRED");

  const { data, error } = await supabase.rpc("create_room", {
    p_title: title,
    p_description: description || null,
    p_max_participants: Number.isFinite(limit) ? limit : null,
  });

  if (error) redirect(`/rooms?error=${errorCode(error)}`);

  const room = data as { code: string } | null;
  if (!room) redirect("/rooms?error=UNKNOWN");

  revalidatePath("/rooms");
  redirect(`/r/${room.code}?ok=room_created`);
}

export async function joinRoomAction(formData: FormData) {
  const { supabase } = await requireUser();

  const code = text(formData, "code").toUpperCase();
  const back = text(formData, "back") || "/join";

  if (!code) redirect(`${back}?error=ROOM_NOT_FOUND`);

  const { error } = await supabase.rpc("join_room", { p_code: code });

  if (error) redirect(`${back}?error=${errorCode(error)}`);

  revalidatePath("/rooms");
  redirect(`/r/${code}`);
}

export async function updateRoomAction(formData: FormData) {
  const { supabase } = await requireUser();

  const roomId = text(formData, "room_id");
  const code = text(formData, "code");
  const title = text(formData, "title");
  const description = text(formData, "description");
  const limitRaw = text(formData, "max_participants");
  const limit = limitRaw ? Number(limitRaw) : null;

  const { error } = await supabase.rpc("update_room", {
    p_room_id: roomId,
    p_title: title,
    p_description: description || null,
    p_max_participants: Number.isFinite(limit) ? limit : null,
  });

  if (error) redirect(`/r/${code}/settings?error=${errorCode(error)}`);

  revalidatePath(`/r/${code}`);
  revalidatePath(`/r/${code}/settings`);
  redirect(`/r/${code}/settings?ok=room_updated`);
}

export async function deleteRoomAction(formData: FormData) {
  const { supabase } = await requireUser();

  const roomId = text(formData, "room_id");
  const { error } = await supabase.rpc("delete_room", { p_room_id: roomId });

  if (error) redirect(`/r/${text(formData, "code")}/settings?error=${errorCode(error)}`);

  revalidatePath("/rooms");
  redirect("/rooms");
}

export async function addAdminAction(formData: FormData) {
  const { supabase } = await requireUser();

  const roomId = text(formData, "room_id");
  const code = text(formData, "code");
  const email = text(formData, "email");

  if (!email) redirect(`/r/${code}/settings?error=USER_NOT_FOUND`);

  const { error } = await supabase.rpc("add_room_admin", { p_room_id: roomId, p_email: email });

  if (error) redirect(`/r/${code}/settings?error=${errorCode(error)}`);

  revalidatePath(`/r/${code}/settings`);
  redirect(`/r/${code}/settings?ok=admin_added`);
}

export async function removeMemberAction(formData: FormData) {
  const { supabase, userId } = await requireUser();

  const roomId = text(formData, "room_id");
  const code = text(formData, "code");
  const memberId = text(formData, "user_id");

  const { error } = await supabase.rpc("remove_room_member", {
    p_room_id: roomId,
    p_user_id: memberId,
  });

  if (error) redirect(`/r/${code}/settings?error=${errorCode(error)}`);

  revalidatePath(`/r/${code}/settings`);

  if (memberId === userId) {
    revalidatePath("/rooms");
    redirect("/rooms?ok=left");
  }

  redirect(`/r/${code}/settings?ok=member_removed`);
}

export async function leaveRoomAction(formData: FormData) {
  const { supabase } = await requireUser();

  const roomId = text(formData, "room_id");

  const { error } = await supabase.rpc("leave_room", { p_room_id: roomId });
  if (error) redirect(`/r/${text(formData, "code")}?error=${errorCode(error)}`);

  revalidatePath("/rooms");
  redirect("/rooms?ok=left");
}
