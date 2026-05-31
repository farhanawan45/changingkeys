-- Create reminders table for quote and booking follow-ups
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  quote_id uuid references public.quotes(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete cascade,
  type text not null,
  status text default 'pending',
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists reminders_status_scheduled_for_idx
  on public.reminders (status, scheduled_for);

create index if not exists reminders_quote_id_type_idx
  on public.reminders (quote_id, type);

create index if not exists reminders_booking_id_type_idx
  on public.reminders (booking_id, type);

create index if not exists reminders_lead_id_idx
  on public.reminders (lead_id);
