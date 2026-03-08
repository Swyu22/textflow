-- Enforce zero-retention chat rooms:
-- 1) destroying a room removes room rows, members, messages and event traces together
-- 2) chat event logging becomes a no-op
-- 3) join-attempt rate limiting keeps only a very short rolling window

create or replace function public.destroy_room(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted boolean := false;
begin
  if p_room_id is null then
    return false;
  end if;

  delete from public.chat_events
  where room_id = p_room_id;

  delete from public.rooms
  where id = p_room_id;

  v_deleted := found;
  return v_deleted;
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
begin
  -- no-op by design: temporary chat rooms must not leave a persistent event trail.
  return;
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

  delete from public.chat_join_attempts
  where attempted_at < now() - interval '2 minutes';

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

  return query select v_room_id, v_expires_at;
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

  if v_destroyed then
    perform public.destroy_room(p_room_id);
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
  v_removed_join_attempts int := 0;
  v_removed_events int := 0;
  v_room_id uuid;
begin
  with deleted_join_attempts as (
    delete from public.chat_join_attempts
    where attempted_at < now() - interval '2 minutes'
    returning 1
  )
  select count(*) into v_removed_join_attempts from deleted_join_attempts;

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

  delete from public.chat_events
  where true;
  get diagnostics v_removed_events = row_count;

  for v_room_id in
    select r.id
    from public.rooms r
    where r.expires_at <= now()
      or r.status <> 'active'
      or not exists (
        select 1
        from public.room_members rm
        where rm.room_id = r.id
      )
  loop
    if public.destroy_room(v_room_id) then
      v_removed_rooms := v_removed_rooms + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'removed_members', v_removed_members,
    'removed_rooms', v_removed_rooms,
    'removed_join_attempts', v_removed_join_attempts,
    'removed_events', v_removed_events,
    'ran_at', now()
  );
end;
$$;

delete from public.chat_events;
delete from public.chat_join_attempts
where attempted_at < now() - interval '2 minutes';
