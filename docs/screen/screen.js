/*
 * شاشة العرض (للتلفزيون في غرفة المدير ولتبويب «شاشة العرض» في المنصة).
 * ستة عروض يختارها المشاهد يدويًا: أعداد الطلاب والانسحاب، رضا العملاء وجودة التواصل، المسؤولية المجتمعية،
 * التواصل الاجتماعي حسب المدارس، قنوات الواتساب، السنترال (استجابة كل تحويلات الفروع).
 * صفحة مستقلة عن تطبيق المنصة، مكتوبة بـ JavaScript قديم (ES2017، بلا ?. ولا ??)
 * لأن متصفحات التلفزيونات الذكية متأخرة عن المتصفحات الحديثة. افحص أي تعديل بمحلل ES2017.
 *
 * على التلفزيون: تدخل بحساب «شاشة عرض» (أو مدير المنصة) عبر Supabase Auth REST وتحفظ جلستها.
 * داخل المنصة (?embed=1 في إطار تبويب «شاشة العرض»): تأخذ رمز الدخول من صفحة المنصة نفسها
 * (window.parent.__andalusScreen.token) ولا تجدّده أبدًا حتى لا تُخرج المدير من المنصة.
 * قاعدة البيانات لا تعطي حساب الشاشة إلا studentCounts وcsrPlans وindicators وpbxBranchReports وpbxDirectory
 * وpbxOfficers والمجموعات العامة (screen_collection).
 * الرابط والمفتاح العام (publishable) عامّان بطبيعتهما كما في src/config.ts.
 */
