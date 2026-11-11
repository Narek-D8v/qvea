"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

const MAX_BYTES = 5 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function updateAvatarAction(formData: FormData) {
  const supabase = await createClient();
  const user = await getCurrentUser();

  if (!user) redirect("/auth/login?next=%2Fprofile");

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) redirect("/profile?error=AVATAR_REQUIRED");

  const extension = EXTENSIONS[file.type];
  if (!extension) redirect("/profile?error=AVATAR_TYPE");
  if (file.size > MAX_BYTES) redirect("/profile?error=AVATAR_TOO_LARGE");

  // Путь всегда в папке пользователя: политика Storage разрешает запись только туда.
  const path = `${user.id}/avatar.${extension}`;

  const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
    contentType: file.type,
    upsert: true,
    cacheControl: "31536000",
  });

  if (uploadError) redirect("/profile?error=AVATAR_UPLOAD");

  const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path);
  // Версия в адресе сбрасывает кэш картинки у браузера после замены.
  const avatarUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", user.id);

  if (profileError) redirect("/profile?error=AVATAR_SAVE");

  // Дублируем в метаданные пользователя: шапка читает аватар из JWT и не ходит
  // в базу на каждой странице. Неудача здесь не критична — аватар уже сохранён.
  try {
    await supabase.auth.updateUser({ data: { avatar_url: avatarUrl } });
  } catch {
    // ignore
  }

  revalidatePath("/", "layout");
  redirect("/profile?ok=avatar_updated");
}
