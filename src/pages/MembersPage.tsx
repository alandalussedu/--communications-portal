import { useCallback, useEffect, useMemo, useState } from "react"
import { Bell, Check, Copy, KeyRound, Loader2, Plus, Search, UserCheck, UserX } from "lucide-react"
import { toast } from "sonner"
import { useStore, type MemberRole } from "@/data/store"
import { adminMembers, normalizePhone, sendPush, useSession, type MemberRow, type PushReq } from "@/lib/backend"
import { formatDate, formatTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { EmptyState, LoadingBlock, PageHeader, Panel, Pill } from "@/components/common"
import { ROLE_LABEL } from "@/components/EditorLogin"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"

const ROLES: MemberRole[] = ["viewer", "editor", "owner"]
const ROLE_HINT: Record<MemberRole, string> = {
  viewer: "يرى كل الأقسام ومنها الأداء والتطوير، ولا يعدّل شيئًا",
  editor: "يرى ويعدّل محتوى المنصة",
  owner: "كالمحرر، ويدير المستخدمين",
}
const inputCls = "h-11 w-full rounded-md border border-input bg-card px-3 text-[16px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
const showPhone = (p: string) => (p.startsWith("966") ? "0" + p.slice(3) : p)

/** Owners add members, reset passwords, change roles and stop accounts. */
export function MembersPage() {
  const { member } = useStore()
  const session = useSession()
  const [rows, setRows] = useState<MemberRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState("")
  const [adding, setAdding] = useState(false)
  const [secret, setSecret] = useState<{ name: string; phone: string; password: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [pushing, setPushing] = useState(false)

  const load = useCallback(async () => {
    const res = await adminMembers<MemberRow[]>({ action: "list" })
    if (res.error) setError(res.error)
    else setRows(res.data ?? [])
  }, [])
  useEffect(() => {
    if (member.role === "owner") void load()
  }, [member.role, load])

  const list = useMemo(() => {
    const t = q.trim()
    const all = rows ?? []
    return t ? all.filter((r) => r.name.includes(t) || showPhone(r.phone).includes(t.replace(/\s/g, ""))) : all
  }, [rows, q])

  if (!member.enabled || !member.checked) return <Panel className="mt-8"><LoadingBlock rows={3} /></Panel>
  if (member.role !== "owner")
    return (
      <Panel className="mt-8 p-6">
        <EmptyState title="هذه الصفحة لمدير المنصة" body="إدارة المستخدمين متاحة لحساب مدير المنصة فقط." />
      </Panel>
    )

  const act = async (id: string, fn: () => Promise<{ error?: string }>, ok: string) => {
    setBusy(id)
    const res = await fn()
    setBusy(null)
    if (res.error) return toast.error("لم يتم الإجراء", { description: res.error })
    toast.success(ok)
    void load()
  }
  const reset = async (r: MemberRow) => {
    setBusy(r.user_id)
    const res = await adminMembers<{ password: string }>({ action: "reset", user_id: r.user_id })
    setBusy(null)
    if (res.error || !res.data) return toast.error("لم تُعَد كلمة المرور", { description: res.error })
    setSecret({ name: r.name, phone: r.phone, password: res.data.password })
    void load()
  }

  const counts = { all: rows?.length ?? 0, active: rows?.filter((r) => r.active).length ?? 0 }
  return (
    <>
      <PageHeader
        eyebrow="مدير المنصة"
        title="إدارة المستخدمين"
        description="أضف مسؤولي التواصل وزملاءك في الإدارة، وأعد تعيين كلمات المرور، وأوقف الحسابات. كل حساب جديد يدخل بكلمة مرور مؤقتة ويُطلب منه تغييرها."
        actions={
          <>
            <button type="button" onClick={() => setPushing(true)} className="inline-flex h-11 items-center gap-2 rounded-full border bg-card px-5 text-[15px] font-bold hover:bg-accent">
              <Bell className="h-4 w-4" aria-hidden="true" />
              إرسال إشعار
            </button>
            <button type="button" onClick={() => setAdding(true)} className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-[15px] font-bold text-primary-foreground hover:bg-primary/90">
              <Plus className="h-4 w-4" aria-hidden="true" />
              إضافة مستخدم
            </button>
          </>
        }
      />
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالاسم أو الجوال" aria-label="بحث في المستخدمين" className={cn(inputCls, "ps-9")} />
          </div>
          <span className="num text-[14px] text-muted-foreground">{counts.active} نشط من {counts.all}</span>
        </div>
        {error ? (
          <p className="p-5 text-[15px] text-bad">{error}</p>
        ) : !rows ? (
          <LoadingBlock rows={4} label="جارٍ تحميل المستخدمين…" />
        ) : !list.length ? (
          <div className="p-6"><EmptyState title={rows.length ? "لا نتائج" : "لا يوجد مستخدمون بعد"} body={rows.length ? "جرّب اسمًا أو رقمًا آخر." : "أضف أول مستخدم من زر «إضافة مستخدم»."} /></div>
        ) : (
          <ul className="divide-y">
            {list.map((r) => {
              const self = r.user_id === session?.user.id
              return (
                <li key={r.user_id} className={cn("flex flex-wrap items-center gap-3 px-4 py-3", !r.active && "opacity-60")}>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-bold">
                      {r.name}
                      <Pill tone={r.role === "viewer" ? "neutral" : r.role === "editor" ? "brand" : "gold"}>{ROLE_LABEL[r.role]}</Pill>
                      {!r.active && <Pill tone="bad">موقوف</Pill>}
                      {r.active && r.must_change_password && <Pill tone="warn">لم يغيّر كلمة المرور المؤقتة</Pill>}
                    </p>
                    <p className="num text-[14px] text-muted-foreground" dir="ltr" style={{ textAlign: "right" }}>{showPhone(r.phone)}</p>
                    <p className="text-[13px] text-muted-foreground">
                      {r.last_sign_in_at ? `آخر دخول ${formatDate(r.last_sign_in_at)} · ${formatTime(new Date(r.last_sign_in_at))}` : "لم يدخل بعد"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label={`دور ${r.name}`}
                      value={r.role}
                      disabled={busy === r.user_id || self}
                      onChange={(e) => act(r.user_id, () => adminMembers({ action: "update", user_id: r.user_id, role: e.target.value as MemberRole }), `تغيّر دور ${r.name}`)}
                      className="h-10 rounded-md border bg-card px-2 text-[14px]"
                    >
                      {ROLES.map((x) => <option key={x} value={x}>{ROLE_LABEL[x]}</option>)}
                    </select>
                    <button type="button" disabled={busy === r.user_id || !r.active} onClick={() => reset(r)} className="inline-flex h-10 items-center gap-1.5 rounded-full border px-3 text-[14px] hover:bg-accent disabled:opacity-50">
                      <KeyRound className="h-4 w-4" aria-hidden="true" />
                      إعادة تعيين كلمة المرور
                    </button>
                    <button
                      type="button"
                      disabled={busy === r.user_id || self}
                      onClick={() => {
                        if (r.active && !window.confirm(`إيقاف حساب ${r.name}؟ لن يستطيع الدخول حتى تعيد تفعيله.`)) return
                        void act(r.user_id, () => adminMembers({ action: "update", user_id: r.user_id, active: !r.active }), r.active ? `أُوقف حساب ${r.name}` : `فُعّل حساب ${r.name}`)
                      }}
                      className={cn("inline-flex h-10 items-center gap-1.5 rounded-full border px-3 text-[14px] disabled:opacity-50", r.active ? "text-bad hover:bg-bad-soft" : "hover:bg-accent")}
                    >
                      {busy === r.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : r.active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                      {r.active ? "إيقاف" : "تفعيل"}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      <Sheet open={adding} onOpenChange={setAdding}>
        <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-md" dir="rtl">
          <SheetHeader className="pe-8 text-start">
            <SheetTitle className="text-start text-[22px] font-bold">إضافة مستخدم</SheetTitle>
            <SheetDescription className="text-start text-[15px]">تُنشأ له كلمة مرور مؤقتة تظهر لك مرة واحدة، فأرسلها له على انفراد.</SheetDescription>
          </SheetHeader>
          <AddForm
            onDone={(r) => {
              setAdding(false)
              setSecret(r)
              void load()
            }}
          />
        </SheetContent>
      </Sheet>

      <SecretDialog secret={secret} onClose={() => setSecret(null)} />
      <Sheet open={pushing} onOpenChange={setPushing}>
        <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-lg" dir="rtl">
          <SheetHeader className="pe-8 text-start">
            <SheetTitle className="text-start text-[22px] font-bold">إرسال إشعار</SheetTitle>
            <SheetDescription className="text-start text-[15px]">يصل إلى أجهزة من ثبّت تطبيق البوابة وسمح بالإشعارات.</SheetDescription>
          </SheetHeader>
          <PushForm onDone={() => setPushing(false)} />
        </SheetContent>
      </Sheet>
    </>
  )
}

function AddForm({ onDone }: { onDone: (r: { name: string; phone: string; password: string }) => void }) {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [role, setRole] = useState<MemberRole>("viewer")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      className="mt-5 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault()
        setError(null)
        const p = normalizePhone(phone)
        if (!name.trim()) return setError("اكتب الاسم.")
        if (!p) return setError("اكتب رقم جوال سعودي بالشكل 05XXXXXXXX.")
        setBusy(true)
        const res = await adminMembers<{ password: string }>({ action: "create", name: name.trim(), phone: p, role })
        setBusy(false)
        if (res.error || !res.data) return setError(res.error ?? "تعذّر إنشاء الحساب.")
        onDone({ name: name.trim(), phone: p, password: res.data.password })
      }}
    >
      <div>
        <label htmlFor="a-name" className="mb-1 block text-[15px] font-medium">الاسم</label>
        <input id="a-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required className={inputCls} />
      </div>
      <div>
        <label htmlFor="a-phone" className="mb-1 block text-[15px] font-medium">رقم الجوال</label>
        <input id="a-phone" type="tel" inputMode="tel" dir="ltr" placeholder="05XXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} required className={cn(inputCls, "text-start")} />
      </div>
      <fieldset>
        <legend className="mb-1 text-[15px] font-medium">الدور</legend>
        <div className="space-y-2">
          {ROLES.map((x) => (
            <label key={x} className={cn("flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5", role === x && "border-primary bg-secondary/40")}>
              <input type="radio" name="role" value={x} checked={role === x} onChange={() => setRole(x)} className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]" />
              <span>
                <span className="block font-bold">{ROLE_LABEL[x]}</span>
                <span className="block text-[13px] text-muted-foreground">{ROLE_HINT[x]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {error && <p className="text-[14px] text-bad" role="alert">{error}</p>}
      <button type="submit" disabled={busy} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-[16px] font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        إنشاء الحساب
      </button>
    </form>
  )
}

function SecretDialog({ secret, onClose }: { secret: { name: string; phone: string; password: string } | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  if (!secret) return null
  const site = location.origin + location.pathname
  const message = `مرحبًا ${secret.name}،\nحسابك في بوابة التواصل المؤسسي جاهز.\nالرابط: ${site}\nرقم الجوال: ${showPhone(secret.phone)}\nكلمة المرور المؤقتة: ${secret.password}\nسيُطلب منك اختيار كلمة مرور جديدة عند أول دخول.`
  return (
    <Sheet open onOpenChange={(o) => !o && (setCopied(false), onClose())}>
      <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-md" dir="rtl">
        <SheetHeader className="pe-8 text-start">
          <SheetTitle className="text-start text-[22px] font-bold">كلمة المرور المؤقتة</SheetTitle>
          <SheetDescription className="text-start text-[15px]">تظهر الآن فقط ولا تُحفظ في أي مكان. انسخ الرسالة وأرسلها إلى {secret.name} على انفراد.</SheetDescription>
        </SheetHeader>
        <div className="mt-5 space-y-4">
          <p className="num rounded-xl border bg-muted px-4 py-4 text-center text-[24px] font-bold tracking-wider" dir="ltr">{secret.password}</p>
          <pre className="whitespace-pre-wrap rounded-xl border bg-card px-4 py-3 font-sans text-[14px] leading-relaxed">{message}</pre>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(message)
                setCopied(true)
              } catch {
                toast.error("تعذّر النسخ. انسخ الرسالة يدويًا.")
              }
            }}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-[16px] font-bold text-primary-foreground hover:bg-primary/90"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "نُسخت الرسالة" : "نسخ الرسالة"}
          </button>
          <button type="button" onClick={() => (setCopied(false), onClose())} className="inline-flex h-11 w-full items-center justify-center rounded-full border text-[15px] hover:bg-accent">تم</button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

const AUDIENCES: { value: PushReq["audience"]; label: string }[] = [
  { value: "all", label: "الجميع" },
  { value: "officers", label: "مسؤولو التواصل" },
  { value: "team", label: "فريق الإدارة" },
]
const ROUTES: { value: string; label: string }[] = [
  { value: "", label: "الصفحة الرئيسية" },
  { value: "indicators", label: "الأداء والتطوير" },
  { value: "remedial", label: "الخطط العلاجية" },
  { value: "calendar", label: "رحلة التواصل" },
  { value: "library", label: "المكتبة" },
  { value: "social", label: "التواصل الاجتماعي" },
  { value: "csr", label: "المسؤولية المجتمعية" },
]

function PushForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [audience, setAudience] = useState<PushReq["audience"]>("all")
  const [route, setRoute] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      className="mt-5 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault()
        setError(null)
        if (!title.trim() || !body.trim()) return setError("اكتب عنوان الإشعار ونصه.")
        setBusy(true)
        const res = await sendPush({ title: title.trim(), body: body.trim(), audience, route: route || undefined })
        setBusy(false)
        if (res.error) return setError(res.error)
        const r = res.data!
        if (!r.devices) toast.message("لم يُرسل شيء", { description: "لا توجد أجهزة مسجلة لهؤلاء المستلمين بعد. تظهر الأجهزة بعد تثبيت التطبيق والسماح بالإشعارات." })
        else toast.success(`أُرسل إلى ${r.sent} جهاز`, { description: `${r.reached} من ${r.members} مستخدمًا لديهم التطبيق${r.failed ? ` · تعذّر ${r.failed}` : ""}` })
        onDone()
      }}
    >
      <div>
        <label htmlFor="push-title" className="mb-1 block text-[15px] font-medium">العنوان</label>
        <input id="push-title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="مثال: تحديث الخطط العلاجية" />
      </div>
      <div>
        <label htmlFor="push-body" className="mb-1 block text-[15px] font-medium">النص</label>
        <textarea id="push-body" value={body} maxLength={240} rows={3} onChange={(e) => setBody(e.target.value)} className="w-full rounded-md border border-input bg-card px-3 py-2 text-[16px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30" />
        <p className="num mt-1 text-[12px] text-muted-foreground">{body.length}/240</p>
      </div>
      <div>
        <label htmlFor="push-aud" className="mb-1 block text-[15px] font-medium">المستلمون</label>
        <select id="push-aud" value={audience} onChange={(e) => setAudience(e.target.value as PushReq["audience"])} className={inputCls}>
          {AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="push-route" className="mb-1 block text-[15px] font-medium">عند فتح الإشعار</label>
        <select id="push-route" value={route} onChange={(e) => setRoute(e.target.value)} className={inputCls}>
          {ROUTES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>
      {error && <p className="text-[14px] text-bad" role="alert">{error}</p>}
      <button type="submit" disabled={busy} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-[16px] font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Bell className="h-4 w-4" aria-hidden="true" />}
        إرسال
      </button>
    </form>
  )
}
