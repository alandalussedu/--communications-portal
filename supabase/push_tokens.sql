-- شغّل هذا مرة واحدة في Supabase → SQL Editor (جدول أجهزة الإشعارات لتطبيق iOS).
-- ---------------------------------------------------------------- push notifications (iOS app)
-- One row per device. A member reads, adds and removes only their own devices;
-- the send-push function (service role) reads them all to send.
create table if not exists public.push_tokens (
  token      text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  platform   text not null default 'ios',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_user on public.push_tokens(user_id);
alter table public.push_tokens enable row level security;
drop policy if exists push_tokens_own on public.push_tokens;
create policy push_tokens_own on public.push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_viewer());
