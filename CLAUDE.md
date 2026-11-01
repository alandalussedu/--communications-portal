# مركز التواصل المؤسسي — تعليمات للعمل على المشروع

منصة عربية (RTL) لإدارة التواصل المؤسسي في شركة الأندلس التعليمية. React + TypeScript + Tailwind (Vite).

## قواعد لا تُكسر
- العمل بالعربية، مباشر وعملي.
- لا تخترع بيانات ولا مصادر. مصدر الحقيقة: ملفات Google Sheets لكل فرع (قراءة فقط، لا تُعدَّل) وملف المنافسين.
- اسأل قبل أي قرار لا رجعة فيه.
- **لا تضع مفتاح التشفير في المستودع ولا في أي ملف ولا في رسائل الـ commit.** يُحفظ كسرّ (GitHub Secret باسم `VAULT_KEY`) أو عند صاحب المنصة.
- المجموعات المحمية (branches, indicators, stages, meta, syncLog, alertState, remedial*, competitors, competitorsMeta) لا تُكتب إلا مشفّرة `{enc:{v,iv,ct}}`. السكربت `tools/make_public_data.py` يرفض أي نص صريح فيها.

## البنية
- `src/` كود المنصة. `src/data/store.tsx` يقرأ `public-data.json` ويعمل بوضع القراءة فقط (`snapshotAt`) عند غياب قاعدة Claude.
- `docs/` الموقع الجاهز للنشر (`index.html` + `public-data.json`) — هذا ما تخدمه GitHub Pages.
- `tools/vault.mjs` تشفير/فك تشفير مستندات المجموعات بمفتاح AES-GCM (يلزم `KEY`).
- `tools/make_public_data.py` يبني `public-data.json` من نسخة قاعدة البيانات (`<مجلد>/<collection>/<id>.json`).
- `src/extra.css` أنماط إضافية فوق Tailwind.

## البناء
- التطوير: `npm install` ثم `npm run dev`. الإنتاج: `npm run build` ثم انسخ `dist/index.html` وما يلزمه إلى `docs/` (أو اضبط النشر على dist).
- ملاحظة: النسخة الجاهزة في `docs/` بُنيت بسلسلة أدوات بلا اتصال بسجل npm، ولم يُجرَّب `npm run build` القياسي بعد. جرّبه أولاً وقارن النتيجة بالنسخة الحالية قبل استبدالها.
