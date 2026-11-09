import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, ExternalLink, Pencil, Plus, TrendingUp } from "lucide-react"
import { useStore } from "@/data/store"
import type { SocialAccount } from "@/data/types"
import { publicBranches, accountMonth, currentMonth, groupByName, history, indexReadings, isWhatsApp, monthLabel, ownerLabel, platformOf, recordedMonths, shiftMonth, type Index } from "@/data/social"
import { formatDate, formatNumber } from "@/lib/format"
import { usePersistent } from "@/lib/persist"
import { cn } from "@/lib/utils"
import { Gate } from "@/components/Gate"
import { PageHeader, Panel, PanelHeader } from "@/components/common"
import { AccountForm, Growth, PlatformBadge, ReadingsForm, Sparkline } from "@/components/social"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"

/** Latest month with any reading, or the current month when nothing is recorded yet. */
export function defaultSocialMonth(readings: { month: string }[]) {
  return recordedMonths(readings as never)[0] ?? currentMonth()
}

export function MonthStepper({ month, onChange, max }: { month: string; onChange: (m: string) => void; max: string }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border bg-card p-1">
      <button type="button" onClick={() => onChange(shiftMonth(month, -1))} className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent" aria-label="الشهر السابق">
        <ChevronRight className="h-4 w-4" />
      </button>
      <span className="min-w-[8.5rem] text-center text-[15px] font-bold" aria-live="polite">{monthLabel(month)}</span>
      <button
        type="button"
        onClick={() => onChange(shiftMonth(month, 1))}
        disabled={month >= max}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent disabled:opacity-30"
        aria-label="الشهر التالي"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
    </div>
  )
}

type Editing = { kind: "account"; item?: SocialAccount } | { kind: "readings" } | null

