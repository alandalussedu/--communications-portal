-- «النقل المدرسي»: الأحياء المعتمدة لخدمة النقل لكل مجمع، بنسخ تاريخية.
-- إضافة مستقلة: لا تمسّ جداول المنصة الأخرى. آمن لإعادة التشغيل.
--
-- القراءة العامة: النسخة المنشورة فقط (transport_public). الكتابة: لا أحد مباشرة؛
-- الرفع والاعتماد والاسترجاع عبر دوال يتحقق كلٌّ منها من أن المنادي مدير المنصة (is_owner).

create extension if not exists pgcrypto;

/* ------------------------------------------------------------ الجداول */
create table if not exists public.transport_years (
  id uuid primary key default gen_random_uuid(),
  year_name text not null unique,                       -- 2026/2027
  is_active boolean not null default false,
  publication_status text not null default 'draft' check (publication_status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists public.transport_cities (
  id uuid primary key default gen_random_uuid(),
  city_name text not null unique,
  slug text not null unique
);

create table if not exists public.transport_campuses (
  id uuid primary key default gen_random_uuid(),
  campus_name text not null,
  normalized_name text not null unique,
  city_id uuid references public.transport_cities(id),   -- مدينته في آخر نسخة منشورة
  is_active boolean not null default true
);

create table if not exists public.transport_districts (
  id uuid primary key default gen_random_uuid(),
  district_name text not null,
  normalized_name text not null,
  city_id uuid not null references public.transport_cities(id),
  latitude double precision,                             -- تبقى فارغة حتى تتوفر بيانات جغرافية موثوقة
  longitude double precision,
  geojson_reference text,
  unique (city_id, normalized_name)
);

create table if not exists public.transport_imports (
  id uuid primary key default gen_random_uuid(),
  version int generated always as identity,
  academic_year_id uuid references public.transport_years(id),
  year_name text not null,
  file_name text not null,
  file_size int,
  file_storage_path text,
  notes text,
  uploaded_by uuid,
  uploaded_at timestamptz not null default now(),
  status text not null check (status in ('invalid', 'draft', 'published', 'superseded', 'rejected')),
  is_live boolean not null default false,
  validation_report jsonb not null default '{}'::jsonb,
  payload jsonb not null,                                -- البيانات كما استُخرجت من الملف
  published_at timestamptz,
  published_by uuid
);
create unique index if not exists transport_one_live on public.transport_imports (is_live) where is_live;

-- حالة كل مجمع في كل نسخة (اسمه ومدينته وقتها)
create table if not exists public.transport_import_campuses (
  import_id uuid not null references public.transport_imports(id) on delete cascade,
  campus_id uuid not null references public.transport_campuses(id),
  city_id uuid not null references public.transport_cities(id),
  campus_name text not null,
  sort int not null,
  primary key (import_id, campus_id)
);

create table if not exists public.transport_coverage (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.transport_imports(id) on delete cascade,
  academic_year_id uuid not null references public.transport_years(id),
  campus_id uuid not null references public.transport_campuses(id),
  district_id uuid not null references public.transport_districts(id),
  original_district_name text not null,                  -- كما ورد في الملف حرفيًا
  sort int not null
);
create index if not exists transport_coverage_import on public.transport_coverage (import_id, campus_id);

create table if not exists public.transport_audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  action text not null,                                  -- upload | publish | restore | reject
  import_id uuid,
  details jsonb not null default '{}'::jsonb
);

/* ------------------------------------------------------------ أدوات */
-- مطابقة الأسماء العربية: الهمزات، التاء المربوطة، الألف المقصورة، التطويل، التشكيل، المسافات والرموز
create or replace function public.transport_norm(t text) returns text
  language sql immutable as $$
  select btrim(regexp_replace(
    translate(
      regexp_replace(lower(coalesce(t, '')), '[ـً-ْٰ]', '', 'g'),
      'أإآٱةىؤئ', 'ااااهيوي'),
    '[^0-9a-zء-ي]+', ' ', 'g'))
$$;

create or replace function public.transport_live_import() returns uuid
  language sql stable security definer set search_path = public
  as $$ select id from public.transport_imports where is_live $$;

/* ------------------------------------------------------------ الصلاحيات */
alter table public.transport_years           enable row level security;
alter table public.transport_cities          enable row level security;
alter table public.transport_campuses        enable row level security;
alter table public.transport_districts       enable row level security;
alter table public.transport_imports         enable row level security;
alter table public.transport_import_campuses enable row level security;
alter table public.transport_coverage        enable row level security;
alter table public.transport_audit           enable row level security;

-- لا سياسات كتابة لأي دور: الكتابة عبر الدوال أدناه فقط.
drop policy if exists transport_years_read on public.transport_years;
create policy transport_years_read on public.transport_years for select to anon, authenticated using (publication_status = 'published' or public.is_owner());
drop policy if exists transport_cities_read on public.transport_cities;
create policy transport_cities_read on public.transport_cities for select to anon, authenticated using (true);
drop policy if exists transport_campuses_read on public.transport_campuses;
create policy transport_campuses_read on public.transport_campuses for select to anon, authenticated using (true);
drop policy if exists transport_districts_read on public.transport_districts;
create policy transport_districts_read on public.transport_districts for select to anon, authenticated using (true);
drop policy if exists transport_ic_read on public.transport_import_campuses;
create policy transport_ic_read on public.transport_import_campuses for select to anon, authenticated using (import_id = public.transport_live_import() or public.is_owner());
drop policy if exists transport_coverage_read on public.transport_coverage;
create policy transport_coverage_read on public.transport_coverage for select to anon, authenticated using (import_id = public.transport_live_import() or public.is_owner());
drop policy if exists transport_imports_read on public.transport_imports;
create policy transport_imports_read on public.transport_imports for select to authenticated using (public.is_owner());
drop policy if exists transport_audit_read on public.transport_audit;
create policy transport_audit_read on public.transport_audit for select to authenticated using (public.is_owner());

/* ------------------------------------------------------------ المنطق الداخلي (غير مكشوف للواجهة) */
create schema if not exists transport_internal;
revoke all on schema transport_internal from public, anon, authenticated;

-- يتحقق من البيانات المستخرجة ويحفظها مسودة. لا ينشر شيئًا.
create or replace function transport_internal.create_import(actor uuid, p_year text, p_file_name text, p_file_size int, p_file_path text, p_notes text, p_payload jsonb)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  errs jsonb := '[]'::jsonb; warns jsonb := '[]'::jsonb;
  c jsonb; d text; n_campuses int := 0; n_entries int := 0; seen text[] := '{}'; dseen text[]; nm text; city text; k int; y1 int; y2 int;
  new_id uuid;
begin
  if p_file_name is null or p_file_name !~* '\.(xlsx|xls)$' then errs := errs || jsonb_build_array('امتداد الملف غير مقبول (المقبول: xlsx و xls).'); end if;
  if coalesce(p_file_size, 0) > 5 * 1024 * 1024 then errs := errs || jsonb_build_array('حجم الملف أكبر من 5 ميجابايت.'); end if;
  if p_year is null or p_year !~ '^\d{4}/\d{4}$' then
    errs := errs || jsonb_build_array('العام الدراسي غير صحيح. الصيغة: 2026/2027.');
  else
    y1 := split_part(p_year, '/', 1)::int; y2 := split_part(p_year, '/', 2)::int;
    if y2 <> y1 + 1 or y1 < 2020 or y1 > 2100 then errs := errs || jsonb_build_array('العام الدراسي غير صحيح: السنتان يجب أن تكونا متتاليتين.'); end if;
  end if;
  if octet_length(p_payload::text) > 2 * 1024 * 1024 then errs := errs || jsonb_build_array('البيانات المستخرجة أكبر من المسموح.'); end if;
  if jsonb_typeof(p_payload -> 'campuses') is distinct from 'array' or jsonb_array_length(p_payload -> 'campuses') = 0 then
    errs := errs || jsonb_build_array('لم تُوجد مجمعات في الملف.');
  elsif jsonb_array_length(p_payload -> 'campuses') > 80 then
    errs := errs || jsonb_build_array('عدد المجمعات أكبر من المسموح (80).');
  else
    for c in select * from jsonb_array_elements(p_payload -> 'campuses') loop
      n_campuses := n_campuses + 1;
      nm := btrim(coalesce(c ->> 'name', '')); city := btrim(coalesce(c ->> 'city', ''));
      if nm = '' or public.transport_norm(nm) = '' then errs := errs || jsonb_build_array(format('المجمع رقم %s بلا اسم.', n_campuses)); continue; end if;
      if length(nm) > 200 then errs := errs || jsonb_build_array(format('اسم المجمع رقم %s أطول من المسموح.', n_campuses)); end if;
      if public.transport_norm(nm) = any (seen) then errs := errs || jsonb_build_array(format('المجمع «%s» مكرر.', nm)); end if;
      seen := seen || public.transport_norm(nm);
      if city = '' then errs := errs || jsonb_build_array(format('المجمع «%s» بلا مدينة.', nm)); end if;
      if jsonb_typeof(c -> 'districts') is distinct from 'array' or jsonb_array_length(c -> 'districts') = 0 then
        errs := errs || jsonb_build_array(format('المجمع «%s» بلا أحياء.', nm)); continue;
      end if;
      if jsonb_array_length(c -> 'districts') > 600 then errs := errs || jsonb_build_array(format('أحياء المجمع «%s» أكثر من المسموح (600).', nm)); continue; end if;
      dseen := '{}'; k := 0;
      for d in select * from jsonb_array_elements_text(c -> 'districts') loop
        k := k + 1; n_entries := n_entries + 1;
        if public.transport_norm(d) = '' then errs := errs || jsonb_build_array(format('حي فارغ أو غير مقروء في «%s» (الترتيب %s).', nm, k));
        elsif length(d) > 150 then errs := errs || jsonb_build_array(format('اسم حي أطول من المسموح في «%s» (الترتيب %s).', nm, k));
        elsif public.transport_norm(d) = any (dseen) then warns := warns || jsonb_build_array(format('الحي «%s» مكرر داخل «%s»؛ سيُحفظ مرة واحدة.', btrim(d), nm));
        end if;
        dseen := dseen || public.transport_norm(d);
      end loop;
    end loop;
  end if;

  insert into public.transport_imports (year_name, file_name, file_size, file_storage_path, notes, uploaded_by, status, validation_report, payload)
  values (coalesce(p_year, ''), coalesce(p_file_name, ''), p_file_size, p_file_path, nullif(btrim(coalesce(p_notes, '')), ''), actor,
          case when jsonb_array_length(errs) = 0 then 'draft' else 'invalid' end,
          jsonb_build_object('errors', errs, 'warnings', warns, 'stats', jsonb_build_object('campuses', n_campuses, 'entries', n_entries), 'checkedAt', now()),
          p_payload)
  returning id into new_id;
  insert into public.transport_audit (actor, action, import_id, details) values (actor, 'upload', new_id, jsonb_build_object('file', p_file_name, 'year', p_year, 'errors', jsonb_array_length(errs)));
  return jsonb_build_object('id', new_id, 'status', case when jsonb_array_length(errs) = 0 then 'draft' else 'invalid' end, 'errors', errs, 'warnings', warns);
end $$;

-- يجعل نسخة هي المنشورة. النسخ السابقة تبقى في السجل.
create or replace function transport_internal.set_live(actor uuid, p_import uuid, p_action text)
  returns void language plpgsql security definer set search_path = public as $$
declare yid uuid;
begin
  select academic_year_id into yid from public.transport_imports where id = p_import;
  update public.transport_imports set is_live = false, status = 'superseded' where is_live and id <> p_import;
  update public.transport_imports set is_live = true, status = 'published',
         published_at = case when p_action = 'publish' then now() else published_at end,
         published_by = case when p_action = 'publish' then actor else published_by end
   where id = p_import;
  update public.transport_years set is_active = (id = yid);
  update public.transport_years set publication_status = 'published', published_at = coalesce(published_at, now()) where id = yid;
  -- مدينة المجمع الحالية = مدينته في النسخة المنشورة
  update public.transport_campuses c set city_id = ic.city_id, campus_name = ic.campus_name
    from public.transport_import_campuses ic where ic.import_id = p_import and ic.campus_id = c.id;
  insert into public.transport_audit (actor, action, import_id) values (actor, p_action, p_import);
end $$;

create or replace function transport_internal.publish(actor uuid, p_import uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare
  imp public.transport_imports; yid uuid; c jsonb; d text; cid uuid; campus uuid; did uuid; i int := 0; k int; dseen text[]; nm text; city text;
begin
  select * into imp from public.transport_imports where id = p_import for update;
  if imp.id is null then raise exception 'النسخة غير موجودة'; end if;
  if imp.status <> 'draft' then raise exception 'لا تُنشر إلا نسخة اجتازت التحقق ولم تُنشر من قبل'; end if;

  insert into public.transport_years (year_name) values (imp.year_name) on conflict (year_name) do nothing;
  select id into yid from public.transport_years where year_name = imp.year_name;
  update public.transport_imports set academic_year_id = yid where id = p_import;

  for c in select * from jsonb_array_elements(imp.payload -> 'campuses') loop
    i := i + 1;
    nm := btrim(regexp_replace(c ->> 'name', '\s+', ' ', 'g')); city := btrim(regexp_replace(c ->> 'city', '\s+', ' ', 'g'));
    insert into public.transport_cities (city_name, slug) values (city, 'c' || substr(md5(public.transport_norm(city)), 1, 10)) on conflict (city_name) do nothing;
    select id into cid from public.transport_cities where city_name = city;
    insert into public.transport_campuses (campus_name, normalized_name, city_id) values (nm, public.transport_norm(nm), cid) on conflict (normalized_name) do nothing;
    select id into campus from public.transport_campuses where normalized_name = public.transport_norm(nm);
    insert into public.transport_import_campuses (import_id, campus_id, city_id, campus_name, sort) values (p_import, campus, cid, nm, i);
    dseen := '{}'; k := 0;
    for d in select * from jsonb_array_elements_text(c -> 'districts') loop
      continue when public.transport_norm(d) = any (dseen);
      dseen := dseen || public.transport_norm(d); k := k + 1;
      insert into public.transport_districts (district_name, normalized_name, city_id)
        values (btrim(regexp_replace(d, '\s+', ' ', 'g')), public.transport_norm(d), cid) on conflict (city_id, normalized_name) do nothing;
      select id into did from public.transport_districts where city_id = cid and normalized_name = public.transport_norm(d);
      insert into public.transport_coverage (import_id, academic_year_id, campus_id, district_id, original_district_name, sort)
        values (p_import, yid, campus, did, btrim(regexp_replace(d, '\s+', ' ', 'g')), k);
    end loop;
  end loop;
  perform transport_internal.set_live(actor, p_import, 'publish');
end $$;

revoke all on all functions in schema transport_internal from public, anon, authenticated;

/* ------------------------------------------------------------ ما تستدعيه الواجهة */
-- النسخة المنشورة كاملة، للجميع
create or replace function public.transport_public() returns jsonb
  language sql stable security definer set search_path = public as $$
  with live as (select * from public.transport_imports where is_live)
  select case when not exists (select 1 from live) then null else jsonb_build_object(
    'importId', (select id from live),
    'year', (select year_name from live),
    'publishedAt', (select published_at from live),
    'cities', coalesce((select jsonb_agg(jsonb_build_object('id', ct.id, 'name', ct.city_name, 'slug', ct.slug) order by ct.city_name)
                from public.transport_cities ct where ct.id in (select city_id from public.transport_import_campuses where import_id = (select id from live))), '[]'::jsonb),
    'campuses', coalesce((select jsonb_agg(jsonb_build_object(
                  'id', ic.campus_id, 'name', ic.campus_name, 'cityId', ic.city_id, 'sort', ic.sort,
                  'districts', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'name', cv.original_district_name, 'norm', d.normalized_name, 'lat', d.latitude, 'lng', d.longitude) order by cv.sort)
                                from public.transport_coverage cv join public.transport_districts d on d.id = cv.district_id
                                where cv.import_id = ic.import_id and cv.campus_id = ic.campus_id), '[]'::jsonb)) order by ic.sort)
                from public.transport_import_campuses ic where ic.import_id = (select id from live)), '[]'::jsonb)) end
