-- This is a bootstrap migration for a private library. It deliberately does
-- not modify the old global schema: an existing table may contain unowned data
-- and needs a separately reviewed migration/backfill plan.
do $$
begin
  if to_regclass('public.documents') is not null
     or to_regclass('public.document_chunks') is not null then
    raise exception 'Legacy documents must be assigned or removed manually';
  end if;
end $$;

create table public.documents (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  title text not null,
  filename text not null,
  file_hash text not null,
  file_size_bytes integer not null,
  subject text,
  doc_type text,
  status text not null,
  page_count integer not null default 0,
  chunk_count integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_owner_file_hash_key unique (owner_id, file_hash)
);

create table public.document_chunks (
  id text primary key,
  document_id uuid not null references public.documents(id) on delete cascade,
  content text not null,
  metadata jsonb not null default '{}'::jsonb
);

create index documents_owner_created_at_idx
  on public.documents (owner_id, created_at desc);
create index document_chunks_document_id_idx
  on public.document_chunks (document_id);

alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;

create policy "owner documents"
  on public.documents
  for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "owner document chunks"
  on public.document_chunks
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.documents
      where documents.id = document_chunks.document_id
        and documents.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.documents
      where documents.id = document_chunks.document_id
        and documents.owner_id = auth.uid()
    )
  );

insert into storage.buckets (id, name, public)
values ('study-documents', 'study-documents', false)
on conflict (id) do update set public = false;

create policy "owner study documents"
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'study-documents'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and array_length(storage.foldername(name), 1) >= 2
    and exists (
      select 1
      from public.documents
      where documents.owner_id = auth.uid()
        and documents.id::text = (storage.foldername(name))[2]
    )
  )
  with check (
    bucket_id = 'study-documents'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and array_length(storage.foldername(name), 1) >= 2
    and exists (
      select 1
      from public.documents
      where documents.owner_id = auth.uid()
        and documents.id::text = (storage.foldername(name))[2]
    )
  );
