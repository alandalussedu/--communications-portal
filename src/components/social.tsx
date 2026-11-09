import { useMemo, useState, type FormEvent } from "react"
import { ArrowDown, ArrowUp, Loader2, Minus, Trash2 } from "lucide-react"
import { useStore } from "@/data/store"
import type { SocialAccount } from "@/data/types"
import { PLATFORMS, accountMonth, indexReadings, monthLabel, ownerLabel, platformOf, publicBranches, shiftMonth, signed } from "@/data/social"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Banner, SelectField, type Tone } from "./common"
import { PlatformLogo, hasLogo } from "@/components/PlatformLogo"

const BADGE: Record<Tone, string> = {
  ok: "bg-ok text-white",
  bad: "bg-bad text-white",
  warn: "bg-warn text-white",
  gold: "bg-gold text-white",
  sky: "bg-sky text-white",
  brand: "bg-primary text-primary-foreground",
  neutral: "bg-[#14142b] text-white ring-1 ring-white/20",
}

/** A platform shown as a coloured initial (no third-party logos). */
export function PlatformBadge({ platform, size = "md" }: { platform: string; size?: "sm" | "md" | "lg" }) {
  const p = platformOf(platform)
  const box = size === "sm" ? "h-7 w-7" : size === "lg" ? "h-12 w-12" : "h-10 w-10"
  if (hasLogo(p.key))
    return (
      <span className={cn("inline-flex shrink-0 overflow-hidden rounded-xl shadow-sm", size === "sm" && "rounded-lg", box)} title={p.label} aria-hidden="true">
        <PlatformLogo platform={p.key} className="h-full w-full" />
      </span>
    )
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-xl font-bold", BADGE[p.tone], box, size === "sm" ? "text-[11px]" : size === "lg" ? "text-[15px]" : "text-[13px]")}
      title={p.label}
      aria-hidden="true"
      dir="ltr"
    >
      {p.short}
    </span>
  )
}

export function Growth({ value, className, empty = "لا مقارنة" }: { value: number | null; className?: string; empty?: string }) {
  if (value === null) return <span className={cn("text-[13px] text-muted-foreground", className)}>{empty}</span>
  const Icon = value > 0 ? ArrowUp : value < 0 ? ArrowDown : Minus
  return (
    <span className={cn("num inline-flex items-center gap-0.5 font-bold", value > 0 ? "text-ok" : value < 0 ? "text-bad" : "text-muted-foreground", className)} dir="ltr">
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {signed(value, formatNumber)}
    </span>
  )
}

/** Followers over recorded months; gaps stay gaps. Oldest on the right (RTL reading order). */
export function Sparkline({ points, className, stroke = "currentColor" }: { points: { followers: number | null }[]; className?: string; stroke?: string }) {
  const vals = points.map((p) => p.followers).filter((v): v is number => v !== null)
  if (vals.length < 2) return <svg className={className} style={{ display: "block", width: "100%" }} viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><line x1="0" x2="100" y1="28" y2="28" stroke="currentColor" strokeOpacity="0.2" strokeDasharray="3 3" /></svg>
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const span = max - min || 1
  const n = points.length
  let d = ""
  let pen = false
  points.forEach((p, i) => {
    if (p.followers === null) {
      pen = false
      return
    }
    const x = 100 - (i / (n - 1)) * 100
    const y = 27 - ((p.followers - min) / span) * 24
    d += `${pen ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)} `
    pen = true
  })
  const lastIdx = points.map((p) => p.followers !== null).lastIndexOf(true)
  const lx = 100 - (lastIdx / (n - 1)) * 100
  const ly = 27 - ((points[lastIdx].followers! - min) / span) * 24
  return (
    <svg className={className} style={{ display: "block", width: "100%" }} viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
      <path d={d} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={lx} cy={ly} r="2.2" fill={stroke} />
    </svg>
  )
}

