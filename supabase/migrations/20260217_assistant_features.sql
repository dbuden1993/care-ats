-- Migration: Assistant Features (WhatsApp + Email + Outlook)
-- Run this in Supabase SQL editor

-- 1. Settings table (stores Outlook tokens and other key-value config)
create table if not exists settings (
  key text primary key,
  value text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Email messages table
create table if not exists email_messages (
  id uuid default gen_random_uuid() primary key,
  candidate_id uuid references candidates(id) on delete set null,
  message_id text unique,
  subject text,
  from_email text,
  from_name text,
  body_preview text,
  received_at timestamptz,
  direction text default 'inbound',
  ai_summary text,
  ai_intent text,
  ai_suggested_action text,
  thread_id text,
  created_at timestamptz default now()
);

create index if not exists email_messages_candidate_id_idx on email_messages(candidate_id);
create index if not exists email_messages_received_at_idx on email_messages(received_at desc);
create index if not exists email_messages_direction_idx on email_messages(direction);

-- 3. Add email column to candidates (for email-based matching)
alter table candidates add column if not exists email text;
create index if not exists candidates_email_idx on candidates(email);

-- 4. Enable RLS on new tables
alter table settings enable row level security;
alter table email_messages enable row level security;

-- RLS policies — use DO blocks so DROP doesn't error if table didn't exist yet
do $$ begin
  drop policy if exists "Allow authenticated read settings" on settings;
  drop policy if exists "Allow service role write settings" on settings;
exception when undefined_table then null;
end $$;

do $$ begin
  drop policy if exists "Allow authenticated read email_messages" on email_messages;
  drop policy if exists "Allow service role write email_messages" on email_messages;
exception when undefined_table then null;
end $$;

create policy "Allow authenticated read settings" on settings
  for select using (auth.role() = 'authenticated' or auth.role() = 'service_role');

create policy "Allow service role write settings" on settings
  for all using (auth.role() = 'service_role');

create policy "Allow authenticated read email_messages" on email_messages
  for select using (auth.role() = 'authenticated' or auth.role() = 'service_role');

create policy "Allow service role write email_messages" on email_messages
  for all using (auth.role() = 'service_role');

-- Note: whatsapp_messages table should already exist from previous migrations.
-- If not, this ensures the ai_suggested_action column exists:
alter table whatsapp_messages add column if not exists ai_intent text;
alter table whatsapp_messages add column if not exists ai_sentiment text;
alter table whatsapp_messages add column if not exists ai_suggested_action text;
