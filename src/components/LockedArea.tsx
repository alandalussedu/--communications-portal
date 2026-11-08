import { useState, type FormEvent, type ReactNode } from "react"
import { MessageSquareWarning, ClipboardList, Database, Binoculars, Eye, EyeOff, FileBarChart2, KeyRound, LayoutDashboard, Loader2, Lock, ShieldCheck } from "lucide-react"
import { useStore } from "@/data/store"
import { useRouter, type Route } from "@/lib/router"
import { passwordIssues } from "@/lib/vault"
import { cn } from "@/lib/utils"
import { Banner, Octagram, Panel, LoadingBlock } from "./common"
import { LoginForm } from "./EditorLogin"
import { Pill, useSlidingPill } from "@/lib/motion"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"

const SUB: { page: Route["page"]; label: string; icon: typeof Lock; also?: Route["page"][] }[] = [
  { page: "indicators", label: "رضا العملاء وجودة التواصل", icon: LayoutDashboard, also: ["reports", "alerts", "branch"] },
  { page: "remedial", label: "الخطط العلاجية", icon: ClipboardList },
  { page: "complaints", label: "الشكاوى", icon: MessageSquareWarning },
  { page: "competitors", label: "دراسة المنافسين", icon: Binoculars },
  { page: "builder", label: "التقارير التنفيذية", icon: FileBarChart2 },
  { page: "sources", label: "المصادر", icon: Database },
]

/** Everything under «المؤشرات» renders through here: setup, unlock, or the pages with their own sub-navigation. */
export function LockedArea({ children }: { children: ReactNode }) {
  const { vault, connection, member } = useStore()

  if (connection.kind === "unavailable")
    return (
      <Centered>
        <p className="text-[16px] text-muted-foreground">{connection.reason}</p>
      </Centered>
    )
  if (vault.status === "loading")
    return (
      <Panel className="mt-8">
        <LoadingBlock rows={3} label="جارٍ التحقق من حماية القسم…" />
      </Panel>
    )
  if (vault.status === "unsupported")
    return (
      <Centered title="المتصفح لا يدعم فتح هذا القسم">
        <p className="text-[16px] text-muted-foreground">يحتاج قسم الأداء والتطوير إلى متصفح حديث يدعم التشفير. افتح المنصة من متصفح Chrome أو Safari أو Edge محدّث.</p>
      </Centered>
    )
  if (vault.status === "none") return vault.isOwner && vault.setupReady ? <SetupScreen /> : <NotReady owner={vault.isOwner} />
  if (vault.status === "locked") return member.enabled ? <MemberGate /> : <UnlockScreen />
  return (
    <>
      <SubNav />
      {vault.failed > 0 && (
        <div className="mb-4">
          <Banner tone="bad" title="بعض البيانات لم تُفتح">
            تعذّر فتح {vault.failed} سجلًا بالمفتاح الحالي، فلا تظهر في الصفحات. أبلغ مسؤول المنصة.
          </Banner>
        </div>
      )}
      {children}
    </>
  )
}

