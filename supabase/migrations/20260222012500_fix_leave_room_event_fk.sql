-- Fix production bug:
-- leave_room() inserted chat event after deleting room, violating chat_events.room_id FK.
-- This caused transaction rollback and prevented real room destruction.

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