$$;
grant execute on function public.transport_public() to anon, authenticated;

create or replace function public.transport_upload(p_year text, p_file_name text, p_file_size int, p_file_path text, p_notes text, p_payload jsonb) returns jsonb
  language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then raise exception 'غير مصرح' using errcode = '42501'; end if;
  return transport_internal.create_import(auth.uid(), p_year, p_file_name, p_file_size, p_file_path, p_notes, p_payload);
end $$;

create or replace function public.transport_publish(p_import uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then raise exception 'غير مصرح' using errcode = '42501'; end if;
  perform transport_internal.publish(auth.uid(), p_import);
end $$;

-- استرجاع نسخة سبق نشرها. لا يحذف شيئًا من السجل.
create or replace function public.transport_restore(p_import uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then raise exception 'غير مصرح' using errcode = '42501'; end if;
  if not exists (select 1 from public.transport_imports where id = p_import and status = 'superseded') then raise exception 'لا تُسترجع إلا نسخة سبق نشرها'; end if;
  perform transport_internal.set_live(auth.uid(), p_import, 'restore');
end $$;

create or replace function public.transport_reject(p_import uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then raise exception 'غير مصرح' using errcode = '42501'; end if;
  update public.transport_imports set status = 'rejected' where id = p_import and status in ('draft', 'invalid');
  insert into public.transport_audit (actor, action, import_id) values (auth.uid(), 'reject', p_import);
end $$;

revoke execute on function public.transport_upload(text, text, int, text, text, jsonb), public.transport_publish(uuid), public.transport_restore(uuid), public.transport_reject(uuid) from public, anon;
grant execute on function public.transport_upload(text, text, int, text, text, jsonb), public.transport_publish(uuid), public.transport_restore(uuid), public.transport_reject(uuid) to authenticated;

/* ------------------------------------------------------------ تخزين الملفات الأصلية (خاص بمدير المنصة) */
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('transport-files', 'transport-files', false, 5242880,
        array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists transport_files_owner_read on storage.objects;
create policy transport_files_owner_read on storage.objects for select to authenticated using (bucket_id = 'transport-files' and public.is_owner());
drop policy if exists transport_files_owner_write on storage.objects;
create policy transport_files_owner_write on storage.objects for insert to authenticated with check (bucket_id = 'transport-files' and public.is_owner());
