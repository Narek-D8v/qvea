-- =====================================================================
-- Qvea — схема базы данных для Supabase
-- Выполните этот файл целиком в SQL Editor проекта Supabase.
-- Файл идемпотентен: его можно запускать повторно.
-- =====================================================================

create extension if not exists pgcrypto;

-- =====================================================================
-- ПРОФИЛИ
-- =====================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create unique index if not exists profiles_email_unique
  on public.profiles (lower(email))
  where email is not null;

alter table public.profiles enable row level security;

drop policy if exists "profiles: только своя запись" on public.profiles;
create policy "profiles: только своя запись"
  on public.profiles for select to authenticated
  using (id = auth.uid());

-- Профиль создаётся при первом входе через Google.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  update public.profiles p
     set email = coalesce(p.email, new.email),
         full_name = coalesce(p.full_name, new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
         avatar_url = coalesce(p.avatar_url, new.raw_user_meta_data ->> 'avatar_url')
   where p.id = new.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Профили, которые успели появиться до установки триггера.
insert into public.profiles (id, email, full_name, avatar_url)
select u.id,
       u.email,
       coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
       u.raw_user_meta_data ->> 'avatar_url'
from auth.users u
on conflict (id) do nothing;

-- Публичные данные без e-mail: имена и аватары видны соседям по комнате,
-- адреса почты остаются доступны только владельцу записи.
create or replace view public.profiles_public
  with (security_invoker = false)
  as select id, full_name, avatar_url from public.profiles;

revoke all on public.profiles_public from anon;
grant select on public.profiles_public to authenticated;

-- =====================================================================
-- КОМНАТЫ
-- =====================================================================
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text,
  max_participants int,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint rooms_code_format check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  constraint rooms_title_length check (char_length(title) between 1 and 120),
  constraint rooms_description_length check (description is null or char_length(description) <= 500),
  constraint rooms_max_participants_positive check (max_participants is null or max_participants > 0)
);

create table if not exists public.room_members (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'voter',
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id),
  constraint room_members_role check (role in ('owner', 'admin', 'voter'))
);

create index if not exists room_members_user_idx on public.room_members (user_id);

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;

-- =====================================================================
-- ГОЛОСОВАНИЯ
-- =====================================================================
create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  title text not null,
  description text,
  mode text not null default 'anonymous',
  multi_select boolean not null default false,
  max_choices int,
  status text not null default 'draft',
  allow_change boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint polls_title_length check (char_length(title) between 1 and 160),
  constraint polls_description_length check (description is null or char_length(description) <= 1000),
  constraint polls_mode check (mode in ('anonymous', 'identified')),
  constraint polls_status check (status in ('draft', 'open', 'closed')),
  constraint polls_max_choices_positive check (max_choices is null or max_choices > 1)
);

create index if not exists polls_room_idx on public.polls (room_id, created_at);

create table if not exists public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls (id) on delete cascade,
  label text not null,
  sort_order int not null default 0,
  constraint poll_options_label_length check (char_length(label) between 1 and 200)
);

create index if not exists poll_options_poll_idx on public.poll_options (poll_id, sort_order);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls (id) on delete cascade,
  option_id uuid not null references public.poll_options (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (poll_id, option_id, user_id)
);

create index if not exists votes_poll_idx on public.votes (poll_id);
create index if not exists votes_user_idx on public.votes (user_id);

-- Агрегат для realtime: не содержит личности голосующего,
-- поэтому его можно безопасно отдавать всем участникам комнаты.
create table if not exists public.poll_stats (
  poll_id uuid primary key references public.polls (id) on delete cascade,
  votes_count int not null default 0,
  voters_count int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.votes enable row level security;
alter table public.poll_stats enable row level security;

-- Явные права для вошедших пользователей: сами данные закрывают RLS-политики ниже.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;

-- =====================================================================
-- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
-- SECURITY DEFINER — обходят RLS, поэтому сами не рекурсируют политики.
-- =====================================================================
create or replace function public.is_room_member(p_room_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.room_members m
    where m.room_id = p_room_id and m.user_id = p_user_id
  );
$$;

create or replace function public.is_room_admin(p_room_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.room_members m
    where m.room_id = p_room_id
      and m.user_id = p_user_id
      and m.role in ('owner', 'admin')
  );
$$;

create or replace function public.random_room_code()
returns text
language sql
volatile
as $$
  select string_agg(
           substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random() * 32))::int + 1, 1),
           ''
         )
  from generate_series(1, 6);
