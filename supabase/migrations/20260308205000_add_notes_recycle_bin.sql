alter table if exists public.notes
  add column if not exists deleted_at timestamptz;

comment on column public.notes.deleted_at is 'Null means active; non-null means moved to recycle bin.';

create index if not exists notes_deleted_at_created_at_idx
  on public.notes (deleted_at, created_at desc);