(function () {
  'use strict'
  var API = 'https://mzuqpvqqkdolseglgvfy.supabase.co'
  var KEY = 'sb_publishable_KckG1geNxChv5VgyBRuUfA_Zb6hOxf_'
  var POLL_MS = 60000 // فحص البيانات كل دقيقة
  var STORE = 'andalus-screen-session'
  var VIEW_STORE = 'andalus-screen-view'
  var LEVELS = { wdGood: 0.08, wdFollow: 0.12, ocHigh: 0.85, ocGood: 0.7 } // اعتمدها مدير المنصة
  var EMBED = /[?&]embed=1/.test(location.search)
  var VIEWS = [[1, 'الطلاب والانسحاب'], [2, 'رضا العملاء'], [3, 'المسؤولية المجتمعية'], [4, 'التواصل الاجتماعي'], [5, 'قنوات الواتساب'], [6, 'السنترال']]
  var TITLES = ['أعداد الطلاب والانسحاب', 'رضا العملاء وجودة التواصل', 'المسؤولية المجتمعية', 'التواصل الاجتماعي', 'قنوات الواتساب', 'السنترال · استجابة الفروع']
  var HINTS = ['الإشغال والانسحاب والمستهدف', 'وجودة التواصل لكل فرع', 'خطط الفروع والاعتماد', 'حسب المدارس والشركة', 'المشتركون لكل قناة', 'استجابة كل تحويلات الفروع']
  var N = VIEWS.length
  var BRANCH = { zahra: 'الزهراء', rawdah: 'الروضة', 'shatee-intl': 'الشاطئ العالمية', 'shatee-gifted': 'الشاطئ للموهوبين', hamdaniya: 'الحمدانية', faiha: 'الفيحاء', abhur: 'أبحر', manar: 'المنار', makkah: 'مكة', taif: 'الطائف', najran: 'نجران', jouf: 'الجوف', abha: 'أبها', khamis: 'خميس مشيط', riyadh: 'الرياض' }
  var PLATFORM = { youtube: 'يوتيوب', instagram: 'إنستغرام', tiktok: 'تيك توك', snapchat: 'سناب شات', facebook: 'فيسبوك', whatsapp: 'واتساب', linkedin: 'لينكدإن', x: 'إكس', telegram: 'تيليجرام' }
  var MARKS = {"youtube": {"bg": "#ffffff", "fill": "#FF0000", "d": "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"}, "facebook": {"bg": "#3B5998", "fill": "#ffffff", "d": "M15.12 5.32H17V2.14A24.5 24.5 0 0 0 14.26 2c-2.72 0-4.58 1.66-4.58 4.7V9.5H6.6v3.56h3.08V22h3.68v-8.94h3.07l.46-3.56h-3.53V7.07c0-1.03.28-1.75 1.76-1.75z"}, "linkedin": {"bg": "#0077B5", "fill": "#ffffff", "d": "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452z"}, "snapchat": {"bg": "#FFFC00", "fill": "#000000", "d": "M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868l.015.015c.06.136 1.526 3.475 4.791 4.014.255.044.435.27.42.509 0 .075-.015.149-.045.225-.24.569-1.273.988-3.146 1.271-.059.091-.12.375-.164.57-.029.179-.074.36-.134.553-.076.271-.27.405-.555.405h-.03c-.135 0-.313-.031-.538-.074-.36-.075-.765-.135-1.273-.135-.3 0-.599.015-.913.074-.6.104-1.123.464-1.723.884-.853.599-1.826 1.288-3.294 1.288-.06 0-.119-.015-.18-.015h-.149c-1.468 0-2.427-.675-3.279-1.288-.599-.42-1.107-.779-1.707-.884-.314-.045-.629-.074-.928-.074-.54 0-.958.089-1.272.149-.211.043-.391.074-.54.074-.374 0-.523-.224-.583-.42-.061-.192-.09-.389-.135-.567-.046-.181-.105-.494-.166-.57-1.918-.222-2.95-.642-3.189-1.226-.031-.063-.052-.15-.055-.225-.015-.243.165-.465.42-.509 3.264-.54 4.73-3.879 4.791-4.02l.016-.029c.18-.345.224-.645.119-.869-.195-.434-.884-.658-1.332-.809-.121-.029-.24-.074-.346-.119-1.107-.435-1.257-.93-1.197-1.273.09-.479.674-.793 1.168-.793.146 0 .27.029.383.074.42.194.789.3 1.104.3.234 0 .384-.06.465-.105l-.046-.569c-.098-1.626-.225-3.651.307-4.837C7.392 1.077 10.739.807 11.727.807l.419-.015h.06z"}, "instagram": {"bg": "#d62976", "fill": "#ffffff", "d": "M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077"}, "x": {"bg": "#000000", "fill": "#ffffff", "d": "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"}, "tiktok": {"bg": "#000000", "fill": "#ffffff", "d": "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"}, "whatsapp": {"bg": "#25D366", "fill": "#ffffff", "d": "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"}}

  var app = document.getElementById('app')
  var stage = document.getElementById('stage')
  var session = null
  var EMPTY_DATA = function () { return { counts: null, targets: [], plans: [], indicators: [], accounts: [], readings: [], pbxReports: [], pbxOfficers: [] } }
  var pbxDir = null, pbxDirAt = 0 // «دليل التحويلات» is large and rarely changes: read at most every 30 minutes
  var data = EMPTY_DATA()
  var view = 1
  var online = true
  var lastOk = null
  var pollTimer = null
  var started = false

  try { var saved = parseInt(localStorage.getItem(VIEW_STORE), 10); if (saved >= 1 && saved <= N) view = saved } catch (e) { /* no storage */ }
  var qv = /[?&]view=(\d)/.exec(location.search)
  if (qv && +qv[1] >= 1 && +qv[1] <= N) view = +qv[1]

  /* ------------------------------------------------------------ fit 1920×1080 to the screen */
  function fit() {
    var w = window.innerWidth, h = window.innerHeight
    var s = Math.min(w / 1920, h / 1080)
    app.style.transform = 'scale(' + s + ')'
    app.style.left = Math.round((w - 1920 * s) / 2) + 'px'
    app.style.top = Math.round((h - 1080 * s) / 2) + 'px'
  }
  window.addEventListener('resize', fit)
  fit()

  /* ------------------------------------------------------------ helpers */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] }) }
  var nf = new Intl.NumberFormat('en-US')
  function num(n) { return nf.format(n) }
  function L(s) { return '<span class="l">' + s + '</span>' }
  function pct(x) { return L((x * 100).toFixed(1) + '%') }
  function signed(x) { return L((x >= 0 ? '+' : '−') + Math.abs(x * 100).toFixed(1) + '%') }
  function short(n) { return String(n).replace(/^\s*[أا]ندلس\s+/, '').trim() }
  function wd(x) { return x <= LEVELS.wdGood ? ['ok', 'جيد'] : x <= LEVELS.wdFollow ? ['warn', 'متابعة'] : ['bad', 'مرتفع'] }
  function oc(x) { return x >= LEVELS.ocHigh ? ['ok', 'مرتفع'] : x >= LEVELS.ocGood ? ['sky', 'جيد'] : ['warn', 'منخفض'] }
  var dateFmt = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' })
  var monthFmt = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { month: 'long', year: 'numeric' })
  var dayFmt = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  var timeFmt = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { hour: 'numeric', minute: '2-digit' })
  function fmtDate(iso) { return dateFmt.format(new Date(String(iso).slice(0, 10) + 'T12:00:00')) }
  function fmtMonth(ym) { return monthFmt.format(new Date(ym + '-15T12:00:00')) }
  function max(list) { return list.length ? Math.max.apply(null, list) : 0 }
  function normPhone(input) {
    var d = String(input).replace(/[\s\-()]/g, '').replace(/[٠-٩]/g, function (c) { return String(c.charCodeAt(0) - 0x0660) }).replace(/^\+/, '').replace(/^00/, '')
    if (/^05\d{8}$/.test(d)) return '966' + d.slice(1)
    if (/^5\d{8}$/.test(d)) return '966' + d
    if (/^9665\d{8}$/.test(d)) return d
    return null
  }
  function logo(p) {
    var m = MARKS && MARKS[p]
    if (!m) return '<span class="pl" style="background:#33335a"></span>'
    return '<span class="pl" style="background:' + m.bg + '"><svg viewBox="0 0 24 24"><g transform="translate(5 5) scale(.58)"><path d="' + m.d + '" fill="' + m.fill + '"/></g></svg></span>'
  }

  /* ------------------------------------------------------------ session */
  function saveSession(s) {
    session = s
    try { if (s) localStorage.setItem(STORE, JSON.stringify(s)); else localStorage.removeItem(STORE) } catch (e) { /* private mode */ }
  }
  function loadSession() { try { return JSON.parse(localStorage.getItem(STORE) || 'null') } catch (e) { return null } }
  function fromAuth(j) { return { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + (j.expires_in || 3600) * 1000 } }

  async function auth(grant, body) {
    var res = await fetch(API + '/auth/v1/token?grant_type=' + grant, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    var j = await res.json().catch(function () { return {} })
    if (!res.ok) { var e = new Error(j.error_description || j.msg || j.message || 'auth'); e.status = res.status; throw e }
    return fromAuth(j)
  }
  async function refresh() {
    if (!session || !session.refresh_token) throw Object.assign(new Error('no session'), { status: 401 })
    saveSession(await auth('refresh_token', { refresh_token: session.refresh_token }))
  }
  /** The access token: the portal's own session when embedded, the TV's saved session otherwise. */
  async function token() {
    if (EMBED) {
      var bridge = null
      try { bridge = window.parent && window.parent !== window ? window.parent.__andalusScreen : null } catch (e) { bridge = null }
      var t = bridge ? await bridge.token() : null
      if (!t) throw Object.assign(new Error('no portal session'), { status: 401 })
      return t
    }
    if (session && session.expires_at - Date.now() < 120000) await refresh()
    return session.access_token
  }
  async function api(path, opts, retried) {
    opts = opts || {}
    var res = await fetch(API + path, { method: opts.method || 'GET', headers: { apikey: KEY, Authorization: 'Bearer ' + (await token()), 'Content-Type': 'application/json' }, body: opts.body ? JSON.stringify(opts.body) : undefined })
    if (res.status === 401 && !retried && !EMBED) { await refresh(); return api(path, opts, true) }
    if (!res.ok) { var e = new Error('http ' + res.status); e.status = res.status; throw e }
    var t = await res.text()
    return t ? JSON.parse(t) : null
  }

  /* ------------------------------------------------------------ forms and messages */
  function showLogin(error) {
    stopTimers()
    if (EMBED) { showMessage('ادخل إلى المنصة أولًا', 'يظهر هذا العرض لمدير المنصة وهو داخل المنصة.'); return }
    app.innerHTML =
      '<form class="login" id="login" autocomplete="on">' +
      '<h2>شاشة العرض</h2>' +
      '<p>ادخل بحساب «شاشة عرض» مرة واحدة، وتبقى الشاشة تعمل بعدها.</p>' +
      '<label for="ph">رقم الجوال</label><input id="ph" type="tel" inputmode="tel" dir="ltr" placeholder="05XXXXXXXX" autocomplete="username" required>' +
      '<label for="pw">كلمة المرور</label><input id="pw" type="password" dir="ltr" autocomplete="current-password" required>' +
      '<div class="err" id="err">' + esc(error || '') + '</div>' +
      '<button type="submit" id="go">دخول</button></form>'
    document.getElementById('ph').focus()
    document.getElementById('login').addEventListener('submit', async function (ev) {
      ev.preventDefault()
      var err = document.getElementById('err'), btn = document.getElementById('go')
      var phone = normPhone(document.getElementById('ph').value)
      if (!phone) { err.textContent = 'اكتب رقم الجوال بالشكل 05XXXXXXXX.'; return }
      btn.disabled = true; err.textContent = ''
      try {
        saveSession(await auth('password', { email: 'm' + phone + '@members.andalus.invalid', password: document.getElementById('pw').value }))
        start()
      } catch (e) {
        btn.disabled = false
        err.textContent = e.status === 400 ? 'رقم الجوال أو كلمة المرور غير صحيحة.' : e.status === 429 ? 'محاولات كثيرة. انتظر دقائق ثم أعد المحاولة.' : 'تعذّر الاتصال. تحقق من الإنترنت ثم أعد المحاولة.'
      }
    })
  }

  function showChangePassword() {
    stopTimers()
    app.innerHTML =
      '<form class="login" id="cp">' +
      '<h2>اختر كلمة مرور جديدة</h2><p>كلمة المرور الحالية مؤقتة. اختر كلمة جديدة لحساب الشاشة (8 أحرف أو أرقام على الأقل).</p>' +
      '<label for="p1">كلمة المرور الجديدة</label><input id="p1" type="password" dir="ltr" autocomplete="new-password" required>' +
      '<label for="p2">أعد كتابتها</label><input id="p2" type="password" dir="ltr" autocomplete="new-password" required>' +
      '<div class="err" id="err"></div><button type="submit" id="go">حفظ ومتابعة</button></form>'
    document.getElementById('p1').focus()
    document.getElementById('cp').addEventListener('submit', async function (ev) {
      ev.preventDefault()
      var p1 = document.getElementById('p1').value, p2 = document.getElementById('p2').value, err = document.getElementById('err'), btn = document.getElementById('go')
      if (p1.length < 8) { err.textContent = 'كلمة المرور قصيرة. استخدم 8 أحرف أو أرقام على الأقل.'; return }
      if (p1 !== p2) { err.textContent = 'الكلمتان غير متطابقتين.'; return }
      btn.disabled = true
      try {
        var res = await fetch(API + '/auth/v1/user', { method: 'PUT', headers: { apikey: KEY, Authorization: 'Bearer ' + (await token()), 'Content-Type': 'application/json' }, body: JSON.stringify({ password: p1 }) })
        if (!res.ok) throw new Error('pw')
        await api('/rest/v1/rpc/password_changed', { method: 'POST', body: {} })
        start()
      } catch (e) { btn.disabled = false; err.textContent = 'لم تتغيّر كلمة المرور. اختر كلمة مختلفة ثم أعد المحاولة.' }
    })
  }

  function showMessage(title, body) {
    stopTimers()
    app.innerHTML = '<div class="msg"><h2>' + esc(title) + '</h2><p>' + esc(body) + '</p></div>'
  }

  /* ------------------------------------------------------------ data */
  async function load() {
    var res = await Promise.all([
      api('/rest/v1/docs?collection=eq.studentCounts&select=id,data'),
      api('/rest/v1/docs?collection=eq.csrPlans&select=id,data'),
      api('/rest/v1/docs?collection=eq.socialAccounts&select=id,data'),
      api('/rest/v1/docs?collection=eq.socialReadings&select=id,data'),
      api('/rest/v1/docs?collection=eq.indicators&select=id,data'),
      api('/rest/v1/docs?collection=eq.pbxBranchReports&select=id,data&order=id.desc&limit=2'),
      api('/rest/v1/docs?collection=eq.pbxOfficers&select=id,data'),
      !pbxDir || Date.now() - pbxDirAt > 30 * 60000 ? api('/rest/v1/docs?collection=eq.pbxDirectory&id=eq.current&select=id,data') : null,
    ])
    var rows = function (r) { return (r || []).map(function (x) { var d = x.data || {}; d.id = x.id; return d }) }
    var counts = rows(res[0]).filter(function (d) { return d.date && d.branches && d.total })
    counts.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0 })
    var targets = rows(res[0]).filter(function (d) { return d.kind === 'target' && d.year && d.branches })
    var reports = rows(res[5]).filter(function (d) { return d.month && d.lines })
    reports.sort(function (a, b) { return a.month < b.month ? 1 : a.month > b.month ? -1 : 0 })
    if (res[7]) { pbxDir = rows(res[7])[0] || null; pbxDirAt = Date.now() }
    var next = { counts: counts[0] || null, targets: targets, plans: rows(res[1]), indicators: rows(res[4]), accounts: rows(res[2]).filter(function (a) { return a.active !== false }), readings: rows(res[3]), pbxReports: reports.slice(0, 2), pbxOfficers: rows(res[6]) }
    online = true
    lastOk = new Date()
    var changed = JSON.stringify(next) !== JSON.stringify(data)
    data = next
    return changed
  }

  /* ------------------------------------------------------------ shared pieces */
  function subtitle() {
    var c = data.counts
    if (view === 1) return c ? 'سحب نظام الحلول الخبيرة · <b>' + esc(fmtDate(c.date)) + '</b>' : ''
    if (view === 2) {
      var cap = data.indicators.map(function (d) { return d.capturedAt || '' }).sort().pop()
      return 'من المنصة الشاملة لكل فرع' + (cap ? ' · آخر قراءة <b>' + esc(fmtDate(cap)) + '</b>' : '')
    }
    if (view === 3) {
      var read = data.plans.map(function (p) { return p.readAt || '' }).sort().pop()
      return 'من «خطط الفروع» لكل فرع' + (read ? ' · آخر قراءة <b>' + esc(fmtDate(read)) + '</b>' : '')
    }
    if (view === 6) {
      var rp = data.pbxReports[0]
      if (!rp) return 'تقرير مكالمات 3CX'
      return 'تقرير مكالمات 3CX · <b>' + esc(fmtMonth(rp.month)) + '</b>' + (pbxPartial(rp) ? ' · من ' + (+rp.from.slice(8, 10)) + ' إلى ' + esc(fmtDate(rp.to)) + ' فقط' : '')
    }
    var m = latestMonth()
    if (view === 4) return 'حسابات المدارس والشركة' + (m ? ' · <b>' + esc(fmtMonth(m)) + '</b>' : '')
    return 'قنوات واتساب الفروع والشركة' + (m ? ' · <b>' + esc(fmtMonth(m)) + '</b>' : '')
  }
  function header() {
    var cur = VIEWS[view - 1]
    // one dropdown instead of a row of buttons (طلب مدير المنصة); on the TV it also holds full screen and sign out
    var items = VIEWS.map(function (d, i) { return '<button type="button" class="vi' + (d[0] === view ? ' on' : '') + '" data-v="' + d[0] + '"><b>' + d[0] + '</b><span>' + TITLES[i] + '<small>' + HINTS[i] + '</small></span></button>' }).join('')
    var acts = EMBED ? '' : '<div class="vsep"></div><button type="button" class="vi act" data-act="full"><span>ملء الشاشة</span></button><button type="button" class="vi act" data-act="out"><span>تسجيل الخروج</span></button>'
    var now = new Date()
    return '<header class="hd"><div class="brand"><div class="mark">✦</div><div><h1>' + TITLES[view - 1] + '</h1><p>' + subtitle() + '</p></div></div>' +
      '<div class="vpick"><button type="button" class="vsel" id="vsel" aria-haspopup="true" aria-expanded="false"><b>' + cur[0] + '</b><span>' + cur[1] + '</span><i class="caret"></i></button>' +
      '<div class="vlist" id="vlist">' + items + acts + '</div></div>' +
      '<div class="clock"><b id="clk">' + esc(timeFmt.format(now)) + '</b><span id="day">' + esc(dayFmt.format(now)) + '</span></div></header>'
  }
  function keys(items) { return '<p class="keys">' + items.map(function (k) { return '<span><em class="' + k[0] + '"></em>' + k[1] + '</span>' }).join('') + '</p>' }
  function empty(title, body) { return header() + '<div class="msg"><h2>' + esc(title) + '</h2><p>' + esc(body) + '</p></div>' }
  function gauge(v) {
    var r = 56, len = Math.PI * r
    function pt(t, rr) { return [70 + rr * Math.cos(Math.PI * t), 72 - rr * Math.sin(Math.PI * t)] }
    function tick(t) { var a = pt(t, 46), b = pt(t, 67); return '<line x1="' + a[0].toFixed(1) + '" y1="' + a[1].toFixed(1) + '" x2="' + b[0].toFixed(1) + '" y2="' + b[1].toFixed(1) + '" stroke="#d8b14b" stroke-width="3" stroke-linecap="round"/>' }
    return '<svg viewBox="0 0 140 80" class="gauge"><path d="M126 72 A56 56 0 0 0 14 72" fill="none" stroke="#24244a" stroke-width="14" stroke-linecap="round"/>' +
      '<path d="M126 72 A56 56 0 0 0 14 72" fill="none" stroke="#d8b14b" stroke-width="14" stroke-linecap="round" stroke-dasharray="' + (len * Math.max(0, Math.min(1, v))).toFixed(1) + ' ' + len.toFixed(1) + '"/>' +
      tick(LEVELS.ocGood) + tick(LEVELS.ocHigh) + '</svg>'
  }
  function of(n) { return '<span class="of">من ' + n + '</span>' }

  /* ------------------------------------------------------------ 1 · students and withdrawal */
  function nextYear(c) {
    var m = /^(\d{4})-(\d{4})$/.exec(c.year || '')
    if (m) return (+m[1] + 1) + '-' + (+m[2] + 1)
    var d = new Date(String(c.date).slice(0, 10) + 'T12:00:00'), s = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1
    return (s + 1) + '-' + (s + 2)
  }
  /** Next year's target: the total of the branch targets the owner typed in (shown as a total only). */
  function targetInfo(c) {
    var year = nextYear(c)
    var t = data.targets.filter(function (d) { return d.year === year })[0] || null
    var names = c.branches.map(function (b) { return short(b.name) })
    var set = names.filter(function (n) { return t && t.branches && t.branches[n] > 0 })
    var total = set.reduce(function (a, n) { return a + t.branches[n] }, 0)
    return { year: year, total: total, entered: set.length, of: names.length, complete: names.length > 0 && set.length === names.length }
  }
  function view1() {
    var c = data.counts
    if (!c) return empty('لم يُرفع سحب بعد', 'ارفع ملف «مؤشرات أعداد الطلاب» من تبويب أعداد الطلاب في المنصة.')
    var t = c.total, w = wd(t.withdrawalRate), o = oc(t.occupancy), ti = targetInfo(c)
    var prelim = (c.notes || []).some(function (n) { return n.title.indexOf('النمو') >= 0 && /مبدئي/.test(n.title + n.text) })
    var target = ti.total
      ? '<div class="k tg"><span>مستهدف ' + L(ti.year.replace('-', '/')) + '</span><b>' + num(ti.total) + '</b><small>' +
        (ti.complete ? 'الحاليون ' + pct(t.current / ti.total) + ' منه' : 'مُدخل لـ ' + ti.entered + ' من ' + ti.of + ' فرعًا') + '</small></div>'
      : '<div class="k tg"><span>مستهدف ' + L(ti.year.replace('-', '/')) + '</span><b class="soft">لم يُحدَّد بعد</b><small>يُدخل من تبويب أعداد الطلاب</small></div>'
    var kpis = '<section class="kpis k7">' +
      '<div class="k hero"><span>الطلاب الحاليون</span><b>' + num(t.current) + '</b>' +
      (t.regular != null ? '<div class="split"><i style="width:' + (t.regular / Math.max(t.current, 1) * 100).toFixed(1) + '%"></i></div><small><em class="d w"></em>منتظم ' + num(t.regular) + '<em class="d g"></em>مستجد ' + num(t.newcomers) + '</small>' : '') + '</div>' +
      '<div class="k"><span>الطلاب الجدد</span><b>' + num(t.newcomers) + '</b>' + (t.growth != null ? '<small>نمو <strong class="' + (t.growth >= 0 ? 'pos' : 'neg') + '">' + signed(t.growth) + '</strong>' + (prelim ? ' <i class="tag">مبدئية</i>' : '') + '</small>' : '') + '</div>' +
      '<div class="k"><span>المنسحبون</span><b>' + num(t.withdrawn) + '</b>' + (t.transferred != null ? '<small>لا يشمل ' + num(t.transferred) + ' محوّلًا</small>' : '') + '</div>' +
      '<div class="k"><span>نسبة الانسحاب</span><b>' + pct(t.withdrawalRate) + '</b><small><i class="chip ' + w[0] + '">' + w[1] + '</i></small></div>' +
      '<div class="k gk"><span>نسبة الإشغال</span><div class="gw">' + gauge(t.occupancy) + '<b>' + pct(t.occupancy) + '</b></div><i class="chip ' + o[0] + '">' + o[1] + '</i></div>' +
      '<div class="k"><span>الطاقة التشغيلية</span><b>' + num(t.capacity) + '</b><small>' + num(Math.max(t.capacity - t.current, 0)) + ' مقعدًا متاحًا</small></div>' +
      target + '</section>'
    var B = c.branches.slice().sort(function (a, b) { return b.current - a.current })
    var maxCap = max(B.map(function (b) { return b.capacity })) || 1, maxW = max(B.map(function (b) { return b.withdrawalRate })) || 1e-9
    var flagged = function (name) { var s = short(name); return (c.notes || []).some(function (n) { return n.title.indexOf(s) >= 0 }) }
    var rows = B.map(function (b) {
      return '<div class="mrow"><span class="n">' + esc(short(b.name)) + (flagged(b.name) ? '<i class="fl">!</i>' : '') + '</span>' +
        '<span class="tw"><span class="tr2" style="width:' + (b.capacity / maxCap * 100).toFixed(1) + '%"><i class="' + oc(b.occupancy)[0] + '" style="width:' + (Math.min(b.occupancy, 1) * 100).toFixed(1) + '%"></i></span></span><b>' + pct(b.occupancy) + '</b>' +
        '<span class="tw"><span class="tr2"><i class="' + wd(b.withdrawalRate)[0] + '" style="width:' + (b.withdrawalRate / maxW * 100).toFixed(1) + '%"></i></span></span><b>' + pct(b.withdrawalRate) + '</b><small>' + num(b.withdrawn) + '</small></div>'
    }).join('')
    var watch = c.branches.filter(function (b) { return b.occupancy < LEVELS.ocGood || b.withdrawalRate > LEVELS.wdFollow })
    watch.sort(function (a, b) {
      var sa = (a.occupancy < LEVELS.ocGood) + (a.withdrawalRate > LEVELS.wdFollow), sb = (b.occupancy < LEVELS.ocGood) + (b.withdrawalRate > LEVELS.wdFollow)
      return sb - sa || a.occupancy - b.occupancy
    })
    var shownWatch = watch.length > 7 ? watch.slice(0, 6) : watch
    var wrows = watch.length ? '<ul class="watch">' + shownWatch.map(function (b) {
      return '<li><span class="n">' + esc(short(b.name)) + '</span><span>' +
        (b.occupancy < LEVELS.ocGood ? '<i class="chip warn">إشغال ' + pct(b.occupancy) + '</i>' : '') +
        (b.withdrawalRate > LEVELS.wdFollow ? '<i class="chip bad">انسحاب ' + pct(b.withdrawalRate) + '</i>' : '') + '</span></li>'
    }).join('') + (watch.length > shownWatch.length ? '<li class="more">و' + (watch.length - shownWatch.length) + ' فروع أخرى في تبويب أعداد الطلاب</li>' : '') + '</ul>' : '<p class="none">كل الفروع ضمن الحدود المعتمدة</p>'
    var SC = ['#d8b14b', '#33bdf2', '#8f8fe6', '#4fcf8e', '#c084fc', '#ef6a5c']
    var st = t.stages || [], names = c.stageNames || [], tot = st.reduce(function (a, b) { return a + b }, 0) || 1
    var stages = names.length && st.length ? '<div class="card"><h2>حسب المرحلة <span>الطلاب الحاليون</span></h2><div class="stack">' +
      st.map(function (v, i) { return '<i style="width:' + (v / tot * 100).toFixed(2) + '%;background:' + SC[i % SC.length] + '"></i>' }).join('') + '</div><p class="sleg">' +
      names.map(function (n, i) { return '<span><em style="background:' + SC[i % SC.length] + '"></em>' + esc(n) + ' <b>' + num(st[i] || 0) + '</b></span>' }).join('') + '</p></div>' : ''
    return header() + kpis +
      '<section class="body b1"><div class="card big"><h2>الفروع <span>مرتبة حسب عدد الطلاب · طول شريط الإشغال = الطاقة التشغيلية</span></h2>' +
      '<div class="mrow mh"><span class="n">الفرع</span><span class="tw">الإشغال</span><b></b><span class="tw">نسبة الانسحاب</span><b></b><small>المنسحبون</small></div>' +
      '<div class="bars">' + rows + '</div>' +
      keys([['ok', 'إشغال مرتفع · انسحاب جيد'], ['sky', 'إشغال جيد'], ['warn', 'إشغال منخفض · انسحاب متابعة'], ['bad', 'انسحاب مرتفع']]) + '</div>' +
      '<div class="col"><div class="card"><h2>فروع تحتاج متابعة <span>إشغال أقل من ' + L('70%') + ' أو انسحاب فوق ' + L('12%') + '</span></h2>' + wrows + '</div>' + stages + '</div></section>'
  }

  /* ------------------------------------------------------------ 2 · customer satisfaction and communication quality */
  function nv(v) { return v && typeof v.num === 'number' ? v.num : null }
  function rv(v) { return v && v.raw != null && v.raw !== '' ? L(esc(String(v.raw).replace(/\.00(?=%)/, ''))) : '<span class="no">—</span>' }
  function view2() {
    var ind = data.indicators
    if (!ind.length) return empty('لا توجد مؤشرات بعد', 'تُقرأ مؤشرات الفروع من المنصة الشاملة لكل فرع مع «حدث المؤشرات».')
    var name = function (d) { return BRANCH[d.branch] || d.branch }
    var sat = ind.filter(function (d) { return d.indicator === 'satisfaction' })
    var com = ind.filter(function (d) { return d.indicator === 'communication' })
    var withPrior = sat.filter(function (d) { return nv(d.prior) !== null })
    var noPrior = sat.filter(function (d) { return nv(d.prior) === null }).map(name)
    var s1 = sat.filter(function (d) { return nv(d.s1Result) !== null })
    var targets = withPrior.map(function (d) { return nv(d.annualTarget) }).filter(function (x) { return x !== null && x > 0 })
    var below = withPrior.filter(function (d) { var a = nv(d.annualTarget); return a !== null && a > 0 && a < nv(d.prior) })
    var kpis = '<section class="kpis">' +
      '<div class="k hero"><span>فروع لها نتيجة العام السابق</span><b>' + withPrior.length + of(sat.length) + '</b><small>' + (noPrior.length ? 'بلا نتيجة للعام السابق: ' + esc(noPrior.join('، ')) : 'كل الفروع لها نتيجة') + '</small></div>' +
      '<div class="k"><span>نتائج الفصل الأول (رضا العملاء)</span>' + (s1.length ? '<b>' + s1.length + of(sat.length) + '</b><small>تظهر في عمود «الفصل الأول»</small>' : '<b class="soft">لم تُدخل بعد</b><small>تظهر هنا تلقائيًا عند إدخالها في ملفات الفروع</small>') + '</div>' +
      '<div class="k"><span>مستهدف الرضا لهذا العام</span>' + (targets.length ? '<b class="mid">' + L(Math.min.apply(null, targets).toFixed(1).replace(/\.0$/, '') + '%') + ' – ' + L(Math.max.apply(null, targets).toFixed(1).replace(/\.0$/, '') + '%') + '</b><small>أدنى وأعلى مستهدف سنوي بين الفروع</small>' : '<b class="soft">—</b>') + '</div>' +
      '<div class="k"><span>مستهدف أقل من نتيجة العام السابق</span><b>' + below.length + '</b><small>' + (below.length ? esc(below.map(name).join('، ')) : 'لا يوجد') + '</small></div></section>'
    var rows = withPrior.slice().sort(function (a, b) { return nv(b.prior) - nv(a.prior) }).map(function (d) {
      var a = nv(d.annualTarget), r1 = nv(d.s1Result), t1 = nv(d.s1Target)
      var mark = a !== null && a > 0 ? '<em style="right:' + Math.min(a, 100).toFixed(1) + '%"></em>' : ''
      var s1cell = r1 === null ? '<span class="no">—</span>' : '<span class="' + (t1 !== null && r1 >= t1 ? 'yes' : 'warnt') + '">' + rv(d.s1Result) + '</span>'
      return '<div class="irow"><span class="n">' + esc(name(d)) + '</span><span class="tw"><span class="ibar"><i style="width:' + Math.min(nv(d.prior), 100).toFixed(1) + '%"></i>' + mark + '</span></span>' +
        '<b>' + rv(d.prior) + '</b><span class="m">' + rv(d.annualTarget) + '</span><span class="m">' + s1cell + '</span></div>'
    }).join('')
    // communication quality: the most common pair of (last year, this year's target) is summarised, the rest listed
    var pairKey = function (d) { return (d.prior ? d.prior.raw : '—') + '|' + (d.annualTarget ? d.annualTarget.raw : '—') }
    var counts = {}
    com.forEach(function (d) { var k = pairKey(d); counts[k] = (counts[k] || 0) + 1 })
    var common = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a] })[0]
    var others = com.filter(function (d) { return pairKey(d) !== common })
    var sample = com.filter(function (d) { return pairKey(d) === common })[0]
    var scaleNote = com.some(function (d) { return d.prior && d.prior.unit === '' && d.annualTarget && d.annualTarget.unit === '%' })
    var shownOthers = others.length > 7 ? others.slice(0, 6) : others
    var crows = shownOthers.map(function (d) { return '<div class="crow"><span class="n">' + esc(name(d)) + '</span><span>' + rv(d.prior) + '</span><span>' + rv(d.annualTarget) + '</span></div>' }).join('') +
      (others.length > shownOthers.length ? '<div class="crow more">و' + (others.length - shownOthers.length) + ' فروع أخرى</div>' : '')
    var issues = []
    com.forEach(function (d) { if (d.prior && d.prior.unit === '%' && nv(d.prior) > 100) issues.push([name(d), 'نتيجة جودة التواصل للعام السابق مكتوبة ' + rv(d.prior)]) })
    ind.forEach(function (d) { if (d.annualTarget && nv(d.annualTarget) === 0) issues.push([name(d), 'المستهدف السنوي لـ' + esc(d.title || '') + ' ' + rv(d.annualTarget)]) })
    var comCard = '<div class="card"><h2>معامل جودة التواصل <span>كما في ملف كل فرع</span></h2>' +
      (scaleNote ? '<p class="note top one">نتيجة العام السابق بمقياس من 3، ومستهدف هذا العام نسبة مئوية، فلا يُقارنان.</p>' : '') +
      (sample ? '<p class="common"><b>' + counts[common] + ' فرعًا</b> العام السابق ' + rv(sample.prior) + ' · مستهدف العام ' + rv(sample.annualTarget) + '</p>' : '') +
      (others.length ? '<div class="crow ch"><span class="n">بقية الفروع</span><span>العام السابق</span><span>مستهدف العام</span></div>' + crows : '') + '</div>'
    var shownIssues = issues.length > 3 ? issues.slice(0, 2) : issues
    var issueCard = issues.length ? '<div class="card"><h2>ملاحظات على الملفات</h2><ul class="issues">' + shownIssues.map(function (x) { return '<li><b>' + esc(x[0]) + ':</b> ' + x[1] + '</li>' }).join('') +
      (issues.length > shownIssues.length ? '<li class="more">و' + (issues.length - shownIssues.length) + ' ملاحظات أخرى</li>' : '') + '</ul></div>' : ''
    return header() + kpis +
      '<section class="body b2"><div class="card big"><h2>معامل رضا العملاء <span>الشريط = نتيجة العام السابق · العلامة الذهبية = مستهدف هذا العام</span></h2>' +
      '<div class="irow ih"><span class="n">الفرع</span><span class="tw"></span><b>العام السابق</b><span class="m">مستهدف العام</span><span class="m">الفصل الأول</span></div>' +
      '<div class="bars">' + rows + '</div></div>' +
      '<div class="col">' + comCard + issueCard + '</div></section>'
  }

  /* ------------------------------------------------------------ 3 · CSR (branch plans) */
  function view3() {
    var plans = data.plans
    if (!plans.length) return empty('لا توجد خطط مقروءة بعد', 'تُقرأ خطط المسؤولية المجتمعية لكل فرع مع «حدث المؤشرات».')
    var TR = { edu: 'المسار التعليمي', val: 'المسار التربوي القيمي' }
    var name = function (p) { return BRANCH[p.branch || p.id] || p.branch || p.id }
    var pv = function (s) { var n = parseFloat(String(s || '0').replace('%', '')); return isNaN(n) ? 0 : n }
    var shown = function (s) { return L(String(s || '0%').replace(/\.00%$/, '%').replace(/(\.\d)\d%$/, '$1%')) }
    var rows = [], nolink = [], noProjects = [], missing = [], all = 0, approved = 0, edu = 0, val = 0, other = 0
    plans.forEach(function (p) {
      if (p.status !== 'ok') { nolink.push(name(p)); return }
      var pr = (p.projects || []).filter(function (x) { return !x.empty })
      var ac = ((p.kpi || []).filter(function (k) { return k.col === 'AC' })[0] || {}).value || '0%'
      var e = pr.filter(function (x) { return x.track === 'edu' }).length, v = pr.filter(function (x) { return x.track === 'val' }).length
      var a = pr.filter(function (x) { return x.approval === 'معتمد' }).length
      all += pr.length; approved += a; edu += e; val += v; other += pr.length - e - v
      if (!pr.length) noProjects.push(name(p))
      else if (!e || !v) missing.push([name(p), !e ? TR.edu : TR.val])
      rows.push({ n: name(p), projects: pr.length, edu: e, val: v, approved: a, ac: ac })
    })
    rows.sort(function (a, b) { return pv(b.ac) - pv(a.ac) || b.approved - a.approved || b.projects - a.projects || (a.n < b.n ? -1 : 1) })
    var startedRows = rows.filter(function (r) { return pv(r.ac) > 0 })
    var noneApproved = rows.filter(function (r) { return r.projects && !r.approved }).length
    var kpis = '<section class="kpis">' +
      '<div class="k hero"><span>فروع لها خطة</span><b>' + rows.length + of(plans.length) + '</b><small>' + (nolink.length ? 'بلا رابط في سجل المسؤولية المجتمعية: ' + esc(nolink.join('، ')) : 'كل الفروع لها رابط خطة') + '</small></div>' +
      '<div class="k"><span>المشاريع المخططة</span><b>' + all + '</b><small>تعليمي ' + edu + ' · تربوي قيمي ' + val + (other ? ' · أخرى ' + other : '') + '</small></div>' +
      '<div class="k"><span>المشاريع المعتمدة</span><b>' + approved + of(all) + '</b><small>الاعتماد كما في عمود الاعتماد بكل خطة</small></div>' +
      '<div class="k"><span>فروع بدأ تحقق مستهدفها</span><b>' + startedRows.length + of(rows.length) + '</b><small>' + (startedRows.length ? startedRows.map(function (r) { return esc(r.n) + ' ' + shown(r.ac) }).join('، ') : 'لا يوجد بعد') + '</small></div></section>'
    var yes = '<span class="yes">✓</span>', no = '<span class="no">—</span>'
    var trs = rows.map(function (r) {
      return '<tr><td class="n">' + esc(r.n) + '</td><td class="c">' + (r.projects || no) + '</td><td class="c">' + (r.edu ? yes : no) + '</td><td class="c">' + (r.val ? yes : no) + '</td>' +
        '<td class="c">' + (r.approved ? '<span class="yes">' + r.approved + '</span>' : '<span class="no">0</span>') + '</td>' +
        '<td><span class="mini"><i style="width:' + Math.min(pv(r.ac), 100).toFixed(0) + '%"></i></span>' + shown(r.ac) + '</td></tr>'
    }).join('')
    var follow = []
    if (nolink.length) follow.push([nolink.join('، '), 'لا رابط لخطتها في سجل روابط المسؤولية المجتمعية'])
    noProjects.forEach(function (n) { follow.push([n, 'الخطة موجودة بلا مشاريع مكتوبة']) })
    missing.forEach(function (m) { follow.push([m[0], 'لا يوجد مشروع في ' + m[1]]) })
    if (noneApproved) follow.push([noneApproved + (noneApproved > 10 ? ' فرعًا' : ' فروع'), 'لم يُعتمد أي مشروع من خطتها بعد'])
    var shownFollow = follow.length > 5 ? follow.slice(0, 4) : follow
    var flist = follow.length ? '<ul class="list miss">' + shownFollow.map(function (f) { return '<li><div class="nm"><b>' + esc(f[0]) + '</b><span>' + esc(f[1]) + '</span></div></li>' }).join('') +
      (follow.length > shownFollow.length ? '<li class="more">و' + (follow.length - shownFollow.length) + ' ملاحظات أخرى في تبويب خطط الفروع</li>' : '') + '</ul>' : '<p class="none">لا ملاحظات على الخطط</p>'
    var tracks = [['المسار التعليمي', edu, '#33bdf2'], ['المسار التربوي القيمي', val, '#d8b14b']]
    if (other) tracks.push(['مشاريع إضافية', other, '#8f8fe6'])
    var maxT = max(tracks.map(function (x) { return x[1] })) || 1
    var tbars = tracks.map(function (x) { return '<div class="br t"><span class="n">' + x[0] + '</span><span class="tw"><span class="tr" style="display:block"><i style="background:' + x[2] + ';width:' + (x[1] / maxT * 100).toFixed(1) + '%"></i></span></span><b>' + x[1] + '</b></div>' }).join('')
    return header() + kpis +
      '<section class="body b3"><div class="card big"><h2>خطة كل فرع <span>«تحقق مستهدف العام» كما في ورقة كل فرع</span></h2>' +
      '<table class="ct"><thead><tr><th>الفرع</th><th>المشاريع</th><th>تعليمي</th><th>تربوي قيمي</th><th>معتمد</th><th>تحقق مستهدف العام</th></tr></thead><tbody>' + trs + '</tbody></table></div>' +
      '<div class="col"><div class="card"><h2>تحتاج متابعة</h2>' + flist + '</div>' +
      '<div class="card"><h2>المشاريع حسب المسار</h2><div class="tb">' + tbars + '</div></div></div></section>'
  }

  /* ------------------------------------------------------------ social readings shared by views 4 and 5 */
  function months() {
    var seen = {}
    data.readings.forEach(function (r) { if (r.month) seen[r.month] = 1 })
    return Object.keys(seen).sort()
  }
  function latestMonth() { var m = months(); return m[m.length - 1] || null }
  /** followers this month and last month for the accounts that pass `keep` */
  function socialMonth(keep) {
    var ms = months(), cur = ms[ms.length - 1] || null, prev = ms[ms.length - 2] || null
    var A = {}
    data.accounts.forEach(function (a) { if (keep(a)) A[a.id] = a })
    var now = {}, before = {}
    data.readings.forEach(function (r) { if (!A[r.account]) return; if (r.month === cur) now[r.account] = r.followers; else if (r.month === prev) before[r.account] = r.followers })
    return { cur: cur, prev: prev, A: A, now: now, before: before, ids: Object.keys(A) }
  }
  function monthWord(ym) { return fmtMonth(ym).split(' ')[0] }

  /* ------------------------------------------------------------ 4 · social media by school */
  var SCHOOLS = [
    ['ahlia', 'الأهلية', 'مدارس الأندلس الأهلية'],
    ['alamia', 'العالمية', 'مدارس الأندلس العالمية'],
    ['little', 'الأندلس الصغيرة', 'الأندلس الصغيرة العالمية'],
    ['company', 'الشركة', 'شركة الأندلس التعليمية'],
  ]
  function schoolOf(a) {
    var n = String(a.name || '')
    for (var i = 0; i < SCHOOLS.length; i++) if (n === SCHOOLS[i][2]) return SCHOOLS[i][0]
    if (n.indexOf('الصغيرة') >= 0) return 'little'
    if (n.indexOf('شركة') >= 0) return 'company'
    if (n.indexOf('العالمية') >= 0) return 'alamia'
    if (n.indexOf('الأهلية') >= 0) return 'ahlia'
    return null
  }
  function view4() {
    var s = socialMonth(function (a) { return a.platform !== 'whatsapp' })
    if (!s.cur) return empty('لا توجد قراءات بعد', 'تُسجَّل أعداد المتابعين شهريًا في تبويب التواصل الاجتماعي.')
    var grand = 0, biggest = null, unknown = 0
    var cards = SCHOOLS.map(function (sc) {
      var ids = s.ids.filter(function (a) { return schoolOf(s.A[a]) === sc[0] })
      ids.sort(function (a, b) { return (s.now[b] || 0) - (s.now[a] || 0) })
      var total = ids.reduce(function (t, a) { return t + (s.now[a] || 0) }, 0)
      grand += total
      ids.forEach(function (a) { if (s.now[a] != null && (!biggest || s.now[a] > s.now[biggest])) biggest = a })
      var both = ids.filter(function (a) { return s.now[a] != null && s.before[a] != null })
      var dl = both.reduce(function (t, a) { return t + s.now[a] - s.before[a] }, 0)
      var mx = max(ids.map(function (a) { return s.now[a] || 0 })) || 1
      var change = both.length && s.prev
        ? '<span class="' + (dl >= 0 ? 'pos' : 'neg') + '">' + L((dl >= 0 ? '+' : '−') + num(Math.abs(dl))) + '</span> عن ' + esc(monthWord(s.prev)) + ' (' + both.length + (both.length > 2 && both.length < 11 ? ' حسابات' : ' حساب') + ')'
        : 'أول قراءة في ' + esc(monthWord(s.cur))
      var rows = ids.map(function (a) {
        var v = s.now[a]
        return '<div class="prow">' + logo(s.A[a].platform) + '<span class="tw"><span class="tr"><i style="background:#d8b14b;width:' + ((v || 0) / mx * 100).toFixed(1) + '%"></i></span></span><b>' + (v != null ? num(v) : '<span class="no">—</span>') + '</b></div>'
      }).join('')
      return '<div class="card sc"><div class="bhd"><img src="../brands/' + sc[0] + '.webp" alt=""><div><b>' + sc[1] + '</b><span>' + esc(sc[2]) + ' · ' + ids.length + (ids.length > 2 && ids.length < 11 ? ' حسابات' : ' حساب') + '</span></div></div>' +
        '<div class="btot">' + num(total) + '</div><p class="bchg">' + change + '</p><div class="plist">' + rows + '</div><p class="bshare" data-total="' + total + '"></p></div>'
    }).join('')
    s.ids.forEach(function (a) { if (!schoolOf(s.A[a])) unknown++ })
    cards = cards.replace(/<p class="bshare" data-total="(\d+)"><\/p>/g, function (m, t) { return '<p class="bshare">' + (grand ? pct(+t / grand) + ' من إجمالي المتابعين' : '') + '</p>' })
    var kpis = '<section class="kpis slim">' +
      '<div class="k hero row"><span>إجمالي متابعي حسابات المدارس والشركة</span><b>' + num(grand) + '</b></div>' +
      (biggest ? '<div class="k row"><span>أكبر حساب</span><b>' + logo(s.A[biggest].platform) + '<span class="bv">' + num(s.now[biggest]) + '</span></b><small>' + esc(PLATFORM[s.A[biggest].platform] || '') + ' ' + esc((SCHOOLS.filter(function (x) { return x[0] === schoolOf(s.A[biggest]) })[0] || ['', ''])[1]) + '</small></div>' : '') +
      '</section>'
    return header() + kpis + '<section class="body b4">' + cards + '</section>' + (unknown ? '<p class="foot-note">' + unknown + ' حساب لا يتبع مدرسة معروفة ولم يُحتسب.</p>' : '')
  }

  /* ------------------------------------------------------------ 5 · WhatsApp channels */
  function view5() {
    var s = socialMonth(function (a) { return a.platform === 'whatsapp' })
    var ids = s.ids.filter(function (a) { return s.now[a] != null })
    if (!s.cur || !ids.length) return empty('لا توجد قراءات للقنوات بعد', 'تُسجَّل أعداد المشتركين شهريًا في صفحة قنوات الواتساب.')
    ids.sort(function (a, b) { return s.now[b] - s.now[a] })
    var total = ids.reduce(function (t, a) { return t + s.now[a] }, 0)
    var both = ids.filter(function (a) { return s.before[a] != null })
    var dl = both.reduce(function (t, a) { return t + s.now[a] - s.before[a] }, 0)
    var up = both.filter(function (a) { return s.now[a] > s.before[a] }).length, down = both.filter(function (a) { return s.now[a] < s.before[a] }).length
    var company = ids.filter(function (a) { return s.A[a].owner === 'company' }).length
    var mx = s.now[ids[0]] || 1
    var row = function (a) {
      var d = s.before[a] != null ? s.now[a] - s.before[a] : null
      var chip = d === null ? '<span class="dlt no">جديدة</span>' : '<span class="dlt ' + (d > 0 ? 'up' : d < 0 ? 'dn' : 'no') + '">' + L((d > 0 ? '+' : d < 0 ? '−' : '') + num(Math.abs(d))) + '</span>'
      return '<div class="wrow"><span class="n">' + esc(s.A[a].name) + '</span><span class="tw"><span class="tr"><i style="background:#25D366;width:' + (s.now[a] / mx * 100).toFixed(1) + '%"></i></span></span><b>' + num(s.now[a]) + '</b>' + chip + '</div>'
    }
    var half = Math.ceil(ids.length / 2)
    var kpis = '<section class="kpis">' +
      '<div class="k hero"><span>إجمالي المشتركين</span><b>' + num(total) + '</b><small>' + ids.length + ' قناة' + (company ? ': ' + (ids.length - company) + ' للفروع و' + (company === 1 ? 'قناة' : company + ' قنوات') + ' للشركة' : '') + ' · ' + esc(fmtMonth(s.cur)) + '</small></div>' +
      (s.prev && both.length ? '<div class="k"><span>الفرق عن ' + esc(monthWord(s.prev)) + '</span><b class="' + (dl >= 0 ? 'pos' : 'neg') + '">' + L((dl >= 0 ? '+' : '−') + num(Math.abs(dl))) + '</b><small>على ' + both.length + ' قناة لها قراءة في الشهرين</small></div>' +
        '<div class="k"><span>قنوات زادت / تراجعت</span><b><span class="pos">' + up + '</span><span class="sep">/</span><span class="neg">' + down + '</span></b><small>مقارنة بقراءة ' + esc(monthWord(s.prev)) + '</small></div>' : '') +
      '<div class="k"><span>أكبر قناة</span><b>' + num(s.now[ids[0]]) + '</b><small>' + esc(s.A[ids[0]].name) + '</small></div></section>'
    return header() + kpis +
      '<section class="body eq"><div class="card"><h2>القنوات <span>المشتركون · الفرق عن ' + esc(s.prev ? monthWord(s.prev) : 'الشهر السابق') + '</span></h2><div class="bars">' + ids.slice(0, half).map(row).join('') + '</div></div>' +
      '<div class="card"><h2>&nbsp;</h2><div class="bars">' + ids.slice(half).map(row).join('') + '</div></div></section>'
  }

  /* ------------------------------------------------------------ 6 · السنترال: كل تحويلات الفروع */
  // الفرع والقسم من رقم التحويلة، بالجدول نفسه في src/lib/pbxBranches.ts (RANGES): عدّلهما معًا
  var HQ = 'الإدارة العامة'
  var PBX_RANGES = [
    [1000, 1199, HQ, 'إدارات الشركة'],
    [1200, 1299, 'الزهراء', 'بنات · رياض الأطفال'], [1300, 1399, 'الزهراء', 'بنين · ابتدائي'], [1400, 1499, 'الزهراء', 'بنات · ابتدائي'],
    [1500, 1599, 'الزهراء', 'بنين · متوسط'], [1600, 1699, 'الزهراء', 'بنات · متوسط'], [1700, 1799, 'الزهراء', 'بنين · ثانوي'], [1800, 1899, 'الزهراء', 'بنات · ثانوي'],
    [1900, 1999, 'الروضة', 'بنين'], [2000, 2099, 'الروضة', 'بنات'], [2100, 2199, 'الحمدانية', 'بنين · متوسط وثانوي'], [2200, 2299, 'الزهراء', 'الطفولة المبكرة'],
    [2300, 2399, 'مكة', 'بنين · ابتدائي'], [2400, 2499, 'مكة', 'بنات · رياض وابتدائي'], [2500, 2599, 'مكة', 'بنين · متوسط وثانوي'], [2600, 2699, 'مكة', 'بنات · متوسط وثانوي'],
    [2700, 2799, 'الطائف', 'بنين · ابتدائي'], [2800, 2899, 'الطائف', 'بنين · متوسط'], [2900, 2999, 'الطائف', 'بنين · ثانوي'], [3000, 3099, 'الطائف', 'بنات'],
    [3100, 3199, 'أبها', 'بنين · ابتدائي'], [3200, 3299, 'أبها', 'بنين · متوسط'], [3300, 3399, 'أبها', 'بنين · ثانوي'], [3400, 3499, 'أبها', 'بنات'],
    [3500, 3599, 'خميس مشيط', 'بنين · ابتدائي'], [3600, 3699, 'خميس مشيط', 'بنين · متوسط'], [3700, 3799, 'خميس مشيط', 'بنين · ثانوي'], [3800, 3899, 'خميس مشيط', 'بنات'],
    [3900, 3999, 'الجوف', 'بنين · ابتدائي'], [4000, 4099, 'الجوف', 'بنين · متوسط'], [4100, 4199, 'الجوف', 'بنين · ثانوي'], [4200, 4299, 'الجوف', 'بنات · ابتدائي'], [4300, 4399, 'الجوف', 'بنات · متوسط وثانوي'],
    [4400, 4499, 'الحمدانية', 'بنين · ابتدائي أهلي'], [4500, 4599, 'الحمدانية', 'المسار المصري'], [4600, 4699, 'الحمدانية', 'بنات · ابتدائي'], [4700, 4799, 'الحمدانية', 'بنات · متوسط وثانوي'],
    [4800, 4899, 'نجران', 'بنين'], [4900, 4999, 'نجران', 'بنات'], [5000, 5099, 'الشاطئ موهبة', 'بنين'], [5100, 5199, 'الحمدانية', 'رياض الأطفال'],
    [5200, 5299, 'الشاطئ العالمية', 'بنين'], [5300, 5399, 'الشاطئ العالمية', 'بنات · ابتدائي'], [5400, 5499, 'الطائف', 'بنات · رياض ودبلوما'], [5500, 5599, 'الحمدانية', 'دبلوما'],
    [5600, 5699, 'الشاطئ موهبة', 'بنات'], [5700, 5799, 'الفيحاء', 'بنين'], [5800, 5899, 'الفيحاء', 'بنات · أهلي'], [5900, 5999, 'الشاطئ العالمية', 'بنات · متوسط وثانوي'],
    [6000, 6099, 'الفيحاء', 'بنات · عالمي'], [6100, 6199, 'الفيحاء', 'بنات · المسار الموازي'], [6200, 6299, 'المنار', 'بنين'], [6300, 6399, 'أبحر', 'بنين · أهلي'],
    [6400, 6499, 'أبحر', 'بنات · عالمي'], [6500, 6599, 'المنار', 'بنات · أهلي'], [6600, 6699, 'أبحر', 'بنات · أهلي'], [6700, 6799, 'الروضة', 'رياض الأطفال'],
    [6800, 6899, 'المنار', 'بنات · عالمي ورياض'], [6900, 6999, 'الرياض', 'بنين · أهلي'], [7000, 7099, 'الرياض', 'بنين · عالمي'], [7100, 7199, 'الرياض', 'بنات · أهلي'],
    [7200, 7299, 'الرياض', 'بنات · عالمي والأوائل'], [7300, 7399, 'أبها', 'عالمي · بنين'], [7400, 7499, 'أبها', 'عالمي · بنات'], [7500, 7599, 'أبحر', 'بنين · عالمي']
  ]
  var PBX_TOP = { '1111': 1, '2222': 1, '3333': 1, '4444': 1, '5555': 1, '6666': 1, '9999': 1 }
  var PBX_ORDER = ['الزهراء', 'الروضة', 'الحمدانية', 'مكة', 'الطائف', 'أبها', 'خميس مشيط', 'الجوف', 'نجران', 'الشاطئ العالمية', 'الشاطئ موهبة', 'الفيحاء', 'المنار', 'أبحر', 'الرياض']
  var PBX_SMALL = 5, PBX_FOLLOW = 5
  function pbxPlace(ext, entry) {
    if (PBX_TOP[ext]) return [HQ, 'الإدارة العليا']
    var n = +ext
    for (var i = 0; i < PBX_RANGES.length; i++) { var r = PBX_RANGES[i]; if (n >= r[0] && n <= r[1]) return [r[2], r[3]] }
    if (entry && entry.hq) return [HQ, entry.section || 'إدارات أخرى']
    return null
  }
  function pbxLastDay(ym) { var p = ym.split('-'); return ym + '-' + ('0' + new Date(+p[0], +p[1], 0).getDate()).slice(-2) }
  function pbxPartial(r) { return !!(r.from && r.to && (r.from > r.month + '-01' || r.to < pbxLastDay(r.month))) }
  function pbxZero() { return { att: 0, ans: 0, un: 0, vm: 0, exts: 0 } }
  function pbxAdd(t, l) { t.att += l.attempts || 0; t.ans += l.answered || 0; t.un += l.unanswered || 0; t.vm += l.voicemail || 0; t.exts++ }
  function pbxRate(t) { return t.att ? t.ans / t.att : null }
  function pbxGrade(t) { var r = pbxRate(t); if (r === null) return 'none'; if (t.att < PBX_SMALL) return 'sm'; return r >= 0.7 ? 'ok' : r >= 0.5 ? 'warn' : 'bad' }
  function cnt(n, one, two, few, many) { return n === 1 ? one : n === 2 ? two : n >= 3 && n <= 10 ? num(n) + ' ' + few : num(n) + ' ' + many }
  /** the month grouped like the portal's «الفروع» tab (src/lib/pbxBranches.ts branchView) */
  function pbxView(rep) {
    var dir = {}, off = {}
    ;((pbxDir && pbxDir.entries) || []).forEach(function (e) { dir[e.ext] = e })
    data.pbxOfficers.forEach(function (o) { if (o.active !== false) (o.exts || []).forEach(function (x) { off[x] = o }) })
    var groups = {}, hq = null, tot = pbxZero(), offT = pbxZero(), othT = pbxZero(), ring = [], follow = []
    ;(rep.lines || []).forEach(function (l) {
      var e = dir[l.ext] || null, p = pbxPlace(l.ext, e)
      if (!p) return
      var row = { l: l, e: e, p: p, o: off[l.ext] || null }
      if (p[0] === HQ) { if (!hq) hq = { t: pbxZero(), rows: [] }; pbxAdd(hq.t, l); hq.rows.push(row); return }
      if (!groups[p[0]]) groups[p[0]] = pbxZero()
      pbxAdd(groups[p[0]], l); pbxAdd(tot, l); pbxAdd(row.o ? offT : othT, l)
      ;(l.ring || []).forEach(function (x) { ring.push(x) })
      if ((l.unanswered || 0) >= PBX_FOLLOW) follow.push(row)
    })
    var tier = function (b) { return b.att === 0 ? 2 : b.att < PBX_SMALL ? 1 : 0 }
    var branches = PBX_ORDER.map(function (n) { var g = groups[n] || pbxZero(); g.name = n; return g })
    branches.sort(function (a, b) { return tier(a) - tier(b) || (pbxRate(b) || -1) - (pbxRate(a) || -1) || b.att - a.att || PBX_ORDER.indexOf(a.name) - PBX_ORDER.indexOf(b.name) })
    follow.sort(function (a, b) { return b.l.unanswered - a.l.unanswered || b.l.attempts - a.l.attempts || +a.l.ext - +b.l.ext })
    ring.sort(function (a, b) { return a - b })
    var mid = Math.floor(ring.length / 2)
    return { tot: tot, off: offT, oth: othT, branches: branches, hq: hq, follow: follow, live: branches.filter(function (b) { return b.att > 0 }).length,
      ring: ring.length ? (ring.length % 2 ? ring[mid] : (ring[mid - 1] + ring[mid]) / 2) : null }
  }
  function view6() {
    var reps = data.pbxReports
    if (!reps.length) return empty('لم يُرفع تقرير السنترال بعد', 'يُرفع تقرير مكالمات 3CX من تبويب السنترال في المنصة.')
    var cur = reps[0], prev = reps[1] || null
    var v = pbxView(cur), pv = prev ? pbxView(prev) : null, t = v.tot, r = pbxRate(t)
    var cmp = function (a, b) { return a && b && a.att >= PBX_SMALL && b.att >= PBX_SMALL ? pbxRate(a) - pbxRate(b) : null }
    var dTot = pv ? cmp(t, pv.tot) : null
    var gcls = function (x) { var g = pbxGrade(x); return g === 'ok' ? 'pos' : g === 'bad' ? 'neg' : g === 'warn' ? 'wrn' : '' }
    var share = t.att ? Math.round(v.off.att / t.att * 100) : 0
    var sec = v.ring === null ? null : Math.round(v.ring)
    var kpis = '<section class="kpis">' +
      '<div class="k hero h6"><span>نسبة الرد في الفروع</span><b>' + (r === null ? '—' : pct(r)) +
        (dTot !== null ? '<i class="chip ' + (dTot >= 0 ? 'ok' : 'bad') + '">' + L((dTot > 0 ? '+' : dTot < 0 ? '−' : '') + Math.abs(dTot * 100).toFixed(1)) + ' عن ' + esc(monthWord(prev.month)) + '</i>' : '') +
        '</b><small>رد على ' + num(t.ans) + ' من ' + num(t.att) + ' مكالمة محوّلة</small></div>' +
      '<div class="k"><span>المكالمات المحوّلة</span><b>' + num(t.att) + '</b><small>إلى ' + cnt(t.exts, 'تحويلة واحدة', 'تحويلتين', 'تحويلات', 'تحويلة') + ' في ' + cnt(v.live, 'فرع واحد', 'فرعين', 'فروع', 'فرعًا') + '</small></div>' +
      '<div class="k"><span>لم يُرد عليها</span><b>' + num(t.un) + '</b><small>منها ' + num(t.vm) + ' انتهت في البريد الصوتي</small></div>' +
      '<div class="k"><span>سرعة الرد</span><b>' + (sec === null ? '—' : num(sec) + '<span class="unit">' + (sec >= 3 && sec <= 10 ? 'ثوانٍ' : 'ثانية') + '</span>') + '</b><small>' + (sec === null ? 'لا يحمل الملف مدة الرنين' : 'نصف المكالمات المُجابة رُد عليها خلالها أو أقل') + '</small></div>' +
      '<div class="k"><span>الرد: المسؤولون · البقية</span><b class="duo"><span class="' + gcls(v.off) + '">' + (v.off.att ? L((pbxRate(v.off) * 100).toFixed(0) + '%') : '—') + '</span><span class="sep">/</span><span class="' + gcls(v.oth) + '">' + (v.oth.att ? L((pbxRate(v.oth) * 100).toFixed(0) + '%') : '—') + '</span></b>' +
        '<small>استقبل مسؤولو التواصل ' + L(share + '%') + ' من المكالمات</small></div></section>'
    var rows = v.branches.map(function (b) {
      var g = pbxGrade(b), br = pbxRate(b)
      var p = pv ? pv.branches.filter(function (x) { return x.name === b.name })[0] : null, d = cmp(b, p)
      var dl = pv ? '<span class="dlt ' + (d === null ? 'no' : d > 0 ? 'up' : d < 0 ? 'dn' : 'no') + '">' + (d === null ? '—' : L((d > 0 ? '+' : d < 0 ? '−' : '') + Math.abs(d * 100).toFixed(0))) + '</span>' : ''
      return '<div class="rrow"><span class="n">' + esc(b.name) + '</span><span class="tw"><span class="tr">' + (br === null ? '' : '<i class="' + g + '" style="width:' + Math.max(br * 100, 2).toFixed(1) + '%"></i>') + '</span></span>' +
        '<b class="g-' + g + '">' + (br === null ? '—' : pct(br)) + '</b><small>' + (b.att ? num(b.ans) + ' من ' + num(b.att) : 'لا تحويلات') + '</small>' + dl + '</div>'
    }).join('')
    var who = function (x) { return x.o ? x.o.name : x.e && x.e.name ? x.e.name : x.e ? 'بلا اسم في الدليل' : 'غير موجود في الدليل' }
    var role = function (x) { return x.e && x.e.title ? x.e.title : x.o ? 'مسؤول التواصل' : '' }
    var fl = v.follow, shown = fl.length > 5 ? fl.slice(0, 4) : fl
    var flist = fl.length ? '<ul class="list flw">' + shown.map(function (x) {
      return '<li><div class="nm"><b><span class="xt">' + L(esc(x.l.ext)) + '</span>' + esc(who(x)) + (x.o ? ' <i class="tag">مسؤول التواصل</i>' : '') + '</b><span>' + esc(x.p[0] + ' · ' + x.p[1] + (role(x) && !x.o ? ' · ' + role(x) : '')) + '</span></div>' +
        '<span class="v neg">' + num(x.l.unanswered) + '</span><span class="vs">بلا رد<br>من ' + num(x.l.attempts) + '</span></li>'
    }).join('') + (fl.length > shown.length ? '<li class="more">و' + (fl.length - shown.length) + ' تحويلات أخرى في تبويب السنترال</li>' : '') + '</ul>' : '<p class="none">لا توجد تحويلة لم يُرد فيها على ' + PBX_FOLLOW + ' مكالمات أو أكثر</p>'
    var hqCard = ''
    if (v.hq) {
      var top = v.hq.rows.slice().sort(function (a, b) { return b.l.attempts - a.l.attempts })[0], hr = pbxRate(v.hq.t)
      hqCard = '<div class="card hqc"><h2>الإدارة العامة <span>خارج ترتيب الفروع</span></h2><p class="hqr"><b class="g-' + pbxGrade(v.hq.t) + '">' + (hr === null ? '—' : pct(hr)) + '</b>رد على ' + num(v.hq.t.ans) + ' من ' + num(v.hq.t.att) + ' مكالمة</p>' +
        (top ? '<p class="hqt"><span class="xt">' + L(esc(top.l.ext)) + '</span>' + esc(top.e && top.e.title ? top.e.title : who(top)) + ' · رد على ' + num(top.l.answered) + ' من ' + num(top.l.attempts) + '</p>' : '') + '</div>'
    }
    return header() + kpis +
      '<section class="body b6"><div class="card big"><h2>ترتيب الفروع حسب نسبة الرد <span>كل تحويلات الفرع' + (pv ? ' · الفرق عن ' + esc(monthWord(prev.month)) + ' بالنقاط' : '') + '</span></h2>' +
      '<div class="rrow rh"><span class="n">الفرع</span><span class="tw"></span><b>نسبة الرد</b><small>رد / المكالمات</small>' + (pv ? '<span class="dlt">عن ' + esc(monthWord(prev.month)) + '</span>' : '') + '</div>' +
      '<div class="bars">' + rows + '</div>' +
      keys([['ok', 'جيدة: ' + L('70%') + ' فأكثر'], ['warn', 'متابعة: ' + L('50–70%')], ['bad', 'ضعيفة: أقل من ' + L('50%')], ['sm', 'أقل من ' + PBX_SMALL + ' مكالمات']]) + '</div>' +
      '<div class="col"><div class="card"><h2>تحويلات تحتاج متابعة <span>' + PBX_FOLLOW + ' مكالمات بلا رد أو أكثر</span></h2>' + flist + '</div>' + hqCard + '</div></section>'
  }

  /* ------------------------------------------------------------ render and control */
  function footer() {
    var st = online ? 'آخر تحديث ' + timeFmt.format(lastOk || new Date()) : 'غير متصل · آخر تحديث ' + (lastOk ? timeFmt.format(lastOk) : '—')
    return '<div class="hint"><span>' + (EMBED ? 'اختر العرض من القائمة أو بالأرقام ' : 'اختر العرض: <kbd>OK</kbd> يفتح القائمة، أو الأرقام ') + '<kbd>1</kbd>–<kbd>' + N + '</kbd> أو الأسهم <kbd>→</kbd><kbd>←</kbd></span>' +
      '<span class="state' + (online ? '' : ' off') + '" id="state">' + esc(st) + '</span></div>'
  }
  function render() {
    var body = [view1, view2, view3, view4, view5, view6][view - 1]()
    app.innerHTML = body + footer()
  }
  function setView(v) {
    v = ((v - 1 + N) % N) + 1
    if (v === view && app.querySelector('.hd')) return
    view = v
    try { localStorage.setItem(VIEW_STORE, String(v)) } catch (e) { /* no storage */ }
    if (started) render()
    if (EMBED) try { window.parent.postMessage({ type: 'andalus-screen-view', view: v }, location.origin) } catch (e) { /* not framed */ }
  }

  function stopTimers() { clearInterval(pollTimer); pollTimer = null; started = false }
  function tickClock() {
    var now = new Date(), c = document.getElementById('clk'), d = document.getElementById('day')
    if (c) c.textContent = timeFmt.format(now)
    if (d) d.textContent = dayFmt.format(now)
    // pick up a new version of the page once a night (the TV only)
    if (!EMBED && now.getHours() === 3 && now.getMinutes() === 30 && performance.now() > 120000) location.reload()
  }
  setInterval(tickClock, 10000)

  async function allowed() {
    var me = (await api('/rest/v1/rpc/me', { method: 'POST', body: {} })) || []
    return me[0] && (me[0].role === 'screen' || me[0].role === 'owner') ? me[0] : null
  }
  async function poll() {
    try {
      var changed = await load()
      if (!data.counts && !data.plans.length && !data.indicators.length && !(await allowed())) { saveSession(null); showLogin('هذا الحساب موقوف أو لم يعد حساب شاشة.'); return }
      if (changed) render()
      else { var s = document.getElementById('state'); if (s) { s.className = 'state'; s.textContent = 'آخر تحديث ' + timeFmt.format(lastOk) } }
    } catch (e) {
      if (e.status === 401 || e.status === 400) { saveSession(null); showLogin('انتهت صلاحية الدخول. ادخل مرة أخرى.'); return }
      online = false
      var st = document.getElementById('state')
      if (st) { st.className = 'state off'; st.textContent = 'غير متصل · آخر تحديث ' + (lastOk ? timeFmt.format(lastOk) : '—') }
    }
  }

  /* keys: 1-6 pick a view, arrows step through them (left = next, as the views run right to left),
     OK (or down) opens the views list; in it up/down move, OK picks, back closes */
  var KEYS = { 49: 1, 50: 2, 51: 3, 52: 4, 53: 5, 54: 6, 97: 1, 98: 2, 99: 3, 100: 4, 101: 5, 102: 6 }
  var listTimer = null
  function listEl() { return document.getElementById('vlist') }
  function listItems() { var l = listEl(); return l ? [].slice.call(l.querySelectorAll('.vi')) : [] }
  function listOpen() { var l = listEl(); return !!(l && l.classList.contains('on')) }
  function armList() { clearTimeout(listTimer); listTimer = setTimeout(closeList, 10000) }
  function openList() {
    var l = listEl(), b = document.getElementById('vsel')
    if (!l) return
    l.classList.add('on')
    if (b) b.setAttribute('aria-expanded', 'true')
    var cur = l.querySelector('.vi.on') || listItems()[0]
    if (cur) cur.focus()
    armList()
  }
  function closeList() {
    var l = listEl(), b = document.getElementById('vsel')
    clearTimeout(listTimer)
    if (l) l.classList.remove('on')
    if (b) b.setAttribute('aria-expanded', 'false')
  }
  function moveFocus(d) {
    var it = listItems()
    if (!it.length) return
    var i = it.indexOf(document.activeElement)
    it[i < 0 ? 0 : (i + d + it.length) % it.length].focus()
    armList()
  }
  function activate(el) {
    if (!el) return
    var v = el.getAttribute('data-v'), act = el.getAttribute('data-act')
    closeList()
    if (v) setView(+v)
    else if (act === 'full') { var de = document.documentElement, f = de.requestFullscreen || de.webkitRequestFullscreen; if (f) f.call(de) }
    else if (act === 'out' && window.confirm('تسجيل خروج الشاشة؟')) { saveSession(null); data = EMPTY_DATA(); showLogin() }
  }
  document.addEventListener('keydown', function (e) {
    if (!started) return
    var k = e.key, code = e.keyCode
    var n = /^[1-6]$/.test(k) ? +k : KEYS[code]
    if (n) { e.preventDefault(); closeList(); setView(n); return }
    if (listOpen()) {
      if (k === 'ArrowDown' || code === 40) { e.preventDefault(); moveFocus(1); return }
      if (k === 'ArrowUp' || code === 38) { e.preventDefault(); moveFocus(-1); return }
      if (k === 'Enter' || code === 13) { e.preventDefault(); var a = document.activeElement; activate(a && a.classList && a.classList.contains('vi') ? a : null); return }
      if (k === 'Escape' || code === 461 || code === 10009 || k === 'GoBack' || code === 8 || k === 'ArrowLeft' || code === 37 || k === 'ArrowRight' || code === 39) { e.preventDefault(); closeList(); return }
      return
    }
    if (k === 'ArrowLeft' || code === 37) { e.preventDefault(); setView(view + 1); return }
    if (k === 'ArrowRight' || code === 39) { e.preventDefault(); setView(view - 1); return }
    if (k === 'Enter' || code === 13 || k === 'ArrowDown' || code === 40) { e.preventDefault(); openList() }
  })
  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin || !e.data || e.data.type !== 'andalus-screen') return
    if (e.data.view) { closeList(); setView(+e.data.view) }
    if (e.data.refresh && started) poll()
  })
  function inside(el, cls) {
    for (; el && el !== stage; el = el.parentNode) if (el.classList && el.classList.contains(cls)) return el
    return null
  }
  stage.addEventListener('click', function (e) {
    if (!started) return
    var item = inside(e.target, 'vi')
    if (item) { activate(item); return }
    if (inside(e.target, 'vsel')) { if (listOpen()) closeList(); else openList(); return }
    if (/BUTTON|INPUT/.test(e.target.tagName)) return
    if (listOpen()) closeList()
    else if (!EMBED) openList()
  })

  async function keepAwake() {
    try { if (!EMBED && 'wakeLock' in navigator && document.visibilityState === 'visible') await navigator.wakeLock.request('screen') } catch (e) { /* not offered */ }
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') { keepAwake(); if (started) poll() } })
  window.addEventListener('online', function () { if (started) poll() })

  /* ------------------------------------------------------------ start */
  async function start() {
    stopTimers()
    showMessage('جارٍ التحميل…', '')
    try {
      var m = await allowed()
      if (!m) { saveSession(null); showLogin('هذه الشاشة لحساب «شاشة عرض» أو مدير المنصة فقط.'); return }
      if (m.must_change_password && !EMBED) { showChangePassword(); return }
      await load()
      started = true
      render()
      if (EMBED) try { window.parent.postMessage({ type: 'andalus-screen-view', view: view }, location.origin) } catch (e) { /* not framed */ }
      pollTimer = setInterval(poll, POLL_MS)
      keepAwake()
    } catch (e) {
      if (e.status === 400 || e.status === 401) { saveSession(null); showLogin('انتهت صلاحية الدخول. ادخل مرة أخرى.'); return }
      showMessage('تعذّر الاتصال', 'ستعيد الشاشة المحاولة تلقائيًا خلال دقيقة.')
      setTimeout(start, POLL_MS)
    }
  }

  if (EMBED) start()
  else {
    session = loadSession()
    if (session && session.refresh_token) start()
    else showLogin()
  }
})()
