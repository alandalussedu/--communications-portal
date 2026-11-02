-- مركز التواصل المؤسسي · قاعدة البيانات على Supabase
-- شغّل هذا الملف مرة واحدة من SQL Editor في مشروع Supabase.
--
-- التصميم: جدول واحد يحفظ كل مستند كما كان في قاعدة المنصة على Claude
-- (collection + id + data). المجموعات المحمية تبقى مشفّرة من المتصفح
-- بالشكل {"enc":{...}}، فالقاعدة لا ترى نصّها أبدًا.

create table if not exists public.docs (
  collection text not null,
  id         text not null,
  data       jsonb not null,
  version    bigint not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (collection, id)
);

-- المحررون: يُضاف المستخدم هنا بعد إنشاء حسابه في Authentication.
-- role = 'owner' لصاحب المنصة (يدير مفتاح التشفير)، و'editor' لبقية المحررين.
create table if not exists public.editors (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role    text not null default 'editor' check (role in ('editor', 'owner')),
  note    text
);

create or replace function public.is_editor() returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from public.editors where user_id = auth.uid()) $$;

create or replace function public.is_owner() returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from public.editors where user_id = auth.uid() and role = 'owner') $$;

-- كل تعديل يرفع رقم الإصدار ووقت التحديث.
create or replace function public.docs_touch() returns trigger
  language plpgsql as $$
begin
  new.version    := coalesce(old.version, 0) + 1;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

drop trigger if exists docs_touch on public.docs;
create trigger docs_touch before update on public.docs
  for each row execute function public.docs_touch();

alter table public.docs    enable row level security;
alter table public.editors enable row level security;

-- القراءة للجميع (المحمي مشفّر)، عدا مفتاح الإعداد الأولي فلا يقرؤه إلا المالك.
drop policy if exists docs_read on public.docs;
create policy docs_read on public.docs for select to anon, authenticated
  using (collection <> 'vaultSetup' or public.is_owner());

-- الكتابة للمحررين، ومستندات المفتاح للمالك فقط.
drop policy if exists docs_insert on public.docs;
create policy docs_insert on public.docs for insert to authenticated
  with check (case when collection in ('vault', 'vaultSetup') then public.is_owner() else public.is_editor() end);

drop policy if exists docs_update on public.docs;
create policy docs_update on public.docs for update to authenticated
  using      (case when collection in ('vault', 'vaultSetup') then public.is_owner() else public.is_editor() end)
  with check (case when collection in ('vault', 'vaultSetup') then public.is_owner() else public.is_editor() end);

drop policy if exists docs_delete on public.docs;
create policy docs_delete on public.docs for delete to authenticated
  using (case when collection in ('vault', 'vaultSetup') then public.is_owner() else public.is_editor() end);

-- كل مستخدم يرى صفّه فقط في جدول المحررين.
drop policy if exists editors_self on public.editors;
create policy editors_self on public.editors for select to authenticated
  using (user_id = auth.uid());

grant select on public.docs to anon, authenticated;
grant insert, update, delete on public.docs to authenticated;
grant select on public.editors to authenticated;
grant execute on function public.is_editor(), public.is_owner() to anon, authenticated;

-- التحديث الحي: الصفحات المفتوحة ترى التعديلات فورًا.
alter table public.docs replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;
