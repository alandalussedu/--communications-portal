# بوابة التواصل المؤسسي — تعليمات للعمل على المشروع

منصة عربية (RTL) لإدارة التواصل المؤسسي في شركة الأندلس التعليمية. React + TypeScript + Tailwind (Vite)، منشورة على GitHub Pages، وبياناتها على Supabase.

## قواعد لا تُكسر
- العمل بالعربية، مباشر وعملي.
- لا تخترع بيانات ولا مصادر. مصدر الحقيقة: ملفات Google Sheets لكل فرع (قراءة فقط، لا تُعدَّل) وملف المنافسين.
- اسأل قبل أي قرار لا رجعة فيه.
- لا تضع أي مفتاح أو رمز أو كلمة مرور في المستودع أو في أي ملف أو في رسائل الـ commit. المفاتيح في إعدادات البيئة فقط.
- بيانات «الأداء والتطوير» (branches, indicators, stages, meta, syncLog, alertState, remedial*, competitors, competitorsMeta) لا تُنشر أبدًا في ملف عام. `public-data.json` يحوي المجموعات العامة فقط، و`tools/make_public_data.py` لا يقرأ غيرها.

## البنية
- **قاعدة البيانات:** Supabase، المشروع `mzuqpvqqkdolseglgvfy`. جدول `public.docs` (collection, id, data) يحفظ كل مستند، وجدول `public.members` للمستخدمين وأدوارهم. التصميم وقواعد الوصول (RLS) في `supabase/schema.sql`.
- **الأدوار:** `viewer` مسؤول تواصل (يرى كل شيء ولا يعدّل)، `editor` فريق الإدارة (يرى ويعدّل)، `owner` مدير المنصة (كالمحرر ويدير المستخدمين). الزائر بلا دخول يرى المجموعات العامة فقط: files, settings, socialAccounts, socialReadings, events.
- **الدخول:** برقم الجوال وكلمة المرور. الحساب في Supabase Auth بعنوان داخلي `m9665XXXXXXXX@members.andalus.invalid`، ولا تُرسل أي رسائل بريد. كلمة المرور المؤقتة تُغيَّر إجباريًا عند أول دخول.
- **إدارة المستخدمين:** صفحة `#members` في المنصة، تستدعي دالة الخادم `supabase/functions/admin-members` (لا يقبلها إلا مدير نشط).
- `src/lib/backend.ts` طبقة Supabase بنفس واجهة قاعدة Claude (`use("db")`, `use("user")`)، فالصفحات و`src/data/store.tsx` لا تعرف الفرق. داخل Claude تعمل المنصة على قاعدة Claude القديمة كما كانت.
- `src/config.ts` رابط المشروع والمفتاح العام (publishable)؛ كلاهما عام بطبيعته.
- `docs/` الموقع المنشور (ناتج البناء + `public-data.json` الاحتياطي + `hero.mp4`/`hero.jpg`).
- `tools/`: `make_public_data.py` (النسخة العامة)، `fetch_followers.mjs` (أعداد المتابعين من الواجهات الرسمية)، `migrate_to_supabase.mjs` و`make_seed_sql.py` (النقل الأولي، لم تعد لازمة)، `vault.mjs` (التشفير القديم).

## المهام المجدولة
- «تحديث مؤشرات الفروع» يوميًا و«تحديث الخطط العلاجية» أسبوعيًا: تقرأ Google Sheets وتكتب في Supabase عبر `api.supabase.com` (الرمز سرّ شبكة في البيئة).
- «نشر النسخة العامة على GitHub» يوميًا: يبني `docs/public-data.json` من المجموعات العامة.
- «قراءة أعداد المتابعين الشهرية»: يحتاج `YOUTUBE_API_KEY` و/أو مفاتيح Meta في البيئة.

## البناء والنشر
- `pnpm install` ثم `npx vite build` (الأمر `npm run build` يفشل في فحص الأنواع بأخطاء قديمة لا تخص البناء).
- انسخ `dist/` إلى `docs/` مع إبقاء `public-data.json` و`hero.*` و`.nojekyll`، ثم ادفع إلى `main`؛ ملف `.github/workflows/pages.yml` ينشر تلقائيًا.
