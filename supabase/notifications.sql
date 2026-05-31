create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  type text default 'lead',
  is_read boolean default false,
  created_at timestamptz default now(),
  lead_id uuid nullable
);

create index if not exists notifications_is_read_created_at_idx
  on public.notifications (is_read, created_at desc);

create index if not exists notifications_lead_id_idx
  on public.notifications (lead_id);
