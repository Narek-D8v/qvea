import type { SupabaseClient } from "@supabase/supabase-js";

export type RoomRole = "owner" | "admin" | "voter";
export type PollMode = "anonymous" | "identified";
export type PollStatus = "draft" | "open" | "closed";

export interface Room {
  id: string;
  code: string;
  title: string;
  description: string | null;
  max_participants: number | null;
  owner_id: string;
  created_at: string;
}

export interface RoomMember {
  room_id: string;
  user_id: string;
  role: RoomRole;
  joined_at: string;
}

export interface Poll {
  id: string;
  room_id: string;
  title: string;
  description: string | null;
  mode: PollMode;
  multi_select: boolean;
  max_choices: number | null;
  status: PollStatus;
  allow_change: boolean;
  created_at: string;
  closed_at: string | null;
}

export interface PollOption {
  id: string;
  poll_id: string;
  label: string;
  sort_order: number;
}

export interface PollStats {
  poll_id: string;
  votes_count: number;
  voters_count: number;
  updated_at: string;
}

export interface PollResultRow {
  option_id: string;
  label: string;
  sort_order: number;
  votes: number;
  is_mine: boolean;
  total_votes: number;
  total_voters: number;
}

export interface IdentifiedBallot {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  option_id: string;
  option_label: string;
  created_at: string;
}

export interface ProfilePublic {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export type RoomAccess =
  | { status: "ok"; room: Room; role: RoomRole; isAdmin: boolean }
  | { status: "not_found" }
  | { status: "full" };

/** Заходит в комнату по коду (идемпотентно) и возвращает её вместе с ролью пользователя. */
export async function loadRoom(
  supabase: SupabaseClient,
  rawCode: string,
): Promise<RoomAccess> {
  const code = rawCode.trim().toUpperCase();

  const { error: joinError } = await supabase.rpc("join_room", { p_code: code });

  if (joinError) {
    const message = joinError.message ?? "";
    if (message.includes("ROOM_NOT_FOUND")) return { status: "not_found" };
    if (message.includes("ROOM_FULL")) return { status: "full" };
    return { status: "not_found" };
  }

  const { data: room } = await supabase
    .from("rooms")
    .select("id, code, title, description, max_participants, owner_id, created_at")
    .eq("code", code)
    .maybeSingle<Room>();

  if (!room) return { status: "not_found" };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { status: "not_found" };

  const { data: membership } = await supabase
    .from("room_members")
    .select("role")
    .eq("room_id", room.id)
    .eq("user_id", user.id)
    .maybeSingle<{ role: RoomRole }>();

  const role: RoomRole = membership?.role ?? "voter";

  return {
    status: "ok",
    room,
    role,
    isAdmin: role === "owner" || role === "admin",
  };
}