$$;

-- =====================================================================
-- ПОЛИТИКИ ДОСТУПА
-- =====================================================================
drop policy if exists "rooms: видно участникам" on public.rooms;
create policy "rooms: видно участникам"
  on public.rooms for select to authenticated
  using (public.is_room_member(id));

drop policy if exists "rooms: правка админами" on public.rooms;
create policy "rooms: правка админами"
  on public.rooms for update to authenticated
  using (public.is_room_admin(id))
  with check (public.is_room_admin(id));

drop policy if exists "rooms: удаление владельцем" on public.rooms;
create policy "rooms: удаление владельцем"
  on public.rooms for delete to authenticated
  using (owner_id = auth.uid());

drop policy if exists "members: видно участникам" on public.room_members;
create policy "members: видно участникам"
  on public.room_members for select to authenticated
  using (public.is_room_member(room_id));

-- Черновики видят только организаторы.
drop policy if exists "polls: видно участникам" on public.polls;
create policy "polls: видно участникам"
  on public.polls for select to authenticated
  using (
    public.is_room_admin(room_id)
    or (public.is_room_member(room_id) and status <> 'draft')
  );

drop policy if exists "polls: создание админами" on public.polls;
create policy "polls: создание админами"
  on public.polls for insert to authenticated
  with check (public.is_room_admin(room_id));

drop policy if exists "polls: правка админами" on public.polls;
create policy "polls: правка админами"
  on public.polls for update to authenticated
  using (public.is_room_admin(room_id))
  with check (public.is_room_admin(room_id));

drop policy if exists "polls: удаление админами" on public.polls;
create policy "polls: удаление админами"
  on public.polls for delete to authenticated
  using (public.is_room_admin(room_id));

drop policy if exists "options: видно участникам" on public.poll_options;
create policy "options: видно участникам"
  on public.poll_options for select to authenticated
  using (
    exists (
      select 1 from public.polls p
      where p.id = poll_options.poll_id
        and (
          public.is_room_admin(p.room_id)
          or (public.is_room_member(p.room_id) and p.status <> 'draft')
        )
    )
  );

drop policy if exists "options: правка админами" on public.poll_options;
create policy "options: правка админами"
  on public.poll_options for all to authenticated
  using (
    exists (
      select 1 from public.polls p
      where p.id = poll_options.poll_id and public.is_room_admin(p.room_id)
    )
  )
  with check (
    exists (
      select 1 from public.polls p
      where p.id = poll_options.poll_id and public.is_room_admin(p.room_id)
    )
  );

-- Ключевая политика приватности:
--   * свой голос виден всегда (чтобы показать выбранное);
--   * чужие голоса видны только в идентифицированном голосовании и только админам.
-- В анонимном голосовании админ не может прочитать ни одной чужой строки.
drop policy if exists "votes: свой голос и идентифицированные результаты" on public.votes;
create policy "votes: свой голос и идентифицированные результаты"
  on public.votes for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.polls p
      where p.id = votes.poll_id
        and p.mode = 'identified'
        and public.is_room_admin(p.room_id)
    )
  );

-- Записывать голоса можно только через функцию cast_vote (атомарно и с проверками).
-- Прямых политик insert/update/delete нет — клиент не может подделать голос.

drop policy if exists "stats: видно участникам" on public.poll_stats;
create policy "stats: видно участникам"
  on public.poll_stats for select to authenticated
  using (
    exists (
      select 1 from public.polls p
      where p.id = poll_stats.poll_id and public.is_room_member(p.room_id)
    )
  );

-- =====================================================================
-- ПЕРЕСЧЁТ АГРЕГАТОВ
-- =====================================================================
create or replace function public.refresh_poll_stats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_poll uuid := coalesce(new.poll_id, old.poll_id);
begin
  -- При каскадном удалении голосования голоса удаляются вместе с ним,
  -- и статистику пересчитывать не для чего.
  if not exists (select 1 from public.polls where id = v_poll) then
    return null;
  end if;

  insert into public.poll_stats (poll_id) values (v_poll)
  on conflict (poll_id) do nothing;

  update public.poll_stats s
     set votes_count = c.votes,
         voters_count = c.voters,
         updated_at = now()
    from (
      select count(*)::int as votes, count(distinct user_id)::int as voters
      from public.votes
      where poll_id = v_poll
    ) c
   where s.poll_id = v_poll;

  return null;
