/*
 * شاشة أعداد الطلاب (للتلفزيون في غرفة المدير).
 * صفحة مستقلة عن تطبيق المنصة، مكتوبة بـ JavaScript قديم (ES2017، بلا ?. ولا ??)
 * لأن متصفحات التلفزيونات الذكية متأخرة عن المتصفحات الحديثة.
 * تدخل بحساب «شاشة عرض» (أو حساب مدير المنصة) وتقرأ studentCounts فقط عبر Supabase REST؛
 * قاعدة البيانات لا تعطي هذا الحساب أي شيء آخر (screen_collection في supabase/schema.sql).
 * الرابط والمفتاح العام (publishable) عامّان بطبيعتهما كما في src/config.ts.
 */
(function () {
  'use strict'
  var API = 'https://mzuqpvqqkdolseglgvfy.supabase.co'
  var KEY = 'sb_publishable_KckG1geNxChv5VgyBRuUfA_Zb6hOxf_'
  var ROTATE_MS = 30000 // كل عرض 30 ثانية (اعتمده مدير المنصة)
  var POLL_MS = 60000 // فحص وجود سحب جديد كل دقيقة
  var STORE = 'andalus-screen-session'
  var LEVELS = { wdGood: 0.08, wdFollow: 0.12, ocHigh: 0.85, ocGood: 0.7 } // اعتمدها مدير المنصة

  var app = document.getElementById('app')
  var stage = document.getElementById('stage')
  var session = null
  var counts = null
  var view = 1
  var online = true
  var lastOk = null
  var rotateTimer = null
  var pollTimer = null

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
  function pct(x) { return '<span class="l">' + (x * 100).toFixed(1) + '%</span>' }
  function signed(x) { return '<span class="l">' + (x >= 0 ? '+' : '−') + Math.abs(x * 100).toFixed(1) + '%</span>' }
  function L(s) { return '<span class="l">' + s + '</span>' }
  function short(n) { return String(n).replace(/^\s*[أا]ندلس\s+/, '').trim() }
  function wd(x) { return x <= LEVELS.wdGood ? ['ok', 'جيد'] : x <= LEVELS.wdFollow ? ['warn', 'متابعة'] : ['bad', 'مرتفع'] }
  function oc(x) { return x >= LEVELS.ocHigh ? ['ok', 'مرتفع'] : x >= LEVELS.ocGood ? ['sky', 'جيد'] : ['warn', 'منخفض'] }
  var dateFmt = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' })
  var dayFmt = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  var timeFmt = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { hour: 'numeric', minute: '2-digit' })
  function fmtDate(iso) { return dateFmt.format(new Date(iso + 'T12:00:00')) }
  function notesFor(name) { var s = short(name); return (counts.notes || []).filter(function (n) { return n.title.indexOf(s) >= 0 }) }
  function preliminary() { return (counts.notes || []).some(function (n) { return n.title.indexOf('النمو') >= 0 && /مبدئي/.test(n.title + n.text) }) }
  function normPhone(input) {
    var d = String(input).replace(/[\s\-()]/g, '').replace(/[٠-٩]/g, function (c) { return String(c.charCodeAt(0) - 0x0660) }).replace(/^\+/, '').replace(/^00/, '')
    if (/^05\d{8}$/.test(d)) return '966' + d.slice(1)
    if (/^5\d{8}$/.test(d)) return '966' + d
    if (/^9665\d{8}$/.test(d)) return d
    return null
  }

  /* ------------------------------------------------------------ session (Supabase Auth REST) */
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
  async function api(path, opts, retried) {
    if (session && session.expires_at - Date.now() < 120000) await refresh()
    opts = opts || {}
    var headers = { apikey: KEY, Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json' }
    var res = await fetch(API + path, { method: opts.method || 'GET', headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined })
    if (res.status === 401 && !retried) { await refresh(); return api(path, opts, true) }
    if (!res.ok) { var e = new Error('http ' + res.status); e.status = res.status; throw e }
    var t = await res.text()
    return t ? JSON.parse(t) : null
  }

  /* ------------------------------------------------------------ screens */
  function showLogin(error) {
    stopTimers()
    app.innerHTML =
      '<form class="login" id="login" autocomplete="on">' +
      '<h2>شاشة أعداد الطلاب</h2>' +
      '<p>ادخل بحساب «شاشة عرض» مرة واحدة، وتبقى الشاشة تعمل بعدها.</p>' +
      '<label for="ph">رقم الجوال</label><input id="ph" type="tel" inputmode="tel" dir="ltr" placeholder="05XXXXXXXX" autocomplete="username" required>' +
      '<label for="pw">كلمة المرور</label><input id="pw" type="password" dir="ltr" autocomplete="current-password" required>' +
      '<div class="err" id="err">' + esc(error || '') + '</div>' +
      '<button type="submit" id="go">دخول</button></form>'
    var f = document.getElementById('login')
    document.getElementById('ph').focus()
    f.addEventListener('submit', async function (ev) {
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
        if (session.expires_at - Date.now() < 120000) await refresh()
        var res = await fetch(API + '/auth/v1/user', { method: 'PUT', headers: { apikey: KEY, Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify({ password: p1 }) })
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
    var rows = await api('/rest/v1/docs?collection=eq.studentCounts&select=id,data')
    var list = (rows || []).map(function (r) { var d = r.data || {}; d.id = r.id; return d }).filter(function (d) { return d.date && d.branches && d.total })
    list.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0 })
    online = true
    lastOk = new Date()
    var next = list[0] || null
    var changed = JSON.stringify(next) !== JSON.stringify(counts)
    counts = next
    return changed
  }

  /* ------------------------------------------------------------ render */
  function header() {
    var dots = [[1, 'نظرة عامة'], [2, 'الانسحاب والإشغال']].map(function (d) { return '<span class="dot' + (d[0] === view ? ' on' : '') + '"><b>' + d[0] + '</b>' + d[1] + '</span>' }).join('')
    var now = new Date()
    return '<header class="hd"><div class="brand"><div class="mark">✦</div><div><h1>أعداد الطلاب</h1><p>سحب نظام الحلول الخبيرة · <b>' + esc(fmtDate(counts.date)) + '</b>' +
      (counts.year ? ' · العام الدراسي ' + L(esc(counts.year.replace('-', '/'))) : '') + '</p></div></div>' +
      '<div class="views">' + dots + '</div>' +
      '<div class="clock"><b id="clk">' + esc(timeFmt.format(now)) + '</b><span id="day">' + esc(dayFmt.format(now)) + '</span></div></header>'
  }

  function gauge(v) {
    var r = 56, len = Math.PI * r
    function pt(t, rr) { return [70 + rr * Math.cos(Math.PI * t), 72 - rr * Math.sin(Math.PI * t)] }
    function tick(t) { var a = pt(t, 46), b = pt(t, 67); return '<line x1="' + a[0].toFixed(1) + '" y1="' + a[1].toFixed(1) + '" x2="' + b[0].toFixed(1) + '" y2="' + b[1].toFixed(1) + '" stroke="#d8b14b" stroke-width="3" stroke-linecap="round"/>' }
    return '<svg viewBox="0 0 140 80" class="gauge"><path d="M126 72 A56 56 0 0 0 14 72" fill="none" stroke="#24244a" stroke-width="14" stroke-linecap="round"/>' +
      '<path d="M126 72 A56 56 0 0 0 14 72" fill="none" stroke="#d8b14b" stroke-width="14" stroke-linecap="round" stroke-dasharray="' + (len * Math.max(0, Math.min(1, v))).toFixed(1) + ' ' + len.toFixed(1) + '"/>' +
      tick(LEVELS.ocGood) + tick(LEVELS.ocHigh) + '</svg>'
  }

  function kpis() {
    var t = counts.total, w = wd(t.withdrawalRate), o = oc(t.occupancy)
    var hero = '<div class="k hero"><span>الطلاب الحاليون</span><b>' + num(t.current) + '</b>' +
      (t.regular != null ? '<div class="split"><i style="width:' + (t.regular / Math.max(t.current, 1) * 100).toFixed(1) + '%"></i></div><small><em class="d w"></em>منتظم ' + num(t.regular) + '<em class="d g"></em>مستجد ' + num(t.newcomers) + '</small>' : '') + '</div>'
    var growth = t.growth != null ? '<small>نمو الحاليين <strong class="' + (t.growth >= 0 ? 'pos' : 'neg') + '">' + signed(t.growth) + '</strong> ' + (preliminary() ? '<i class="tag">مبدئية</i>' : '') + '</small>' : ''
    return '<section class="kpis">' + hero +
      '<div class="k"><span>الطلاب الجدد</span><b>' + num(t.newcomers) + '</b>' + growth + '</div>' +
      '<div class="k"><span>المنسحبون</span><b>' + num(t.withdrawn) + '</b>' + (t.transferred != null ? '<small>لا يشمل ' + num(t.transferred) + ' محوّلًا</small>' : '') + '</div>' +
      '<div class="k"><span>نسبة الانسحاب</span><b>' + pct(t.withdrawalRate) + '<i class="chip ' + w[0] + '">' + w[1] + '</i></b><small>جيد حتى ' + L('8%') + ' · مرتفع فوق ' + L('12%') + '</small></div>' +
      '<div class="k gk"><span>نسبة الإشغال</span><div class="gw">' + gauge(t.occupancy) + '<b>' + pct(t.occupancy) + '</b></div><i class="chip ' + o[0] + '">' + o[1] + '</i></div>' +
      '<div class="k"><span>الطاقة التشغيلية</span><b>' + num(t.capacity) + '</b><small><strong>' + num(Math.max(t.capacity - t.current, 0)) + '</strong> مقعدًا متاحًا</small></div></section>'
  }

  function keys(items) { return '<p class="keys">' + items.map(function (k) { return '<span><em class="' + k[0] + '"></em>' + k[1] + '</span>' }).join('') + '</p>' }

  function view1() {
    var B = counts.branches.slice()
    var maxCap = Math.max.apply(null, B.map(function (b) { return b.capacity }).concat([1]))
    var bars = B.sort(function (a, b) { return b.occupancy - a.occupancy }).map(function (b) {
      return '<div class="br"><span class="n">' + esc(short(b.name)) + (notesFor(b.name).length ? '<i class="fl">!</i>' : '') + '</span>' +
        '<span class="tw"><span class="tr" style="display:block;width:' + (b.capacity / maxCap * 100).toFixed(1) + '%"><i class="' + oc(b.occupancy)[0] + '" style="width:' + (Math.min(b.occupancy, 1) * 100).toFixed(1) + '%"></i></span></span>' +
        '<b>' + pct(b.occupancy) + '</b><small>' + num(b.current) + ' من ' + num(b.capacity) + '</small></div>'
    }).join('')
    var watch = counts.branches.filter(function (b) { return b.occupancy < LEVELS.ocGood || b.withdrawalRate > LEVELS.wdFollow })
    watch.sort(function (a, b) {
      var sa = (a.occupancy < LEVELS.ocGood) + (a.withdrawalRate > LEVELS.wdFollow), sb = (b.occupancy < LEVELS.ocGood) + (b.withdrawalRate > LEVELS.wdFollow)
      return sb - sa || a.occupancy - b.occupancy
    })
    var wrows = watch.length ? '<ul class="watch">' + watch.map(function (b) {
      return '<li><span class="n">' + esc(short(b.name)) + '</span><span>' +
        (b.occupancy < LEVELS.ocGood ? '<i class="chip warn">إشغال ' + pct(b.occupancy) + '</i>' : '') +
        (b.withdrawalRate > LEVELS.wdFollow ? '<i class="chip bad">انسحاب ' + pct(b.withdrawalRate) + '</i>' : '') + '</span></li>'
    }).join('') + '</ul>' : '<p class="none">كل الفروع ضمن الحدود المعتمدة</p>'
    var SC = ['#d8b14b', '#33bdf2', '#8f8fe6', '#4fcf8e', '#c084fc', '#ef6a5c']
    var st = counts.total.stages || [], names = counts.stageNames || [], tot = st.reduce(function (a, b) { return a + b }, 0) || 1
    var stages = names.length && st.length ? '<div class="card"><h2>حسب المرحلة <span>الطلاب الحاليون</span></h2><div class="stack">' +
      st.map(function (v, i) { return '<i style="width:' + (v / tot * 100).toFixed(2) + '%;background:' + SC[i % SC.length] + '"></i>' }).join('') + '</div><p class="sleg">' +
      names.map(function (n, i) { return '<span><em style="background:' + SC[i % SC.length] + '"></em>' + esc(n) + ' <b>' + num(st[i] || 0) + '</b></span>' }).join('') + '</p></div>' : ''
    return header() + kpis() +
      '<section class="body"><div class="card big"><h2>إشغال الفروع <span>الحاليون مقابل الطاقة · طول الشريط = الطاقة</span></h2><div class="bars">' + bars + '</div>' +
      keys([['ok', 'مرتفع ' + L('85%') + ' فأكثر'], ['sky', 'جيد من ' + L('70%') + ' إلى ' + L('85%')], ['warn', 'منخفض أقل من ' + L('70%')]]) + '</div>' +
      '<div class="col"><div class="card"><h2>فروع تحتاج متابعة <span>إشغال أقل من ' + L('70%') + ' أو انسحاب فوق ' + L('12%') + '</span></h2>' + wrows + '</div>' + stages + '</div></section>'
  }

  /** Puts each name beside its bubble where it overlaps the fewest bubbles and names. */
  function placeLabels(items) {
    var boxes = []
    function hit(a) {
      var s = 0
      boxes.forEach(function (b) { s += Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)) })
      items.forEach(function (c) { var dx = Math.max(a.x0 - c.x, 0, c.x - a.x1), dy = Math.max(a.y0 - c.y, 0, c.y - a.y1); if (dx * dx + dy * dy < c.r * c.r) s += 600 })
      if (a.x0 < 60 || a.x1 > 990) s += 5000
      return s
    }
    return items.slice().sort(function (a, b) { return b.r - a.r }).map(function (it) {
      var w = it.name.length * 11 + 6, h = 22
      var opts = [
        { tx: it.x, ty: it.y - it.r - 8, an: 'middle', box: { x0: it.x - w / 2, x1: it.x + w / 2, y0: it.y - it.r - 8 - h, y1: it.y - it.r - 4 } },
        { tx: it.x, ty: it.y + it.r + 24, an: 'middle', box: { x0: it.x - w / 2, x1: it.x + w / 2, y0: it.y + it.r + 4, y1: it.y + it.r + 26 } },
        { tx: it.x + it.r + 8, ty: it.y + 7, an: 'start', box: { x0: it.x + it.r + 6, x1: it.x + it.r + 8 + w, y0: it.y - h / 2, y1: it.y + h / 2 } },
        { tx: it.x - it.r - 8, ty: it.y + 7, an: 'end', box: { x0: it.x - it.r - 8 - w, x1: it.x - it.r - 6, y0: it.y - h / 2, y1: it.y + h / 2 } },
      ]
      var best = opts[0], score = Infinity
      opts.forEach(function (o) { var s = hit(o.box); if (s < score - 1) { best = o; score = s } })
      boxes.push(best.box)
      return { name: it.name, tx: best.tx, ty: best.ty, an: best.an }
    })
  }

  function view2() {
    var B = counts.branches
    var W = 1000, H = 780, Lm = 60, R = 20, T = 20, Bm = 50
    var occs = B.map(function (b) { return b.occupancy }), wds = B.map(function (b) { return b.withdrawalRate })
    var x0 = Math.max(0, Math.floor((Math.min.apply(null, occs) - 0.04) * 20) / 20), x1 = Math.min(1, Math.ceil((Math.max.apply(null, occs) + 0.03) * 20) / 20)
    var y0 = Math.max(0, Math.floor((Math.min.apply(null, wds) - 0.015) * 25) / 25), y1 = Math.ceil((Math.max.apply(null, wds.concat([LEVELS.wdFollow])) + 0.015) * 25) / 25
    function X(v) { return Lm + (v - x0) / (x1 - x0) * (W - Lm - R) }
    function Y(v) { return H - Bm - (v - y0) / (y1 - y0) * (H - T - Bm) }
    var maxCur = Math.max.apply(null, B.map(function (b) { return b.current }).concat([1]))
    function rad(b) { return 12 + 26 * Math.sqrt(b.current / maxCur) }
    var FILL = { ok: '#4fcf8e', warn: '#f6a83a', bad: '#ef6a5c' }
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="mx" style="direction:ltr" preserveAspectRatio="xMidYMid meet">'
    function zone(xa, xb, ya, yb, fill) { var a = Math.max(xa, x0), b = Math.min(xb, x1), c = Math.max(ya, y0), d = Math.min(yb, y1); return a < b && c < d ? '<rect x="' + X(a).toFixed(0) + '" y="' + Y(d).toFixed(0) + '" width="' + (X(b) - X(a)).toFixed(0) + '" height="' + (Y(c) - Y(d)).toFixed(0) + '" fill="' + fill + '"/>' : '' }
    s += zone(x0, LEVELS.ocGood, LEVELS.wdFollow, y1, 'rgba(239,106,92,.13)') + zone(LEVELS.ocHigh, x1, y0, LEVELS.wdGood, 'rgba(79,207,142,.13)')
    var v
    for (v = Math.ceil(x0 * 10) / 10; v <= x1 + 1e-9; v += 0.1) s += '<line x1="' + X(v).toFixed(1) + '" x2="' + X(v).toFixed(1) + '" y1="' + T + '" y2="' + (H - Bm) + '" class="gl"/><text x="' + X(v).toFixed(1) + '" y="' + (H - Bm + 26) + '" class="ax" text-anchor="middle">' + Math.round(v * 100) + '%</text>'
    for (v = y0; v <= y1 + 1e-9; v += 0.04) s += '<line x1="' + Lm + '" x2="' + (W - R) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" class="gl"/><text x="' + (Lm - 10) + '" y="' + (Y(v) + 6).toFixed(1) + '" class="ax" text-anchor="end">' + Math.round(v * 100) + '%</text>'
    if (LEVELS.ocGood > x0 && LEVELS.ocGood < x1) s += '<line x1="' + X(LEVELS.ocGood).toFixed(1) + '" x2="' + X(LEVELS.ocGood).toFixed(1) + '" y1="' + T + '" y2="' + (H - Bm) + '" class="th"/>'
    if (LEVELS.wdFollow < y1) s += '<line x1="' + Lm + '" x2="' + (W - R) + '" y1="' + Y(LEVELS.wdFollow).toFixed(1) + '" y2="' + Y(LEVELS.wdFollow).toFixed(1) + '" class="th"/>'
    s += '<text x="' + (X(x0) + 12).toFixed(0) + '" y="' + (Y(y1) + 30).toFixed(0) + '" class="ql bad">يحتاج تدخلًا</text><text x="' + (X(x1) - 12).toFixed(0) + '" y="' + (Y(y0) - 14).toFixed(0) + '" class="ql ok" text-anchor="end">مستقر</text>'
    B.slice().sort(function (a, b) { return b.current - a.current }).forEach(function (b) {
      s += '<circle cx="' + X(b.occupancy).toFixed(1) + '" cy="' + Y(b.withdrawalRate).toFixed(1) + '" r="' + rad(b).toFixed(1) + '" fill="' + FILL[wd(b.withdrawalRate)[0]] + '" fill-opacity=".85" stroke="#0a0a1f" stroke-width="3"/>'
    })
    placeLabels(B.map(function (b) { return { name: short(b.name), x: X(b.occupancy), y: Y(b.withdrawalRate), r: rad(b) } })).forEach(function (l) {
      s += '<text x="' + l.tx.toFixed(1) + '" y="' + l.ty.toFixed(1) + '" class="bl" text-anchor="' + l.an + '">' + esc(l.name) + '</text>'
    })
    s += '<text x="' + ((Lm + W - R) / 2).toFixed(0) + '" y="' + (H - 4) + '" class="at" text-anchor="middle">نسبة الإشغال</text></svg>'
    var maxW = Math.max.apply(null, wds.concat([1e-9]))
    var wbars = B.slice().sort(function (a, b) { return b.withdrawalRate - a.withdrawalRate }).map(function (b) {
      return '<div class="br w"><span class="n">' + esc(short(b.name)) + '</span><span class="tw"><span class="tr" style="display:block"><i class="' + wd(b.withdrawalRate)[0] + '" style="width:' + (b.withdrawalRate / maxW * 100).toFixed(1) + '%"></i></span></span><b>' + pct(b.withdrawalRate) + '</b><small>' + num(b.withdrawn) + '</small></div>'
    }).join('')
    return header() +
      '<section class="body b2"><div class="card big"><h2>مصفوفة الإشغال والانسحاب <span>حجم الدائرة = عدد الطلاب · لونها = حالة الانسحاب</span></h2><div class="mxw"><span class="yl">نسبة الانسحاب ↑</span>' + s + '</div></div>' +
      '<div class="card"><h2>نسبة الانسحاب لكل فرع <span>المنسحبون ÷ (الحاليون + المنسحبون) · العدد بجانبها</span></h2><div class="bars">' + wbars + '</div>' +
      keys([['ok', 'جيد حتى ' + L('8%')], ['warn', 'متابعة حتى ' + L('12%')], ['bad', 'مرتفع فوق ' + L('12%')]]) + '</div></section>'
  }

  function footer() {
    var st = online ? 'آخر تحديث ' + timeFmt.format(lastOk || new Date()) : 'غير متصل · آخر تحديث ' + (lastOk ? timeFmt.format(lastOk) : '—')
    return '<div class="ft"><div class="prog"><i id="prog"></i></div><span class="state' + (online ? '' : ' off') + '" id="state">' + esc(st) + '</span></div>' +
      '<div class="menu" id="menu"><button type="button" id="m-full">ملء الشاشة</button><button type="button" id="m-next">العرض التالي</button><button type="button" id="m-out">تسجيل الخروج</button></div>'
  }

  function render() {
    if (!counts) { showMessage('لم يُرفع سحب بعد', 'ارفع ملف «مؤشرات أعداد الطلاب» من تبويب أعداد الطلاب في المنصة، وسيظهر هنا تلقائيًا.'); return }
    app.innerHTML = (view === 1 ? view1() : view2()) + footer()
    bindMenu()
    // the bar fills over the 30 seconds the view stays on screen
    var bar = document.getElementById('prog')
    bar.style.transition = 'none'; bar.style.width = '0'
    setTimeout(function () { bar.style.transition = 'width ' + (ROTATE_MS / 1000) + 's linear'; bar.style.width = '100%' }, 50)
  }

  /* ------------------------------------------------------------ timers */
  function stopTimers() { clearInterval(rotateTimer); clearInterval(pollTimer); rotateTimer = pollTimer = null }
  function nextView() { view = view === 1 ? 2 : 1; render() }
  function tickClock() {
    var now = new Date(), c = document.getElementById('clk'), d = document.getElementById('day')
    if (c) c.textContent = timeFmt.format(now)
    if (d) d.textContent = dayFmt.format(now)
    // pick up a new version of the page once a night
    if (now.getHours() === 3 && now.getMinutes() === 30 && performance.now() > 120000) location.reload()
  }
  setInterval(tickClock, 10000)

  async function poll() {
    try {
      if (await load()) render()
      else {
        var s = document.getElementById('state')
        if (s) { s.className = 'state'; s.textContent = 'آخر تحديث ' + timeFmt.format(lastOk) }
      }
    } catch (e) {
      if (e.status === 401 || e.status === 400) { saveSession(null); showLogin('انتهت صلاحية الدخول. ادخل مرة أخرى.'); return }
      online = false
      var st = document.getElementById('state')
      if (st) { st.className = 'state off'; st.textContent = 'غير متصل · آخر تحديث ' + (lastOk ? timeFmt.format(lastOk) : '—') }
    }
  }

  /* ------------------------------------------------------------ menu, fullscreen, keep awake */
  var menuTimer = null
  function bindMenu() {
    var full = document.getElementById('m-full'), next = document.getElementById('m-next'), out = document.getElementById('m-out')
    full.onclick = function () { var el = document.documentElement, f = el.requestFullscreen || el.webkitRequestFullscreen; if (f) f.call(el); hideMenu() }
    next.onclick = function () { clearInterval(rotateTimer); rotateTimer = setInterval(nextView, ROTATE_MS); nextView() }
    out.onclick = function () { if (window.confirm('تسجيل خروج الشاشة؟')) { saveSession(null); counts = null; showLogin() } }
  }
  function showMenu() {
    var m = document.getElementById('menu')
    if (!m) return
    if (!m.classList.contains('on')) { m.classList.add('on'); document.getElementById('m-next').focus() }
    clearTimeout(menuTimer); menuTimer = setTimeout(hideMenu, 8000)
  }
  function hideMenu() { var m = document.getElementById('menu'); if (m) m.classList.remove('on') }
  document.addEventListener('keydown', function (e) { if (document.getElementById('menu') && !/^(INPUT|BUTTON)$/.test((e.target || {}).tagName || '') || e.key === 'Escape') showMenu() })
  stage.addEventListener('click', function (e) { if (!/BUTTON|INPUT/.test(e.target.tagName)) showMenu() })

  var lock = null
  async function keepAwake() {
    try { if ('wakeLock' in navigator && document.visibilityState === 'visible') lock = await navigator.wakeLock.request('screen') } catch (e) { lock = null }
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') { keepAwake(); if (session && counts) poll() } })
  window.addEventListener('online', function () { if (session) poll() })

  /* ------------------------------------------------------------ start */
  async function start() {
    stopTimers()
    showMessage('جارٍ التحميل…', '')
    try {
      var me = (await api('/rest/v1/rpc/me', { method: 'POST', body: {} })) || []
      var m = me[0]
      if (!m) { saveSession(null); showLogin('هذا الحساب غير مفعّل في المنصة.'); return }
      if (m.role !== 'screen' && m.role !== 'owner') { saveSession(null); showLogin('هذه الشاشة لحساب «شاشة عرض» أو مدير المنصة فقط.'); return }
      if (m.must_change_password) { showChangePassword(); return }
      await load()
      view = 1
      render()
      rotateTimer = setInterval(nextView, ROTATE_MS)
      pollTimer = setInterval(poll, POLL_MS)
      keepAwake()
    } catch (e) {
      if (e.status === 400 || e.status === 401) { saveSession(null); showLogin('انتهت صلاحية الدخول. ادخل مرة أخرى.'); return }
      showMessage('تعذّر الاتصال', 'ستعيد الشاشة المحاولة تلقائيًا خلال دقيقة.')
      setTimeout(start, POLL_MS)
    }
  }

  session = loadSession()
  if (session && session.refresh_token) start()
  else showLogin()
})()