export function SocialPage() {
  const { data, canEdit } = useStore()
  const latest = defaultSocialMonth(data.socialReadings)
  const maxMonth = latest > currentMonth() ? latest : currentMonth()
  const [month, setMonth] = usePersistent("social-month", latest)
  const [editing, setEditing] = useState<Editing>(null)
  const idx = useMemo(() => indexReadings(data.socialReadings), [data.socialReadings])

  const accounts = data.socialAccounts.filter((a) => a.active || canEdit)
  const shown = accounts
  const rows = shown.map((a) => ({ a, m: accountMonth(idx, a.id, month) }))
  const recorded = rows.filter((r) => r.m.followers !== null).length
  const grew = rows.filter((r) => (r.m.growth ?? 0) > 0).length
  const fell = rows.filter((r) => (r.m.growth ?? 0) < 0).length
  const top = rows.filter((r) => r.m.growth !== null && r.m.growth > 0).sort((x, y) => y.m.growth! - x.m.growth!)[0]
  const social = rows.filter((r) => !isWhatsApp(r.a))
  const whats = rows.filter((r) => isWhatsApp(r.a))
  const lastRecorded = data.socialReadings.reduce<string | null>((m, r) => (!m || r.recordedAt > m ? r.recordedAt : m), null)

  return (
    <>
      <PageHeader
        eyebrow="التواصل الاجتماعي"
        title="حسابات التواصل وقنوات واتساب"
        description="عدد المتابعين لكل حساب كما سجّله المحرر لكل شهر، والنمو هو الفرق عن الشهر السابق بالعدد."
        actions={
          canEdit ? (
            <>
              <button type="button" onClick={() => setEditing({ kind: "readings" })} className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-[15px] font-bold text-primary-foreground hover:bg-primary/90">
                <TrendingUp className="h-4 w-4" />
                تسجيل أرقام الشهر
              </button>
              <button type="button" onClick={() => setEditing({ kind: "account" })} className="inline-flex h-11 items-center gap-2 rounded-full border bg-card px-5 text-[15px] hover:bg-accent">
                <Plus className="h-4 w-4" />
                إضافة حساب
              </button>
            </>
          ) : undefined
        }
      />
      <Gate
        needs={["socialAccounts", "socialReadings", "settings"]}
        emptyWhen={accounts.length === 0}
        emptyTitle="لم تُضف حسابات بعد"
        emptyBody={
          canEdit ? (
            <span>
              أضف حسابات الشركة والفروع وقنوات واتساب من زر «إضافة حساب»، ثم سجّل عدد المتابعين كل شهر.{" "}
              <button type="button" onClick={() => setEditing({ kind: "account" })} className="font-bold text-primary underline underline-offset-4">إضافة أول حساب</button>
            </span>
          ) : (
            "تظهر هنا حسابات التواصل وقنوات واتساب بعد أن يضيفها محرر المنصة."
          )
        }
      >
        <div className="rise mb-5 flex justify-center sm:justify-start">
          <MonthStepper month={month} onChange={setMonth} max={maxMonth} />
        </div>

        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MiniStat label="الحسابات والقنوات" value={formatNumber(shown.length)} sub={`${formatNumber(social.length)} حسابًا · ${formatNumber(whats.length)} واتساب`} />
          <MiniStat label={`سُجّلت أرقامها في ${monthLabel(month, false)}`} value={formatNumber(recorded)} sub={recorded < shown.length ? `${formatNumber(shown.length - recorded)} بانتظار التسجيل` : "اكتمل التسجيل"} />
          <MiniStat tone="ok" label="نمت" value={formatNumber(grew)} sub="مقارنة بالشهر السابق" />
          <MiniStat tone="bad" label="تراجعت" value={formatNumber(fell)} sub="مقارنة بالشهر السابق" />
        </ul>

        {top && (
          <div className="pattern-stars rise relative mt-5 flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-2xl bg-band px-6 py-5 text-band-foreground">
            <div className="flex items-center gap-4">
              <PlatformBadge platform={top.a.platform} size="lg" />
              <div>
                <p className="text-[14px] text-band-soft">الأعلى نموًا في {monthLabel(month)}</p>
                <p className="text-[22px] font-bold">{platformOf(top.a.platform).label} · {top.a.name}</p>
                <p className="text-[14px] text-white/75">{ownerLabel(top.a.owner, publicBranches(data))}</p>
              </div>
            </div>
            <div className="text-end">
              <p className="num text-[34px] font-extrabold leading-none text-gold" dir="ltr">+{formatNumber(top.m.growth!)}</p>
              <p className="mt-1 text-[14px] text-white/75">متابع جديد · الإجمالي <span className="num">{formatNumber(top.m.followers!)}</span></p>
            </div>
          </div>
        )}

        {groupByName(rows.map((r) => ({ ...r, a: { ...r.a, name: groupOf(r.a) }, orig: r.a }))).map((g) => (
          <section key={g.name} className="mt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[22px] font-bold">{g.name}</h2>
              <span className="text-[14px] text-muted-foreground">
                {formatNumber(g.rows.length)} {g.rows.length > 10 ? "حسابًا" : g.rows.length > 2 ? "حسابات" : g.rows.length === 2 ? "حسابان" : "حساب"}
              </span>
            </div>
            {g.name === BRANCH_CHANNELS ? (
              <ChannelBars rows={g.rows.map(({ orig, m }) => ({ a: orig, m }))} month={month} onEdit={canEdit ? (a) => setEditing({ kind: "account", item: a }) : undefined} />
            ) : (
              <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {g.rows.map(({ orig: a, m }) => (
                  <AccountCard key={a.id} a={a} m={m} idx={idx} month={month} onEdit={canEdit ? () => setEditing({ kind: "account", item: a }) : undefined} />
                ))}
              </ul>
            )}
          </section>
        ))}

        <HistoryTable accounts={shown} idx={idx} month={month} />
        {lastRecorded && <p className="mt-3 text-[14px] text-muted-foreground">آخر تسجيل للأرقام: {formatDate(lastRecorded)}. الأرقام يدخلها محرر المنصة من الحسابات نفسها.</p>}
      </Gate>

      <Sheet open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-lg" dir="rtl">
          <SheetHeader className="pe-8 text-start">
            <SheetTitle className="text-start text-[22px] font-bold">
              {editing?.kind === "readings" ? "تسجيل أرقام الشهر" : editing?.item ? "تعديل الحساب" : "إضافة حساب"}
            </SheetTitle>
            <SheetDescription className="text-start text-[15px]">
              {editing?.kind === "readings" ? "عدد المتابعين لكل حساب نشط في الشهر المختار." : "الحساب أو القناة كما يظهر للجمهور."}
            </SheetDescription>
          </SheetHeader>
          {editing?.kind === "readings" && <ReadingsForm initialMonth={month > currentMonth() ? month : currentMonth()} onDone={() => setEditing(null)} />}
          {editing?.kind === "account" && <AccountForm item={editing.item} onDone={() => setEditing(null)} />}
        </SheetContent>
      </Sheet>
    </>
  )
}

