-- Fix production error:
-- column reference "room_id" is ambiguous in create_room()/join_room()
-- Root cause: OUT parameter room_id conflicts with ON CONFLICT column list.

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
