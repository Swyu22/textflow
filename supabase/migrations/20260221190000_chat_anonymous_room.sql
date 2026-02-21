-- TextFlow anonymous room-code chat MVP
-- Core guarantees:
-- 1) room expires hard at 1 hour
-- 2) non-members cannot read/write
-- 3) last member leave destroys room immediately
-- 4) join attempts rate limited (user + IP)

create extension if not exists pgcrypto;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code char(4) not null check (code ~ '^[0-9]{4}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 hour'),
  status text not null default 'active' check (status in ('active', 'closed'))
);

create table if not exists public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (room_id, user_id),
  check (nickname is null or char_length(btrim(nickname)) between 1 and 20)
);

create table if not exists public.messages (
  id bigserial primary key,
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (char_length(btrim(nickname)) between 1 and 20),
  content text not null check (char_length(btrim(content)) between 1 and 500),
  created_at timestamptz not null default now()
);

create table if not exists public.chat_join_attempts (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  ip inet,
  attempted_at timestamptz not null default now()
);

create table if not exists public.chat_events (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  room_id uuid references public.rooms(id) on delete set null,
  event_type text not null check (event_type in ('create', 'join', 'leave', 'expired', 'error')),
  event_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

drop index if exists idx_rooms_code_active_expires;

create unique index if not exists uq_rooms_code_active
  on public.rooms (code)
  where status = 'active';

create index if not exists idx_rooms_status_expires
  on public.rooms (status, expires_at desc);

create index if not exists idx_rooms_expires_at
  on public.rooms (expires_at);

create index if not exists idx_room_members_room_last_seen
  on public.room_members (room_id, last_seen_at);

create index if not exists idx_room_members_user_room
  on public.room_members (user_id, room_id);

create index if not exists idx_messages_room_created
  on public.messages (room_id, created_at asc);

create index if not exists idx_chat_join_attempts_user_time
  on public.chat_join_attempts (user_id, attempted_at desc);

create index if not exists idx_chat_join_attempts_ip_time
  on public.chat_join_attempts (ip, attempted_at desc);

create index if not exists idx_chat_events_room_time
  on public.chat_events (room_id, created_at desc);

create index if not exists idx_chat_events_type_time
  on public.chat_events (event_type, created_at desc);

create or replace function public.chat_request_ip()
returns inet
language plpgsql
stable
set search_path = public
as $$
declare
  v_headers jsonb;
  v_forwarded text;
  v_first_ip text;
begin
  begin
    v_headers := current_setting('request.headers', true)::jsonb;
  exception
    when others then v_headers := '{}'::jsonb;
  end;

  v_forwarded := coalesce(
    v_headers ->> 'x-forwarded-for',
    v_headers ->> 'x-real-ip',
    ''
  );

  if btrim(v_forwarded) = '' then
    return null;
  end if;

  v_first_ip := btrim(split_part(v_forwarded, ',', 1));

  begin
    return v_first_ip::inet;
  exception
    when others then return null;
  end;
end;
$$;

create or replace function public.log_chat_event(
  p_event_type text,
  p_room_id uuid default null,
  p_event_meta jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_event_type text := lower(btrim(coalesce(p_event_type, '')));
begin
  if v_event_type not in ('create', 'join', 'leave', 'expired', 'error') then
    raise exception 'INVALID_EVENT_TYPE';
  end if;

  insert into public.chat_events (user_id, room_id, event_type, event_meta)
  values (v_user_id, p_room_id, v_event_type, coalesce(p_event_meta, '{}'::jsonb));
end;
$$;

create or replace function public.create_room()
returns table (room_id uuid, room_code char(4), expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_try_count int := 0;
  v_code char(4);
  v_room_id uuid;
  v_expires_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  update public.rooms r
  set status = 'closed'
  where r.status = 'active'
    and r.expires_at <= now();

  while v_try_count < 30 loop
    v_try_count := v_try_count + 1;
    v_code := lpad((floor(random() * 10000)::int)::text, 4, '0')::char(4);

    v_room_id := null;
    v_expires_at := null;

    begin
      insert into public.rooms as r (code, created_at, expires_at, status)
      values (v_code, now(), now() + interval '1 hour', 'active')
      returning r.id, r.expires_at
        into v_room_id, v_expires_at;
    exception
      when unique_violation then
        v_room_id := null;
    end;

    if v_room_id is not null then
      insert into public.room_members (room_id, user_id, nickname, joined_at, last_seen_at)
      values (v_room_id, v_user_id, null, now(), now())
      on conflict on constraint room_members_pkey
      do update set last_seen_at = excluded.last_seen_at;

      perform public.log_chat_event('create', v_room_id, jsonb_build_object('room_code', v_code));
      return query select v_room_id, v_code, v_expires_at;
      return;
    end if;
  end loop;

  raise exception 'ROOM_CREATE_RETRY_EXCEEDED';
end;
$$;

create or replace function public.join_room(p_code text)
returns table (room_id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_ip inet := public.chat_request_ip();
  v_code text := btrim(coalesce(p_code, ''));
  v_user_attempts int;
  v_ip_attempts int;
  v_room_id uuid;
  v_expires_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if v_code !~ '^[0-9]{4}$' then
    raise exception 'INVALID_ROOM_CODE';
  end if;

  select count(*)
    into v_user_attempts
  from public.chat_join_attempts a
  where a.user_id = v_user_id
    and a.attempted_at > now() - interval '1 minute';

  if v_user_attempts >= 10 then
    raise exception 'JOIN_RATE_LIMIT_USER';
  end if;

  if v_ip is not null then
    select count(*)
      into v_ip_attempts
    from public.chat_join_attempts a
    where a.ip = v_ip
      and a.attempted_at > now() - interval '1 minute';

    if v_ip_attempts >= 10 then
      raise exception 'JOIN_RATE_LIMIT_IP';
    end if;
  end if;

  insert into public.chat_join_attempts (user_id, ip, attempted_at)
  values (v_user_id, v_ip, now());

  select r.id, r.expires_at
    into v_room_id, v_expires_at
  from public.rooms r
  where r.code = v_code
    and r.status = 'active'
    and r.expires_at > now()
  order by r.created_at desc
  limit 1;

  if v_room_id is null then
    raise exception 'ROOM_NOT_FOUND_OR_EXPIRED';
  end if;

  insert into public.room_members (room_id, user_id, nickname, joined_at, last_seen_at)
  values (v_room_id, v_user_id, null, now(), now())
  on conflict on constraint room_members_pkey
  do update set last_seen_at = excluded.last_seen_at;

  perform public.log_chat_event('join', v_room_id, jsonb_build_object('room_code', v_code));
  return query select v_room_id, v_expires_at;
end;
$$;

create or replace function public.set_nickname(p_room_id uuid, p_nickname text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_nickname text := btrim(coalesce(p_nickname, ''));
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if char_length(v_nickname) < 1 or char_length(v_nickname) > 20 then
    raise exception 'INVALID_NICKNAME';
  end if;

  update public.room_members rm
  set nickname = v_nickname,
      last_seen_at = now()
  from public.rooms r
  where rm.room_id = p_room_id
    and rm.user_id = v_user_id
    and r.id = rm.room_id
    and r.status = 'active'
    and r.expires_at > now();

  if not found then
    raise exception 'ROOM_MEMBER_NOT_FOUND_OR_EXPIRED';
  end if;
end;
$$;

create or replace function public.send_message(p_room_id uuid, p_content text)
returns table (id bigint, room_id uuid, nickname text, content text, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_nickname text;
  v_content text := btrim(coalesce(p_content, ''));
  v_id bigint;
  v_created_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if char_length(v_content) < 1 or char_length(v_content) > 500 then
    raise exception 'INVALID_MESSAGE_LENGTH';
  end if;

  select rm.nickname
    into v_nickname
  from public.room_members rm
  join public.rooms r on r.id = rm.room_id
  where rm.room_id = p_room_id
    and rm.user_id = v_user_id
    and r.status = 'active'
    and r.expires_at > now();

  if v_nickname is null or btrim(v_nickname) = '' then
    raise exception 'NICKNAME_REQUIRED';
  end if;

  insert into public.messages (room_id, user_id, nickname, content, created_at)
  values (p_room_id, v_user_id, v_nickname, v_content, now())
  returning messages.id, messages.created_at
    into v_id, v_created_at;

  return query
    select v_id, p_room_id, v_nickname, v_content, v_created_at;
end;
$$;

create or replace function public.touch_member(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  update public.room_members rm
  set last_seen_at = now()
  from public.rooms r
  where rm.room_id = p_room_id
    and rm.user_id = v_user_id
    and r.id = rm.room_id
    and r.status = 'active'
    and r.expires_at > now();
end;
$$;

create or replace function public.leave_room(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_destroyed boolean := false;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  delete from public.room_members rm
  where rm.room_id = p_room_id
    and rm.user_id = v_user_id;

  if not found then
    return false;
  end if;

  v_destroyed := not exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
  );

  perform public.log_chat_event(
    'leave',
    p_room_id,
    jsonb_build_object('room_destroyed', v_destroyed)
  );

  if v_destroyed then
    delete from public.rooms r where r.id = p_room_id;
  end if;

  return v_destroyed;
end;
$$;

create or replace function public.purge_chat()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_removed_members int := 0;
  v_removed_rooms int := 0;
begin
  with deleted_members as (
    delete from public.room_members rm
    using public.rooms r
    where rm.room_id = r.id
      and (
        rm.last_seen_at < now() - interval '2 minutes'
        or r.expires_at <= now()
        or r.status <> 'active'
      )
    returning 1
  )
  select count(*) into v_removed_members from deleted_members;

  with deleted_rooms as (
    delete from public.rooms r
    where r.expires_at <= now()
      or r.status <> 'active'
      or not exists (
        select 1
        from public.room_members rm
        where rm.room_id = r.id
      )
    returning 1
  )
  select count(*) into v_removed_rooms from deleted_rooms;

  return jsonb_build_object(
    'removed_members', v_removed_members,
    'removed_rooms', v_removed_rooms,
    'ran_at', now()
  );
end;
$$;

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.messages enable row level security;
alter table public.chat_join_attempts enable row level security;
alter table public.chat_events enable row level security;

drop policy if exists "chat_rooms_member_select_active" on public.rooms;
create policy "chat_rooms_member_select_active"
on public.rooms
for select
to authenticated
using (
  status = 'active'
  and expires_at > now()
  and exists (
    select 1
    from public.room_members rm
    where rm.room_id = rooms.id
      and rm.user_id = auth.uid()
  )
);

drop policy if exists "chat_room_members_select_self_active" on public.room_members;
create policy "chat_room_members_select_self_active"
on public.room_members
for select
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.rooms r
    where r.id = room_members.room_id
      and r.status = 'active'
      and r.expires_at > now()
  )
);

drop policy if exists "chat_messages_member_select_active" on public.messages;
create policy "chat_messages_member_select_active"
on public.messages
for select
to authenticated
using (
  exists (
    select 1
    from public.room_members rm
    join public.rooms r on r.id = rm.room_id
    where rm.room_id = messages.room_id
      and rm.user_id = auth.uid()
      and r.status = 'active'
      and r.expires_at > now()
  )
);

revoke all on public.rooms from anon, authenticated;
revoke all on public.room_members from anon, authenticated;
revoke all on public.messages from anon, authenticated;
revoke all on public.chat_join_attempts from anon, authenticated;
revoke all on public.chat_events from anon, authenticated;

grant select on public.rooms to authenticated;
grant select on public.room_members to authenticated;
grant select on public.messages to authenticated;

revoke all on function public.log_chat_event(text, uuid, jsonb) from public;
revoke all on function public.create_room() from public;
revoke all on function public.join_room(text) from public;
revoke all on function public.set_nickname(uuid, text) from public;
revoke all on function public.send_message(uuid, text) from public;
revoke all on function public.touch_member(uuid) from public;
revoke all on function public.leave_room(uuid) from public;
revoke all on function public.purge_chat() from public;

grant execute on function public.log_chat_event(text, uuid, jsonb) to authenticated;
grant execute on function public.create_room() to authenticated;
grant execute on function public.join_room(text) to authenticated;
grant execute on function public.set_nickname(uuid, text) to authenticated;
grant execute on function public.send_message(uuid, text) to authenticated;
grant execute on function public.touch_member(uuid) to authenticated;
grant execute on function public.leave_room(uuid) to authenticated;

do $$
begin
  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    return;
  end if;

  execute 'alter publication supabase_realtime add table public.messages';
exception
  when undefined_table then null;
  when duplicate_object then null;
end;
$$;

do $$
declare
  v_job_id bigint;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    return;
  end if;

  for v_job_id in
    select jobid
    from cron.job
    where jobname = 'purge-chat-every-minute'
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    'purge-chat-every-minute',
    '* * * * *',
    $cron$select public.purge_chat();$cron$
  );
exception
  when undefined_table then null;
end;
$$;
