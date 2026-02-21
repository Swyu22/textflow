-- Fix production error:
-- column reference "expires_at" is ambiguous in create_room()
-- Root cause: output column name (expires_at) conflicted with rooms.expires_at.

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
      on conflict (room_id, user_id)
      do update set last_seen_at = excluded.last_seen_at;

      perform public.log_chat_event('create', v_room_id, jsonb_build_object('room_code', v_code));
      return query select v_room_id, v_code, v_expires_at;
      return;
    end if;
  end loop;

  raise exception 'ROOM_CREATE_RETRY_EXCEEDED';
end;
$$;