function SubNav() {
  const { route, go } = useRouter()
  const { vault, member } = useStore()
  const [changing, setChanging] = useState(false)
  const pill = useSlidingPill<HTMLUListElement>(route.page)
  return (
    <div className="mb-2 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-1.5">
      <ul ref={pill.ref} className="relative flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none]" aria-label="صفحات المؤشرات">
        <Pill box={pill.box} ready={pill.ready} className="rounded-xl bg-secondary" />
        {SUB.map((n) => {
          const active = route.page === n.page || n.also?.includes(route.page)
          const Icon = n.icon
          return (
            <li key={n.page} className="shrink-0">
              <button
                type="button"
                onClick={() => go({ page: n.page } as Route)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative z-10 inline-flex h-10 items-center gap-2 rounded-xl px-3 text-[15px] transition-colors duration-300",
                  active ? "font-bold text-secondary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {n.label}
              </button>
            </li>
          )
        })}
      </ul>
      <div className="flex shrink-0 items-center gap-1">
        {vault.isOwner && !member.enabled && (
          <button type="button" onClick={() => setChanging(true)} className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-[14px] text-muted-foreground hover:bg-accent hover:text-foreground">
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            كلمة المرور
          </button>
        )}
        <button type="button" onClick={vault.lock} className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-[14px] text-muted-foreground hover:bg-accent hover:text-foreground">
          <Lock className="h-4 w-4" aria-hidden="true" />
          {member.enabled ? "خروج" : "قفل"}
        </button>
      </div>
      <Sheet open={changing} onOpenChange={setChanging}>
        <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-lg" dir="rtl">
          <SheetHeader className="pe-8 text-start">
            <SheetTitle className="text-start text-[22px] font-bold">تغيير كلمة المرور</SheetTitle>
            <SheetDescription className="text-start text-[15px]">
              تتغيّر الكلمة لكل من يفتح القسم، والبيانات تبقى كما هي. بعد التغيير لن تعمل الكلمة القديمة.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-5">
            <ChangeForm onDone={() => setChanging(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function Centered({ title, children, icon }: { title?: string; children: ReactNode; icon?: ReactNode }) {
  return (
    <section className="rise mx-auto mt-10 max-w-[520px] overflow-hidden rounded-2xl border bg-card">
      <div className="pattern-stars relative overflow-hidden bg-band px-6 py-6 text-band-foreground">
        <Octagram className="pointer-events-none absolute -end-10 -top-12 h-40 w-40 text-gold/25" strokeWidth={1} />
        <div className="relative flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">{icon ?? <Lock className="h-6 w-6" aria-hidden="true" />}</span>
          <div>
            <p className="text-[14px] text-band-soft">الأداء والتطوير</p>
            <h1 className="text-[24px] font-extrabold leading-tight">{title ?? "قسم محمي"}</h1>
          </div>
        </div>
      </div>
      <div className="px-6 py-6">{children}</div>
    </section>
  )
}

function PasswordInput({ id, value, onChange, label, autoComplete, invalid, autoFocus }: { id: string; value: string; onChange: (v: string) => void; label: string; autoComplete: string; invalid?: boolean; autoFocus?: boolean }) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[15px] font-bold">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          dir="ltr"
          aria-invalid={invalid || undefined}
          className={cn(
            "h-12 w-full rounded-xl border bg-card pe-3 ps-12 text-[17px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
            invalid ? "border-bad" : "border-input",
          )}
        />
        <button type="button" onClick={() => setShow((s) => !s)} className="absolute start-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground hover:bg-accent" aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}>
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

function SubmitButton({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <button type="submit" disabled={busy} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-[17px] font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
      {busy && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
}

/** Public site / app: each communication officer signs in with their own account. */
function MemberGate() {
  const { member } = useStore()
  return (
    <Centered title="سجّل الدخول" icon={<ShieldCheck className="h-6 w-6" aria-hidden="true" />}>
      <p className="mb-5 text-[16px] leading-relaxed text-muted-foreground">هذا القسم لمسؤولي التواصل في الفروع وفريق إدارة التواصل المؤسسي. ادخل برقم جوالك وكلمة المرور.</p>
      {member.mustChange ? (
        <p className="text-[15px] text-muted-foreground">اختر كلمة مرور جديدة من النافذة الظاهرة للمتابعة.</p>
      ) : (
        <LoginForm />
      )}
    </Centered>
  )
}

function UnlockScreen() {
  const { vault } = useStore()
  const [pw, setPw] = useState("")
  const [busy, setBusy] = useState(false)
  const [wrong, setWrong] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!pw || busy) return
    setBusy(true)
    setWrong(false)
    const ok = await vault.unlock(pw)
    setBusy(false)
    if (!ok) setWrong(true)
  }
  return (
    <Centered title="أدخل كلمة المرور">
      <p className="mb-5 text-[16px] leading-relaxed text-muted-foreground">هذا القسم لفريق التواصل المؤسسي ومسؤولي التواصل في الفروع. بياناته محفوظة مشفّرة، ولا تُفتح إلا بكلمة المرور.</p>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <PasswordInput id="vault-pw" label="كلمة المرور" value={pw} onChange={(v) => { setPw(v); setWrong(false) }} autoComplete="current-password" invalid={wrong} autoFocus />
        {wrong && (
          <p className="text-[15px] text-bad" role="alert">
            كلمة المرور غير صحيحة. تأكد من الحروف الكبيرة والصغيرة ولغة لوحة المفاتيح.
          </p>
        )}
        <SubmitButton busy={busy}>{busy ? "جارٍ التحقق…" : "فتح القسم"}</SubmitButton>
      </form>
      <p className="mt-4 text-[14px] text-muted-foreground">لا تملك كلمة المرور؟ اطلبها من إدارة التواصل المؤسسي. يبقى القسم مفتوحًا حتى تغلق الصفحة أو تضغط «قفل».</p>
    </Centered>
  )
}

function NotReady({ owner }: { owner: boolean }) {
  return (
    <Centered title="القسم قيد الإعداد">
      <p className="text-[16px] leading-relaxed text-muted-foreground">
        {owner
          ? "لم يُجهَّز مفتاح الحماية بعد. اطلب من Claude إنشاء مفتاح الإعداد، ثم عُد إلى هذه الصفحة لضبط كلمة المرور."
          : "تعمل إدارة التواصل المؤسسي على تجهيز حماية هذا القسم. عُد إليه لاحقًا."}
      </p>
    </Centered>
  )
}

function SetupScreen() {
  const { vault } = useStore()
  const [pw, setPw] = useState("")
  const [pw2, setPw2] = useState("")
  const [busy, setBusy] = useState(false)
  const [tried, setTried] = useState(false)
  const issues = passwordIssues(pw)
  const mismatch = pw2.length > 0 && pw !== pw2
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (issues.length || pw !== pw2 || busy) return
    setBusy(true)
    await vault.setup(pw)
    setBusy(false)
  }
  return (
    <Centered title="ضبط كلمة المرور" icon={<ShieldCheck className="h-6 w-6" aria-hidden="true" />}>
      <p className="mb-4 text-[16px] leading-relaxed text-muted-foreground">
        هذه الشاشة تظهر لك وحدك كمالك للمنصة، ومرة واحدة. الكلمة التي تضعها هنا تقفل مفتاح تشفير قسم الأداء والتطوير، ولا تُرسل إلى أي مكان.
      </p>
      <ul className="mb-5 list-disc space-y-1 ps-5 text-[15px] text-muted-foreground">
        <li>استخدم عبارة طويلة يسهل تذكّرها، مثل أربع كلمات متتالية.</li>
        <li>كل من يملكها يرى قسم الأداء والتطوير كاملًا (المؤشرات، الخطط العلاجية، دراسة المنافسين)، فأعطها لمن يحتاجها فقط.</li>
        <li>تستطيع تغييرها لاحقًا من زر «كلمة المرور» داخل القسم.</li>
      </ul>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <PasswordInput id="setup-pw" label="كلمة المرور الجديدة" value={pw} onChange={setPw} autoComplete="new-password" invalid={tried && issues.length > 0} autoFocus />
        <p className={cn("-mt-2 text-[14px]", tried && issues.length ? "text-bad" : "text-muted-foreground")}>{issues.length ? `المطلوب: ${issues.join("، ")}.` : "الطول مناسب."}</p>
        <PasswordInput id="setup-pw2" label="أعد كتابتها" value={pw2} onChange={setPw2} autoComplete="new-password" invalid={mismatch} />
        {mismatch && <p className="-mt-2 text-[14px] text-bad">الكلمتان غير متطابقتين.</p>}
        <SubmitButton busy={busy}>{busy ? "جارٍ الضبط…" : "ضبط كلمة المرور وفتح القسم"}</SubmitButton>
      </form>
    </Centered>
  )
}

function ChangeForm({ onDone }: { onDone: () => void }) {
  const { vault } = useStore()
  const [oldPw, setOldPw] = useState("")
  const [pw, setPw] = useState("")
  const [pw2, setPw2] = useState("")
  const [busy, setBusy] = useState(false)
  const [tried, setTried] = useState(false)
  const [wrong, setWrong] = useState(false)
  const issues = passwordIssues(pw)
  const mismatch = pw2.length > 0 && pw !== pw2
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (!oldPw || issues.length || pw !== pw2 || busy) return
    setBusy(true)
    const r = await vault.changePassword(oldPw, pw)
    setBusy(false)
    if (r === "wrong") setWrong(true)
    if (r === "ok") onDone()
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <PasswordInput id="old-pw" label="كلمة المرور الحالية" value={oldPw} onChange={(v) => { setOldPw(v); setWrong(false) }} autoComplete="current-password" invalid={wrong} />
      {wrong && <p className="-mt-2 text-[14px] text-bad">كلمة المرور الحالية غير صحيحة.</p>}
      <PasswordInput id="new-pw" label="كلمة المرور الجديدة" value={pw} onChange={setPw} autoComplete="new-password" invalid={tried && issues.length > 0} />
      <p className={cn("-mt-2 text-[14px]", tried && issues.length ? "text-bad" : "text-muted-foreground")}>{issues.length ? `المطلوب: ${issues.join("، ")}.` : "الطول مناسب."}</p>
      <PasswordInput id="new-pw2" label="أعد كتابة الجديدة" value={pw2} onChange={setPw2} autoComplete="new-password" invalid={mismatch} />
      {mismatch && <p className="-mt-2 text-[14px] text-bad">الكلمتان غير متطابقتين.</p>}
      <SubmitButton busy={busy}>{busy ? "جارٍ التغيير…" : "تغيير كلمة المرور"}</SubmitButton>
    </form>
  )
}
