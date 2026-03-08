create index if not exists notes_active_created_at_idx
  on public.notes (created_at desc)
  where deleted_at is null;

create index if not exists notes_trash_deleted_at_idx
  on public.notes (deleted_at desc)
  where deleted_at is not null;
