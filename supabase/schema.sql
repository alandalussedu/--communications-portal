-- مركز التواصل المؤسسي · قاعدة البيانات على Supabase
-- يُطبَّق على المشروع andalus-hub. آمن لإعادة التشغيل.
--
-- الأدوار (جدول members):
--   viewer : مسؤول تواصل، يرى كل الأقسام ومنها «الأداء والتطوير»، ولا يعدّل شيئًا
--   editor : فريق إدارة التواصل، يرى ويعدّل
--   owner  : مدير المنصة، كالمحرر ويدير المستخدمين (عبر الدالة admin-members)
-- الزائر بلا دخول يرى المجموعات العامة فقط.
-- الحماية في الخادم: قواعد RLS أدناه هي ما يقرر من يقرأ ماذا، لا الواجهة.

create table if not exists public.docs (
  collection text not null,
  id         text not null,
  data       jsonb not null,
  version    bigint not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (collection, id)
);

create table if not exists public.members (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  name       text not null,
  phone      text not null unique,
  role       text not null default 'viewer' check (role in ('viewer', 'editor', 'owner')),
  active     boolean not null default true,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid
);

-- المجموعات التي يراها الجميع بلا دخول
create or replace function public.public_collection(c text) returns boolean
  language sql immutable
  as $$ select c in ('files', 'settings', 'socialAccounts', 'socialReadings', 'events') $$;

create or replace function public.my_role() returns text
  language sql stable security definer set search_path = public
  as $$ select role from public.members where user_id = auth.uid() and active $$;

create or replace function public.is_viewer() returns boolean language sql stable as $$ select public.my_role() is not null $$;
create or replace function public.is_editor() returns boolean language sql stable as $$ select coalesce(public.my_role() in ('editor', 'owner'), false) $$;
create or replace function public.is_owner()  returns boolean language sql stable as $$ select coalesce(public.my_role() = 'owner', false) $$;

-- العضو يؤكد أنه غيّر كلمة المرور المؤقتة (لا يغيّر غير صفّه)
create or replace function public.password_changed() returns void
  language sql security definer set search_path = public
  as $$ update public.members set must_change_password = false where user_id = auth.uid() $$;

-- حالة العضو الحالي للواجهة
create or replace function public.me() returns table (name text, role text, must_change_password boolean)
  language sql stable security definer set search_path = public
  as $$ select name, role, must_change_password from public.members where user_id = auth.uid() and active $$;

-- كل تعديل يرفع رقم الإصدار ووقت التحديث
create or replace function public.docs_touch() returns trigger
  language plpgsql as $$
begin
  new.version    := coalesce(old.version, 0) + 1;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
drop trigger if exists docs_touch on public.docs;
create trigger docs_touch before update on public.docs for each row execute function public.docs_touch();

alter table public.docs    enable row level security;
alter table public.members enable row level security;

drop policy if exists docs_read   on public.docs;
drop policy if exists docs_insert on public.docs;
drop policy if exists docs_update on public.docs;
drop policy if exists docs_delete on public.docs;
create policy docs_read   on public.docs for select to anon, authenticated using (public.public_collection(collection) or public.is_viewer());
create policy docs_insert on public.docs for insert to authenticated with check (public.is_editor());
create policy docs_update on public.docs for update to authenticated using (public.is_editor()) with check (public.is_editor());
create policy docs_delete on public.docs for delete to authenticated using (public.is_editor());

-- جدول الأعضاء: العضو يرى صفّه، والمدير يرى الجميع. الكتابة عبر الدالة admin-members فقط.
drop policy if exists members_read on public.members;
create policy members_read on public.members for select to authenticated using (user_id = auth.uid() or public.is_owner());

revoke all on public.docs, public.members from anon, authenticated;
grant select on public.docs to anon, authenticated;
grant insert, update, delete on public.docs to authenticated;
grant select on public.members to authenticated;
revoke execute on function public.password_changed() from public, anon;
grant execute on function public.password_changed() to authenticated;
grant execute on function public.me(), public.is_viewer(), public.is_editor(), public.is_owner() to anon, authenticated;

-- التحديث الحي. مع RLS لا تحمل أحداث الحذف إلا المفتاح (collection, id).
alter table public.docs replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- النسخة الأولى من التصميم (تشفير بكلمة مرور مشتركة) لم تعد مستخدمة
drop table if exists public.editors cascade;
