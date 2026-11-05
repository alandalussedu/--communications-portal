# تطبيق iOS لبوابة التواصل المؤسسي

التطبيق يغلّف نفس البوابة (Capacitor 8). أي تحديث للبوابة ينتقل للتطبيق بعد بناء نسخة جديدة ورفعها.

- **معرّف التطبيق (Bundle ID):** `sa.edu.andalus.portal` (في `capacitor.config.ts`، ولا يتغير بعد النشر)
- **يدعم:** iPhone وiPad · iOS 15 فأحدث
- **الخصائص الأصلية:** الإشعارات الفورية، والدخول ببصمة الوجه أو الإصبع، ومشاركة روابط المكتبة، وشاشة البداية وشريط الحالة بألوان الهوية.

## 1. التجهيز على جهاز Mac (مرة واحدة)
1. ثبّت أحدث **Xcode** من App Store وافتحه مرة لقبول الشروط.
2. ثبّت Node.js 22 وpnpm (`npm i -g pnpm`).
3. نزّل المستودع:
   ```bash
   git clone https://github.com/alandalussedu/--communications-portal.git
   cd -- --communications-portal
   pnpm install
   ```

## 2. بناء التطبيق وفتحه في Xcode (بعد كل تحديث)
```bash
git pull
pnpm install
npx vite build
npx cap sync ios
npx cap open ios
```

## 3. التوقيع والقدرات في Xcode (مرة واحدة)
1. من القائمة الجانبية اختر **App**، ثم الهدف **App**، ثم تبويب **Signing & Capabilities**.
2. **Team:** اختر حسابك في Apple Developer، وأبقِ «Automatically manage signing» مفعّلًا.
3. تأكد أن **Bundle Identifier** هو `sa.edu.andalus.portal`.
4. اضغط **+ Capability** وأضف **Push Notifications**.
5. أضف أيضًا **Background Modes** وفعّل **Remote notifications**.

للتجربة على جوالك: وصّله بالكابل، واختره من أعلى Xcode، ثم ▶.

## 4. مفتاح الإشعارات من Apple (مرة واحدة)
1. افتح developer.apple.com، ثم Account، ثم **Certificates, IDs & Profiles**، ثم **Keys**، ثم **+**.
2. اكتب اسمًا مثل «Portal APNs»، وفعّل **Apple Push Notifications service (APNs)**، ثم Continue، ثم Register.
3. نزّل ملف `.p8`. **ينزل مرة واحدة فقط، احفظه في مكان آمن.**
4. سجّل **Key ID** من نفس الصفحة، و**Team ID** من صفحة Membership.
5. **لا ترسل الملف ولا المفاتيح في أي محادثة، ولا تضعها في المستودع.**

## 5. Supabase (مرة واحدة)
1. **الجدول:** افتح SQL Editor في Supabase، والصق محتوى `supabase/push_tokens.sql`، ثم Run.
2. **دالة الإرسال `send-push`:**
   - **إما من Terminal على الـ Mac:**
     ```bash
     brew install supabase/tap/supabase
     supabase login
     supabase functions deploy send-push --project-ref mzuqpvqqkdolseglgvfy
     ```
   - **أو من لوحة Supabase:** Edge Functions، ثم Deploy a new function، ثم Via Editor. سمِّها `send-push` والصق محتوى `supabase/functions/send-push/index.ts`.
3. **الأسرار:** Edge Functions، ثم Secrets. أضف:

   | الاسم | القيمة |
   |---|---|
   | `APNS_KEY_ID` | Key ID من الخطوة 4 |
   | `APNS_TEAM_ID` | Team ID |
   | `APNS_BUNDLE_ID` | `sa.edu.andalus.portal` |
   | `APNS_PRIVATE_KEY` | محتوى ملف `.p8` كاملًا، بما فيه سطرا BEGIN وEND |

**للتجربة:** ادخل التطبيق واسمح بالإشعارات. ثم من البوابة: حسابي، ثم إدارة المستخدمين، ثم «إرسال إشعار».

## 6. App Store Connect
1. **Apps، ثم + New App:**
   - المنصة: iOS
   - الاسم: «بوابة التواصل المؤسسي» (إن كان مستخدمًا فجرّب «بوابة الأندلس للتواصل»)
   - اللغة الأساسية: Arabic
   - Bundle ID: `sa.edu.andalus.portal`
   - SKU: `andalus-portal-1`
2. **رفع نسخة:** في Xcode اختر «Any iOS Device (arm64)»، ثم Product، ثم Archive، ثم Distribute App، ثم App Store Connect، ثم Upload.
3. **TestFlight:** أضف نفسك وزملاءك مختبِرين داخليين، وثبّتوا تطبيق TestFlight وجرّبوا.
4. **بيانات المتجر:**
   - **Privacy Policy URL:** https://alandalussedu.github.io/--communications-portal/privacy.html
   - **Support URL:** https://alandalussedu.github.io/--communications-portal/support.html
   - **الفئة:** Business · **التصنيف العمري:** 4+
   - **App Privacy:** Contact Info، ثم Name وPhone Number. الغرض: App Functionality. مرتبطة بالمستخدم. **لا** تتبّع.
   - **Export Compliance:** لا يوجد تشفير خاص (مضبوط في Info.plist).
5. **App Review Information:**
   - فعّل «Sign-in required»، وأدخل رقم جوال وكلمة مرور لحساب مراجِع بدور «مسؤول تواصل». أنشئه من إدارة المستخدمين، وأوقفه بعد الاعتماد.
   - في الملاحظات اذكر: «تطبيق داخلي لموظفي شركة الأندلس التعليمية. الحسابات تنشئها الإدارة. الأقسام العامة تعمل بلا دخول.»
6. **التوزيع غير المُدرج:**
   - قدّم طلب **Unlisted App Distribution** من موقع Apple Developer قبل الإصدار.
   - اختر في الإصدار «Manually release this version».
