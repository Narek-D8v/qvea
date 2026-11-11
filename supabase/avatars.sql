-- =====================================================================
-- Qvea — свои аватары
-- Выполните этот файл целиком в SQL Editor проекта Supabase.
-- Файл идемпотентен: его можно запускать повторно.
-- Нужен только для смены аватара в профиле; остальной сайт работает без него.
-- =====================================================================

-- Публичный бакет: файл читают все, пишет каждый только в свою папку <uid>/.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars: публичное чтение" on storage.objects;
create policy "avatars: публичное чтение"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars: запись в свою папку" on storage.objects;
create policy "avatars: запись в свою папку"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars: замена файла в своей папке" on storage.objects;
create policy "avatars: замена файла в своей папке"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars: удаление файла в своей папке" on storage.objects;
create policy "avatars: удаление файла в своей папке"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Профиль: пользователь может изменить только свою запись и только аватар.
-- Имя и почта остаются из Google: иначе можно было бы подставить чужой адрес
-- и получить права организатора, которого добавляют по почте.
drop policy if exists "profiles: обновление своей записи" on public.profiles;
create policy "profiles: обновление своей записи"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

revoke update on public.profiles from authenticated;
grant update (avatar_url) on public.profiles to authenticated;