/** Branch WhatsApp channels are shown together in one group instead of one section per channel. */
const BRANCH_CHANNELS = "قنوات واتساب الفروع"
const branchChannel = (a: SocialAccount) => a.owner !== "company" && isWhatsApp(a)
const groupOf = (a: SocialAccount) => (branchChannel(a) ? BRANCH_CHANNELS : a.name)

function MiniStat({ label, value, sub, tone = "brand" }: { label: string; value: string; sub: string; tone?: "brand" | "ok" | "bad" }) {
  const bar = { brand: "bg-primary", ok: "bg-ok", bad: "bg-bad" }[tone]
  return (
    <li className="rise relative rounded-xl border bg-card px-4 py-3.5 ps-5">
      <span className={cn("absolute inset-y-3 start-0 w-1 rounded-full", bar)} aria-hidden="true" />
      <span className="block text-[14px] font-medium text-muted-foreground">{label}</span>
      <span className="num mt-0.5 block text-[28px] font-extrabold leading-tight">{value}</span>
      <span className="block text-[14px] text-muted-foreground">{sub}</span>
    </li>
  )
}

function AccountCard({ a, m, idx, month, onEdit }: { a: SocialAccount; m: ReturnType<typeof accountMonth>; idx: Index; month: string; onEdit?: () => void }) {
  const { data } = useStore()
  const h = history(idx, a.id, month, 12)
  return (
    <li className={cn("rise flex flex-col rounded-xl border bg-card p-4", !a.active && "opacity-60")}>
      <div className="flex items-start gap-3">
        <PlatformBadge platform={a.platform} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-bold">{branchChannel(a) ? a.name : platformOf(a.platform).label}</p>
          <p className="truncate text-[13px] text-muted-foreground">
            {branchChannel(a) ? `${platformOf(a.platform).label} · ${ownerLabel(a.owner, publicBranches(data))}` : `${a.name}${a.owner !== "company" ? ` · ${ownerLabel(a.owner, publicBranches(data))}` : ""}`}
            {!a.active && " · غير نشط"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {a.url && (
            <a href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent" aria-label={`فتح ${a.name}`}>
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          {onEdit && (
            <button type="button" onClick={onEdit} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent" aria-label={`تعديل ${a.name}`}>
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[13px] text-muted-foreground">المتابعون · {monthLabel(month)}</p>
          <p className="num text-[28px] font-extrabold leading-tight">{m.followers !== null ? formatNumber(m.followers) : <span className="text-[16px] font-normal text-muted-foreground">لم يُسجّل</span>}</p>
        </div>
        <div className="text-end">
          <p className="text-[13px] text-muted-foreground">النمو الشهري</p>
          <Growth value={m.growth} className="text-[17px]" empty={m.followers === null ? "—" : "لا قراءة سابقة"} />
        </div>
      </div>
      <Sparkline points={h} className="mt-3 h-10 w-full text-primary" />
      {a.handle && <p className="mt-2 truncate text-[13px] text-muted-foreground" dir="ltr">{a.handle}</p>}
    </li>
  )
}

/** Branch WhatsApp channels ranked by members, one bar each, so the gaps between branches read at a glance. */
function ChannelBars({ rows, month, onEdit }: { rows: { a: SocialAccount; m: ReturnType<typeof accountMonth> }[]; month: string; onEdit?: (a: SocialAccount) => void }) {
  const { data } = useStore()
  const branches = publicBranches(data)
  const sorted = [...rows].sort((x, y) => (y.m.followers ?? -1) - (x.m.followers ?? -1) || x.a.name.localeCompare(y.a.name, "ar"))
  const max = Math.max(1, ...rows.map((r) => r.m.followers ?? 0))
  return (
    <Panel className="mt-3">
      <p className="border-b px-5 py-2.5 text-[13px] text-muted-foreground">الأعضاء · {monthLabel(month)}، مرتبة من الأكبر</p>
      <ul className="divide-y">
        {sorted.map(({ a, m }, i) => (
          <li key={a.id} className={cn("grid grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)_auto] items-center gap-3 px-5 py-2.5 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto]", !a.active && "opacity-60")}>
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-bold">{a.name}</span>
              <span className="block truncate text-[12px] text-muted-foreground">{ownerLabel(a.owner, branches)}</span>
            </span>
            <span className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              {m.followers !== null && (
                <span className="grow-x block h-full rounded-full bg-gradient-to-l from-ok to-sky" style={{ width: `${(m.followers / max) * 100}%`, animationDelay: `${Math.min(i, 12) * 40}ms` }} />
              )}
            </span>
            <span className="flex items-center gap-2">
              <span className="text-end">
                <span className="num block text-[16px] font-extrabold">{m.followers !== null ? formatNumber(m.followers) : <span className="text-[13px] font-normal text-muted-foreground">لم يُسجّل</span>}</span>
                <Growth value={m.growth} className="text-[12px]" empty="" />
              </span>
              {a.url && (
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent" aria-label={`فتح ${a.name}`}>
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
              {onEdit && (
                <button type="button" onClick={() => onEdit(a)} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent" aria-label={`تعديل ${a.name}`}>
                  <Pencil className="h-4 w-4" />
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function HistoryTable({ accounts, idx, month }: { accounts: SocialAccount[]; idx: Index; month: string }) {
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(month, -i))
  if (!accounts.length) return null
  return (
    <Panel className="mt-8">
      <PanelHeader title="السجل الشهري" hint="عدد المتابعين في آخر ستة أشهر، وتحته النمو عن الشهر الذي قبله." />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-[15px]">
          <caption className="sr-only">عدد المتابعين لكل حساب في آخر ستة أشهر</caption>
          <thead>
            <tr className="border-b bg-muted/50 text-[14px] text-muted-foreground">
              <th scope="col" className="px-4 py-2.5 text-start font-medium">الحساب</th>
              {months.map((m) => (
                <th key={m} scope="col" className="px-3 py-2.5 text-end font-medium">{monthLabel(m)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id} className="border-b last:border-0">
                <th scope="row" className="px-4 py-2.5 text-start font-medium">
                  <span className="flex items-center gap-2">
                    <PlatformBadge platform={a.platform} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate">{platformOf(a.platform).label}</span>
                      <span className="block truncate text-[12px] font-normal text-muted-foreground">{a.name}</span>
                    </span>
                  </span>
                </th>
                {months.map((m) => {
                  const v = accountMonth(idx, a.id, m)
                  return (
                    <td key={m} className="px-3 py-2.5 text-end align-top">
                      {v.followers !== null ? <span className="num block font-bold">{formatNumber(v.followers)}</span> : <span className="block text-muted-foreground">—</span>}
                      {v.growth !== null && <Growth value={v.growth} className="text-[13px]" />}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}