end;
$$;

drop trigger if exists votes_refresh_stats on public.votes;
create trigger votes_refresh_stats
  after insert or update or delete on public.votes
  for each row execute function public.refresh_poll_stats();

-- =====================================================================
-- КОМНАТЫ: ОПЕРАЦИИ
-- =====================================================================
create or replace function public.create_room(
  p_title text,
  p_description text default null,
  p_max_participants int default null
)
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_room public.rooms;
  i int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_title is null or btrim(p_title) = '' then raise exception 'TITLE_REQUIRED'; end if;
  if p_max_participants is not null and p_max_participants < 1 then
    raise exception 'BAD_LIMIT';
  end if;

  for i in 1..25 loop
    v_code := public.random_room_code();
    begin
      insert into public.rooms (code, title, description, max_participants, owner_id)
      values (
        v_code,
        btrim(p_title),
        nullif(btrim(coalesce(p_description, '')), ''),
        p_max_participants,
        v_uid
      )
      returning * into v_room;
      exit;
    exception when unique_violation then
      continue;
    end;
  end loop;

  if v_room.id is null then raise exception 'CODE_GENERATION_FAILED'; end if;

  insert into public.room_members (room_id, user_id, role)
  values (v_room.id, v_uid, 'owner');

  return v_room;
end;
$$;

