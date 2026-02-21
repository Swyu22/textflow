-- Fix production RLS recursion:
-- rooms policy references room_members and room_members policy referenced rooms.
-- That circular dependency caused "infinite recursion detected in policy".

drop policy if exists "chat_room_members_select_self_active" on public.room_members;

create policy "chat_room_members_select_self_active"
on public.room_members
for select
to authenticated
using (
  user_id = auth.uid()
);