const inputCls =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-[16px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"

/* ------------------------------------------------------------ add / edit an account */
export function AccountForm({ item, onDone }: { item?: SocialAccount; onDone: () => void }) {
  const { data, saveSocialAccount, deleteSocialAccount } = useStore()
  const [platform, setPlatform] = useState(item?.platform ?? "instagram")
  const [name, setName] = useState(item?.name ?? "")
  const [handle, setHandle] = useState(item?.handle ?? "")
  const [url, setUrl] = useState(item?.url ?? "")
  const [owner, setOwner] = useState(item?.owner ?? "company")
  const [active, setActive] = useState(item?.active ?? true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const readings = item ? data.socialReadings.filter((r) => r.account === item.id).length : 0

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = "اكتب اسم الحساب أو القناة كما يظهر للجمهور."
    if (url.trim() && !/^https:\/\//.test(url.trim())) errs.url = "الصق رابطًا كاملًا يبدأ بـ https://"
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    const id = item?.id ?? `acc-${Date.now().toString(36)}`
    const ok = await saveSocialAccount({
      id,
      platform,
      name: name.trim(),
      handle: handle.trim() || null,
      url: url.trim() || null,
      owner,
      active,
      order: item?.order ?? (data.socialAccounts.reduce((m, a) => Math.max(m, a.order ?? 0), 0) + 1),
      createdAt: item?.createdAt ?? new Date().toISOString(),
    })
    setBusy(false)
    if (ok) onDone()
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
      <SelectField id="sa-platform" label="المنصة" value={platform} onChange={setPlatform} options={PLATFORMS.map((p) => ({ value: p.key, label: p.label }))} />
      <div>
        <label htmlFor="sa-name" className="mb-1 block text-[15px] font-medium">اسم الحساب أو القناة</label>
        <input id="sa-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} />
        {errors.name && <p className="mt-1 text-[15px] text-bad">{errors.name}</p>}
      </div>
      <div>
        <label htmlFor="sa-handle" className="mb-1 block text-[15px] font-medium">المعرّف <span className="font-normal text-muted-foreground">(اختياري، مثل @alandalus)</span></label>
        <input id="sa-handle" className={inputCls} dir="ltr" value={handle} onChange={(e) => setHandle(e.target.value)} />
      </div>
      <div>
        <label htmlFor="sa-url" className="mb-1 block text-[15px] font-medium">رابط الحساب <span className="font-normal text-muted-foreground">(اختياري)</span></label>
        <input id="sa-url" className={inputCls} dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" aria-invalid={!!errors.url} />
        {errors.url && <p className="mt-1 text-[15px] text-bad">{errors.url}</p>}
      </div>
      <SelectField
        id="sa-owner"
        label="الجهة"
        value={owner}
        onChange={setOwner}
        options={[{ value: "company", label: "حساب الشركة" }, ...publicBranches(data).map((b) => ({ value: b.slug, label: `فرع ${b.name}` }))]}
      />
      <label className="flex items-center gap-2 text-[15px]">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4" />
        الحساب نشط ويظهر في الملخص
      </label>
      <div className="flex flex-wrap items-center gap-2 border-t pt-4">
        <button type="submit" disabled={busy} className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-[16px] font-bold text-primary-foreground disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {item ? "حفظ التعديلات" : "إضافة الحساب"}
        </button>
        <button type="button" onClick={onDone} className="h-11 rounded-full border px-5 text-[16px] hover:bg-accent">إلغاء</button>
        {item && (
          <button type="button" onClick={() => setConfirm(true)} className="ms-auto inline-flex h-11 items-center gap-1.5 px-2 text-[15px] text-bad hover:underline">
            <Trash2 className="h-4 w-4" />
            حذف
          </button>
        )}
      </div>
      {item && confirm && (
        <Banner
          tone="bad"
          title="تأكيد حذف الحساب"
          action={
            <button
              type="button"
              onClick={async () => {
                setBusy(true)
                const ok = await deleteSocialAccount(item.id)
                setBusy(false)
                if (ok) onDone()
              }}
              className="inline-flex h-9 items-center rounded-md bg-bad px-3 text-[15px] font-bold text-white"
            >
              احذف نهائيًا
            </button>
          }
        >
          سيُحذف «{item.name}» {readings ? `ومعه ${formatNumber(readings)} قراءة شهرية` : ""}. لا يمكن التراجع عن الحذف. لإخفائه مع الاحتفاظ بأرقامه، ألغِ خيار «الحساب نشط» بدلًا من الحذف.
        </Banner>
      )}
    </form>
  )
}

/* ------------------------------------------------------------ record a month */
export function ReadingsForm({ initialMonth, onDone }: { initialMonth: string; onDone: () => void }) {
  const { data, saveSocialReadings } = useStore()
  const [month, setMonth] = useState(initialMonth)
  const idx = useMemo(() => indexReadings(data.socialReadings), [data.socialReadings])
  const accounts = data.socialAccounts.filter((a) => a.active)
  const [vals, setVals] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const monthOptions = Array.from({ length: 13 }, (_, i) => shiftMonth(initialMonth, -i))

  const value = (id: string) => vals[`${month}|${id}`] ?? (accountMonth(idx, id, month).followers?.toString() ?? "")

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    const entries = accounts.map((a) => {
      const raw = value(a.id).replace(/[,،\s]/g, "").replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
      if (!raw) return { account: a.id, followers: null }
      if (!/^\d+$/.test(raw)) errs[a.id] = "اكتب عددًا صحيحًا بدون كسور."
      return { account: a.id, followers: Number(raw) }
    })
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    const ok = await saveSocialReadings(month, entries)
    setBusy(false)
    if (ok) onDone()
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
      <SelectField id="sr-month" label="الشهر" value={month} onChange={setMonth} options={monthOptions.map((m) => ({ value: m, label: monthLabel(m) }))} />
      <p className="text-[14px] text-muted-foreground">
        اكتب عدد المتابعين كما يظهر في كل حساب الآن. يُحسب النمو بطرح رقم {monthLabel(shiftMonth(month, -1))} إن كان مسجّلًا. اترك الخانة فارغة إن لم يتوفر الرقم، وإفراغ رقم مسجّل يحذفه.
      </p>
      {accounts.length === 0 ? (
        <p className="rounded-lg bg-muted/70 px-4 py-3 text-[15px] text-muted-foreground">لا توجد حسابات نشطة. أضف الحسابات أولًا.</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {accounts.map((a) => {
            const prev = accountMonth(idx, a.id, month).previous
            return (
              <li key={a.id} className="flex items-center gap-3 px-3 py-2.5">
                <PlatformBadge platform={a.platform} size="sm" />
                <label htmlFor={`sr-${a.id}`} className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">{platformOf(a.platform).label} · {a.name}</span>
                  <span className="block text-[13px] text-muted-foreground">
                    الشهر السابق: {prev !== null ? <span className="num">{formatNumber(prev)}</span> : "غير مسجّل"}
                  </span>
                  {errors[a.id] && <span className="block text-[13px] text-bad">{errors[a.id]}</span>}
                </label>
                <input
                  id={`sr-${a.id}`}
                  inputMode="numeric"
                  dir="ltr"
                  className={cn(inputCls, "num w-32 text-end")}
                  value={value(a.id)}
                  onChange={(e) => setVals((v) => ({ ...v, [`${month}|${a.id}`]: e.target.value }))}
                  aria-invalid={!!errors[a.id]}
                />
              </li>
            )
          })}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t pt-4">
        <button type="submit" disabled={busy || accounts.length === 0} className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-[16px] font-bold text-primary-foreground disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          حفظ أرقام {monthLabel(month)}
        </button>
        <button type="button" onClick={onDone} className="h-11 rounded-full border px-5 text-[16px] hover:bg-accent">إلغاء</button>
      </div>
    </form>
  )
}

export { ownerLabel }