create or replace function public.join_room(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
  v_voters int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_room from public.rooms where code = upper(btrim(p_code));
  if v_room.id is null then raise exception 'ROOM_NOT_FOUND'; end if;

  if exists (
    select 1 from public.room_members
    where room_id = v_room.id and user_id = v_uid
  ) then
    return v_room.id;
  end if;

  if v_room.max_participants is not null then
    select count(*) into v_voters
    from public.room_members
    where room_id = v_room.id and role = 'voter';

    if v_voters >= v_room.max_participants then
      raise exception 'ROOM_FULL';
    end if;
  end if;

  insert into public.room_members (room_id, user_id, role)
  values (v_room.id, v_uid, 'voter');

  return v_room.id;
end;
$$;

create or replace function public.update_room(
  p_room_id uuid,
  p_title text,
  p_description text,
  p_max_participants int
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_voters int;
begin
  if not public.is_room_admin(p_room_id) then raise exception 'NOT_AN_ADMIN'; end if;
  if p_title is null or btrim(p_title) = '' then raise exception 'TITLE_REQUIRED'; end if;
  if p_max_participants is not null and p_max_participants < 1 then
    raise exception 'BAD_LIMIT';
  end if;

  if p_max_participants is not null then
    select count(*) into v_voters
    from public.room_members
    where room_id = p_room_id and role = 'voter';

    if v_voters > p_max_participants then raise exception 'LIMIT_TOO_SMALL'; end if;
  end if;

  update public.rooms
     set title = btrim(p_title),
         description = nullif(btrim(coalesce(p_description, '')), ''),
         max_participants = p_max_participants
   where id = p_room_id;
end;
$$;

create or replace function public.delete_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.rooms
  where id = p_room_id and owner_id = auth.uid();

  if not found then raise exception 'NOT_THE_OWNER'; end if;
end;
$$;

create or replace function public.add_room_admin(p_room_id uuid, p_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  if not public.is_room_admin(p_room_id) then raise exception 'NOT_AN_ADMIN'; end if;

  select * into v_profile
  from public.profiles
  where lower(email) = lower(btrim(p_email))
  limit 1;

  if v_profile.id is null then raise exception 'USER_NOT_FOUND'; end if;

  -- Владельца не понижаем до админа.
  if exists (
    select 1 from public.room_members
    where room_id = p_room_id and user_id = v_profile.id and role = 'owner'
  ) then
    return v_profile.id;
  end if;

  insert into public.room_members (room_id, user_id, role)
  values (p_room_id, v_profile.id, 'admin')
  on conflict (room_id, user_id) do update set role = 'admin';

  return v_profile.id;
end;
$$;

-- Удаляет из комнаты админа или участника. Владельца удалить нельзя.
create or replace function public.remove_room_member(p_room_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_admins int;
begin
  if not public.is_room_admin(p_room_id) then raise exception 'NOT_AN_ADMIN'; end if;

  select role into v_role
  from public.room_members
  where room_id = p_room_id and user_id = p_user_id;

  if v_role is null then return; end if;
  if v_role = 'owner' then raise exception 'CANNOT_REMOVE_OWNER'; end if;

  if p_user_id = auth.uid() then
    -- Покинуть комнату можно, если в ней останется хотя бы один организатор.
    select count(*) into v_admins
    from public.room_members
    where room_id = p_room_id and role in ('owner', 'admin');

    if v_admins <= 1 then raise exception 'LAST_ADMIN'; end if;
  end if;

  delete from public.room_members
  where room_id = p_room_id and user_id = p_user_id;
end;
$$;

create or replace function public.leave_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.room_members
  where room_id = p_room_id and user_id = auth.uid() and role = 'voter';
end;
$$;

-- =====================================================================
-- ГОЛОСОВАНИЯ: ОПЕРАЦИИ
-- =====================================================================
create or replace function public.create_poll(
  p_room_id uuid,
  p_title text,
  p_description text,
  p_mode text,
  p_multi_select boolean,
  p_max_choices int,
  p_options text[],
  p_status text default 'draft'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_poll_id uuid;
  v_label text;
  v_sort int := 0;
  v_count int := 0;
begin
  if not public.is_room_admin(p_room_id) then raise exception 'NOT_AN_ADMIN'; end if;
  if p_title is null or btrim(p_title) = '' then raise exception 'TITLE_REQUIRED'; end if;
  if p_mode is null or p_mode not in ('anonymous', 'identified') then raise exception 'BAD_MODE'; end if;
  if p_status is null or p_status not in ('draft', 'open') then raise exception 'BAD_STATUS'; end if;
  if coalesce(array_length(p_options, 1), 0) < 2 then raise exception 'NOT_ENOUGH_OPTIONS'; end if;
  if p_multi_select and p_max_choices is not null and p_max_choices < 2 then
    raise exception 'BAD_MAX_CHOICES';
  end if;

  insert into public.polls (room_id, title, description, mode, multi_select, max_choices, status, created_by)
  values (
    p_room_id,
    btrim(p_title),
    nullif(btrim(coalesce(p_description, '')), ''),
    p_mode,
    p_multi_select,
    case when p_multi_select then p_max_choices else null end,
    p_status,
    v_uid
  )
  returning id into v_poll_id;

  foreach v_label in array p_options loop
    if btrim(coalesce(v_label, '')) = '' then continue; end if;
    v_sort := v_sort + 1;
    insert into public.poll_options (poll_id, label, sort_order)
    values (v_poll_id, btrim(v_label), v_sort);
    v_count := v_count + 1;
  end loop;

  if v_count < 2 then raise exception 'NOT_ENOUGH_OPTIONS'; end if;

  insert into public.poll_stats (poll_id) values (v_poll_id)
  on conflict (poll_id) do nothing;

  return v_poll_id;
end;
$$;

-- p_options: jsonb-массив вида [{"id": null, "label": "Вариант"}, ...]
create or replace function public.update_poll(
  p_poll_id uuid,
  p_title text,
  p_description text,
  p_mode text,
  p_multi_select boolean,
  p_max_choices int,
  p_options jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_poll public.polls;
  v_has_votes boolean;
  v_item jsonb;
  v_id uuid;
  v_idx int := 0;
  v_total int := 0;
begin
  select * into v_poll from public.polls where id = p_poll_id;
  if v_poll.id is null then raise exception 'POLL_NOT_FOUND'; end if;
  if not public.is_room_admin(v_poll.room_id) then raise exception 'NOT_AN_ADMIN'; end if;

  if p_title is null or btrim(p_title) = '' then raise exception 'TITLE_REQUIRED'; end if;
  if p_mode is null or p_mode not in ('anonymous', 'identified') then raise exception 'BAD_MODE'; end if;
  if p_options is null or jsonb_typeof(p_options) <> 'array' or jsonb_array_length(p_options) < 2 then
    raise exception 'NOT_ENOUGH_OPTIONS';
  end if;
  if p_multi_select and p_max_choices is not null and p_max_choices < 2 then
    raise exception 'BAD_MAX_CHOICES';
  end if;

  select exists (select 1 from public.votes where poll_id = p_poll_id) into v_has_votes;

  -- После первых голосов нельзя менять правила: это обесценило бы результаты.
  if v_has_votes and (
       v_poll.mode <> p_mode
       or v_poll.multi_select <> p_multi_select
       or coalesce(v_poll.max_choices, -1) <> coalesce(case when p_multi_select then p_max_choices else null end, -1)
     ) then
    raise exception 'LOCKED_AFTER_VOTES';
  end if;

  -- Нельзя удалить вариант, за который уже голосовали.
  if exists (
    select 1
    from public.poll_options o
    join public.votes v on v.option_id = o.id
    where o.poll_id = p_poll_id
      and not exists (
        select 1
        from jsonb_array_elements(p_options) e
        where e ->> 'id' = o.id::text
      )
  ) then
    raise exception 'OPTION_HAS_VOTES';
  end if;

  delete from public.poll_options o
  where o.poll_id = p_poll_id
    and not exists (
      select 1
      from jsonb_array_elements(p_options) e
      where e ->> 'id' = o.id::text
    );

  for v_item in select * from jsonb_array_elements(p_options) loop
    if btrim(coalesce(v_item ->> 'label', '')) = '' then continue; end if;
    v_idx := v_idx + 1;

    if v_item ->> 'id' is null or v_item ->> 'id' = '' then
      insert into public.poll_options (poll_id, label, sort_order)
      values (p_poll_id, btrim(v_item ->> 'label'), v_idx);
    else
      v_id := (v_item ->> 'id')::uuid;
      update public.poll_options
         set label = btrim(v_item ->> 'label'),
             sort_order = v_idx
       where id = v_id and poll_id = p_poll_id;
    end if;

    v_total := v_total + 1;
  end loop;

  if v_total < 2 then raise exception 'NOT_ENOUGH_OPTIONS'; end if;

  update public.polls
     set title = btrim(p_title),
         description = nullif(btrim(coalesce(p_description, '')), ''),
         mode = p_mode,
         multi_select = p_multi_select,
         max_choices = case when p_multi_select then p_max_choices else null end,
         updated_at = now()
   where id = p_poll_id;
end;
$$;

create or replace function public.set_poll_status(p_poll_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_poll public.polls;
  v_options int;
begin
  select * into v_poll from public.polls where id = p_poll_id;
  if v_poll.id is null then raise exception 'POLL_NOT_FOUND'; end if;
  if not public.is_room_admin(v_poll.room_id) then raise exception 'NOT_AN_ADMIN'; end if;
  if p_status is null or p_status not in ('draft', 'open', 'closed') then raise exception 'BAD_STATUS'; end if;

  if p_status = 'open' then
    select count(*) into v_options from public.poll_options where poll_id = p_poll_id;
    if v_options < 2 then raise exception 'NOT_ENOUGH_OPTIONS'; end if;
  end if;

  update public.polls
     set status = p_status,
         closed_at = case when p_status = 'closed' then now() else null end,
         updated_at = now()
   where id = p_poll_id;
end;
$$;

create or replace function public.delete_poll(p_poll_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room_id uuid;
begin
  select room_id into v_room_id from public.polls where id = p_poll_id;
  if v_room_id is null then return; end if;
  if not public.is_room_admin(v_room_id) then raise exception 'NOT_AN_ADMIN'; end if;

  delete from public.polls where id = p_poll_id;
end;
$$;

create or replace function public.cast_vote(p_poll_id uuid, p_option_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_poll public.polls;
  v_choices int;
  v_bad int;
  v_ids uuid[];
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_poll from public.polls where id = p_poll_id;
  if v_poll.id is null then raise exception 'POLL_NOT_FOUND'; end if;
  if not public.is_room_member(v_poll.room_id) then raise exception 'NOT_A_MEMBER'; end if;
  if v_poll.status <> 'open' then raise exception 'POLL_NOT_OPEN'; end if;

  v_ids := coalesce(p_option_ids, array[]::uuid[]);
  select count(distinct x) into v_choices from unnest(v_ids) as u(x);

  if not v_poll.multi_select and v_choices > 1 then raise exception 'SINGLE_CHOICE'; end if;
  if v_poll.multi_select and v_poll.max_choices is not null and v_choices > v_poll.max_choices then
    raise exception 'TOO_MANY_CHOICES';
  end if;

  select count(*) into v_bad
  from unnest(v_ids) as u(x)
  where not exists (
    select 1 from public.poll_options o
    where o.id = x and o.poll_id = p_poll_id
  );

  if v_bad > 0 then raise exception 'INVALID_OPTION'; end if;

  if not v_poll.allow_change
     and exists (select 1 from public.votes where poll_id = p_poll_id and user_id = v_uid) then
    raise exception 'ALREADY_VOTED';
  end if;

  delete from public.votes where poll_id = p_poll_id and user_id = v_uid;

  insert into public.votes (poll_id, option_id, user_id)
  select p_poll_id, x, v_uid
  from (select distinct u as x from unnest(v_ids) as u) t;
end;
$$;

-- Возвращает результаты только админам комнаты или после закрытия голосования.
create or replace function public.poll_results(p_poll_id uuid)
returns table (
  option_id uuid,
  label text,
  sort_order int,
  votes bigint,
  is_mine boolean,
  total_votes bigint,
  total_voters bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_poll public.polls;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_poll from public.polls where id = p_poll_id;
  if v_poll.id is null then raise exception 'POLL_NOT_FOUND'; end if;
  if not public.is_room_member(v_poll.room_id) then raise exception 'NOT_A_MEMBER'; end if;

  if v_poll.status <> 'closed' and not public.is_room_admin(v_poll.room_id) then
    raise exception 'RESULTS_HIDDEN';
  end if;

  return query
  select o.id,
         o.label,
         o.sort_order,
         count(v.id),
         exists (
           select 1 from public.votes mv
           where mv.poll_id = p_poll_id and mv.option_id = o.id and mv.user_id = v_uid
         ),
         (select count(*) from public.votes tv where tv.poll_id = p_poll_id),
         (select count(distinct tv.user_id) from public.votes tv where tv.poll_id = p_poll_id)
  from public.poll_options o
  left join public.votes v on v.option_id = o.id
  where o.poll_id = p_poll_id
  group by o.id, o.label, o.sort_order
  order by o.sort_order, o.label;
end;
$$;

-- Кто как голосовал — только для идентифицированных голосований и только админам.
create or replace function public.identified_ballots(p_poll_id uuid)
returns table (
  user_id uuid,
  full_name text,
  avatar_url text,
  option_id uuid,
  option_label text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_poll public.polls;
begin
  select * into v_poll from public.polls where id = p_poll_id;
  if v_poll.id is null then raise exception 'POLL_NOT_FOUND'; end if;
  if v_poll.mode <> 'identified' then raise exception 'NOT_IDENTIFIED'; end if;
  if not public.is_room_admin(v_poll.room_id) then raise exception 'NOT_AN_ADMIN'; end if;

  return query
  select v.user_id, p.full_name, p.avatar_url, v.option_id, o.label, v.created_at
  from public.votes v
  join public.profiles p on p.id = v.user_id
  join public.poll_options o on o.id = v.option_id
  where v.poll_id = p_poll_id
  order by coalesce(p.full_name, ''), o.sort_order;
end;
$$;

-- =====================================================================
-- ПРАВА
-- =====================================================================
revoke execute on all functions in schema public from anon;
revoke execute on all functions in schema public from public;
grant execute on all functions in schema public to authenticated;

-- =====================================================================
-- REALTIME
-- =====================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'poll_stats'
    ) then
      execute 'alter publication supabase_realtime add table public.poll_stats';
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'polls'
    ) then
      execute 'alter publication supabase_realtime add table public.polls';
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'poll_options'
    ) then
      execute 'alter publication supabase_realtime add table public.poll_options';
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_members'
    ) then
      execute 'alter publication supabase_realtime add table public.room_members';
    end if;
  end if;
end
$$;
