import { useMemo, useState, type ReactNode } from "react"
import { ExternalLink, Globe, MapPin } from "lucide-react"
import { useStore } from "@/data/store"
import { usePersistent } from "@/lib/persist"
import { formatDate, formatNumber, formatTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Competitor, CompetitorProximity } from "@/data/types"
import { DATA_KEYS, PROX_LABEL, PROX_ORDER, completeness, feeRange, findings, sar, study, type Study, type Tally } from "@/data/competitors"
import { Gate } from "@/components/Gate"
import { DataTable, type Column } from "@/components/DataTable"
import { Banner, EmptyState, PageHeader, Panel, PanelHeader, Pill, type Tone } from "@/components/common"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"

const NEEDS = ["competitors", "competitorsMeta"] as const
type Tab = "analysis" | "table" | "source"
const TABS: [Tab, string][] = [
  ["analysis", "التحليل"],
  ["table", "جدول المقارنة"],
  ["source", "المصدر وجودة البيانات"],
]
const PROX_TONE: Record<CompetitorProximity, Tone> = { near: "warn", mid: "gold", far: "neutral", closed: "neutral" }
const EMPTY = "لم يُجمع"
const accounts = (n: number) => (n === 1 ? "منصة واحدة" : n === 2 ? "منصتان" : n <= 10 ? `${n} منصات` : `${n} منصة`)

const dt = (iso: string | null | undefined) => (iso ? `${formatDate(iso)} · ${formatTime(new Date(iso))}` : "لم يُقرأ بعد")

export function CompetitorsPage() {
  const { data } = useStore()
  const [tab, setTab] = usePersistent<Tab>("comp-tab", "analysis")
  const [open, setOpen] = useState<string | null>(null)
  const s = useMemo(() => study(data.competitors), [data.competitors])
  const meta = data.competitorsMeta
  const current = data.competitors.find((c) => c.id === open) ?? null

  return (
    <>
      <PageHeader
        eyebrow="دراسة المنافسين"
        title={`منافسو مدارس الأندلس في ${meta?.region ?? "جدة"}`}
        description={
          <>
            قراءة فقط من ملف «{meta?.title ?? "دراسة المنافسين"}» الذي يعدّه فريق الدراسة. القيم كما كُتبت فيه، وما لم يُدخل يظهر «{EMPTY}». آخر قراءة:{" "}
            <span className="num font-medium text-foreground">{dt(meta?.readAt)}</span>
          </>
        }
      />
      <Gate needs={[...NEEDS]} emptyWhen={data.competitors.length === 0} emptyTitle="لم تُقرأ دراسة المنافسين بعد" emptyBody="تظهر هنا بعد قراءة ملف الدراسة إلى المنصة.">
        <div className="-mt-2 mb-5 flex gap-1 overflow-x-auto border-b [scrollbar-width:none]" role="tablist" aria-label="أقسام دراسة المنافسين">
          {TABS.map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={cn(
                "-mb-px h-11 shrink-0 border-b-2 px-4 text-[16px] transition-colors",
                tab === k ? "border-primary font-bold text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "analysis" && <Analysis s={s} onOpen={setOpen} />}
        {tab === "table" && <Table s={s} onOpen={setOpen} />}
        {tab === "source" && <Source s={s} onOpen={setOpen} />}
      </Gate>
      <Sheet open={current !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-xl" dir="rtl">
          {current && <Detail c={current} baseline={s.baseline} />}
        </SheetContent>
      </Sheet>
    </>
  )
}

/* ------------------------------------------------------------ analysis */
function Analysis({ s, onOpen }: { s: Study; onOpen: (id: string) => void }) {
  const items = findings(s)
  return (
    <div className="space-y-5">
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="أرقام الدراسة">
        <Stat label="منافسون مقروءون" value={formatNumber(s.rivals.length)} sub={s.suggested.length ? `و${formatNumber(s.suggested.length)} مقترحتان بلا بيانات` : undefined} />
        <Stat label="قريبة من الأندلس" value={formatNumber(s.byProx.near.length + s.byProx.mid.length)} sub={s.byProx.mid.length ? `منها ${formatNumber(s.byProx.mid.length)} نوعًا ما` : "حسب الملف"} />
        <Stat
          label="نطاق الرسوم المسجّلة"
          value={s.lowest && s.highest ? `${sar(s.lowest.feesMin!)} إلى ${sar(s.highest.feesMax!)}` : "—"}
          sub={`${formatNumber(s.priced.length)} مدارس من ${formatNumber(s.rivals.length)}`}
          small
        />
        <Stat label="اعتماد Cognia" value={formatNumber(s.accred.find((t) => t.label === "Cognia")?.names.length ?? 0)} sub="مدرسة تذكره" />
      </ul>

      <Panel>
        <PanelHeader title="أبرز ما يقوله الملف" hint="جُمع تلقائيًا من خانات الملف نفسها، بلا أي معلومة من خارجه." />
        <ul className="divide-y">
          {items.map((f) => (
            <li key={f.title} className="px-5 py-3.5">
              <p className="text-[15px] font-bold text-gold-ink">{f.title}</p>
              <p className="mt-0.5 text-[17px] leading-relaxed">{f.text}</p>
            </li>
          ))}
        </ul>
      </Panel>

      <FeesChart s={s} onOpen={onOpen} />

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="القرب من الأندلس" hint="كما صنّفه الملف في خانة «قريبة أو بعيدة»." />
          <div className="space-y-3 px-5 py-4">
            {PROX_ORDER.map((k) =>
              s.byProx[k].length ? (
                <div key={k} className="flex flex-wrap items-center gap-2">
                  <Pill tone={PROX_TONE[k]} className="min-w-[7.5rem] justify-center">
                    {PROX_LABEL[k]} · <span className="num">{s.byProx[k].length}</span>
                  </Pill>
                  {s.byProx[k].map((c) => (
                    <NameButton key={c.id} c={c} onOpen={onOpen} />
                  ))}
                </div>
              ) : null,
            )}
            {s.noProx.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <Pill className="min-w-[7.5rem] justify-center">لم يُحدَّد · <span className="num">{s.noProx.length}</span></Pill>
                {s.noProx.map((c) => (
                  <NameButton key={c.id} c={c} onOpen={onOpen} />
                ))}
              </div>
            )}
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="المناهج والاعتمادات" hint="كما وردت في خانات المسارات والاعتمادات." />
          <div className="space-y-4 px-5 py-4">
            <Bars title="المناهج" rows={s.curricula} total={s.rivals.length + (s.baseline ? 1 : 0)} tone="sky" />
            <Bars title="الاعتمادات" rows={s.accred} total={s.rivals.length + (s.baseline ? 1 : 0)} tone="brand" />
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="نقاط القوة المتكررة" hint="تصنيف لنصوص خانة «أبرز نقاط القوة» لدى المنافسين." />
          <div className="px-5 py-4">
            <Bars rows={s.strengths} total={s.rivals.length} tone="ok" />
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="نقاط الضعف المتكررة" hint="تصنيف لنصوص خانة «أبرز نقاط الضعف»؛ بعضها من تقييمات منشورة لأولياء الأمور." />
          <div className="px-5 py-4">
            <Bars rows={s.weaknesses} total={s.rivals.length} tone="bad" />
          </div>
        </Panel>
      </div>
      <p className="text-[14px] text-muted-foreground">التصنيفات (المناهج، الاعتمادات، المحاور) عناوين مستخرجة من نصوص الملف لتسهيل القراءة، وليست بيانات إضافية. افتح أي مدرسة لقراءة نصها الأصلي.</p>
    </div>
  )
}

function Stat({ label, value, sub, small }: { label: string; value: string; sub?: string; small?: boolean }) {
  return (
    <li className="rounded-2xl border bg-card px-4 py-3.5">
      <p className="text-[14px] text-muted-foreground">{label}</p>
      <p className={cn("num mt-0.5 font-display font-extrabold leading-tight", small ? "text-[22px]" : "text-[30px]")}>{value}</p>
      {sub && <p className="mt-0.5 text-[13px] text-muted-foreground">{sub}</p>}
    </li>
  )
}

function NameButton({ c, onOpen }: { c: Competitor; onOpen: (id: string) => void }) {
  return (
    <button type="button" onClick={() => onOpen(c.id)} className="rounded-full border bg-card px-3 py-0.5 text-[15px] hover:border-primary/40 hover:bg-accent">
      {c.name}
    </button>
  )
}

const BAR: Record<string, string> = { ok: "hsl(var(--ok))", bad: "hsl(var(--bad))", sky: "hsl(var(--sky))", brand: "hsl(var(--primary))" }
function Bars({ title, rows, total, tone }: { title?: string; rows: Tally[]; total: number; tone: keyof typeof BAR }) {
  if (!rows.length) return <p className="text-[15px] text-muted-foreground">{EMPTY}</p>
  return (
    <div>
      {title && <p className="mb-1.5 text-[14px] font-medium text-muted-foreground">{title}</p>}
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.label}>
            <div className="flex items-baseline justify-between gap-3 text-[16px]">
              <span className="font-medium">{r.label}</span>
              <span className="num shrink-0 text-[14px] text-muted-foreground">
                {r.names.length} من {total}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div className="h-full rounded-full" style={{ width: `${Math.max(6, (r.names.length / Math.max(total, 1)) * 100)}%`, background: BAR[tone] }} />
            </div>
            <p className="mt-0.5 text-[13.5px] leading-snug text-muted-foreground">{r.names.join("، ")}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

function FeesChart({ s, onOpen }: { s: Study; onOpen: (id: string) => void }) {
  const rows = [...s.priced].sort((a, b) => a.feesMin! - b.feesMin! || a.feesMax! - b.feesMax!)
  const unpriced = [...s.rivals.filter((c) => c.feesMin == null), ...(s.baseline && s.baseline.feesMin == null ? [s.baseline] : [])]
  if (!rows.length) return null
  const lo = Math.floor(Math.min(...rows.map((c) => c.feesMin!)) / 10000) * 10000
  const hi = Math.ceil(Math.max(...rows.map((c) => c.feesMax!)) / 10000) * 10000
  const pct = (n: number) => ((n - lo) / (hi - lo)) * 100
  const ticks: number[] = []
  for (let t = lo; t <= hi; t += 10000) ticks.push(t)
  return (
    <Panel>
      <PanelHeader title="الرسوم الدراسية" hint="النطاق من أدنى رقم إلى أعلى رقم كما كُتب في الملف، مرتبًا من الأقل. اللون يدل على القرب من مدارس الأندلس." />
      <div className="px-5 py-4">
        <div className="relative h-6 text-[13px] text-muted-foreground" aria-hidden="true" style={{ marginInlineStart: "9.75rem", marginInlineEnd: "8.25rem" }}>
          {ticks.map((t) => (
            <span key={t} className="num absolute top-0" style={{ insetInlineStart: `${pct(t)}%`, transform: "translateX(50%)" }}>
              {sar(t)}
            </span>
          ))}
        </div>
        <ul className="space-y-1.5">
          {rows.map((c) => (
            <li key={c.id} className="flex items-center gap-3">
              <button type="button" onClick={() => onOpen(c.id)} className="w-[9rem] shrink-0 truncate text-start text-[15px] hover:text-primary" title={c.name}>
                {c.name}
              </button>
              <div className="relative h-7 min-w-0 flex-1 rounded-md bg-muted/60">
                {ticks.map((t) => (
                  <span key={t} className="absolute inset-y-0 w-px bg-border" style={{ insetInlineStart: `${pct(t)}%` }} aria-hidden="true" />
                ))}
                <div
                  className="absolute inset-y-1 rounded-full"
                  style={{
                    insetInlineStart: `${pct(c.feesMin!)}%`,
                    width: `${Math.max(1.5, pct(c.feesMax!) - pct(c.feesMin!))}%`,
                    background: c.proxKey === "near" ? "hsl(var(--warn))" : c.proxKey === "mid" ? "hsl(var(--gold))" : "hsl(var(--primary) / 0.65)",
                  }}
                />
              </div>
              <span className="num w-[7.5rem] shrink-0 text-[13px] leading-tight text-muted-foreground">{feeRange(c)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13.5px] text-muted-foreground">
          <Legend color="hsl(var(--warn))" label="قريبة من الأندلس" />
          <Legend color="hsl(var(--gold))" label="نوعًا ما قريبة" />
          <Legend color="hsl(var(--primary) / 0.65)" label="بعيدة أو غير محدّدة" />
        </div>
        {unpriced.length > 0 && (
          <p className="mt-2 text-[14px] text-muted-foreground">
            لم تُسجَّل رسوم: {unpriced.map((c) => (c.baseline ? `${c.name} (مرجع المقارنة)` : c.name)).join("، ")}.
          </p>
        )}
      </div>
    </Panel>
  )
}
function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-5 rounded-full" style={{ background: color }} aria-hidden="true" />
      {label}
    </span>
  )
}

/* ------------------------------------------------------------ table */
function Table({ s, onOpen }: { s: Study; onOpen: (id: string) => void }) {
  const rows = useMemo(() => [...(s.baseline ? [s.baseline] : []), ...s.rivals, ...s.suggested], [s])
  const columns: Column<Competitor>[] = [
    {
      key: "name",
      header: "المدرسة",
      sort: (c) => c.name,
      render: (c) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="font-bold">{c.name}</span>
          {c.baseline && <Pill tone="brand">مرجع المقارنة</Pill>}
          {c.suggested && <Pill tone="gold">مقترحة · بلا بيانات</Pill>}
        </span>
      ),
      className: "min-w-[11rem]",
    },
    { key: "prox", header: "القرب", sort: (c) => (c.proxKey ? PROX_ORDER.indexOf(c.proxKey) : 9), render: (c) => (c.proxKey ? <Pill tone={PROX_TONE[c.proxKey]}>{PROX_LABEL[c.proxKey]}</Pill> : <Muted />) },
    { key: "fees", header: "الرسوم (كما في الملف)", sort: (c) => c.feesMin, render: (c) => (feeRange(c) ? <span className="num">{feeRange(c)}</span> : <Muted />), className: "whitespace-nowrap" },
    { key: "curr", header: "المناهج", sort: (c) => c.curricula.join(" "), render: (c) => <Chips items={c.curricula} /> },
    { key: "accr", header: "الاعتمادات", sort: (c) => c.accredTags.join(" "), render: (c) => <Chips items={c.accredTags} /> },
    { key: "stu", header: "الطلاب", sort: (c) => c.studentsNum, render: (c) => (c.studentsNum ? <span className="num">{formatNumber(c.studentsNum)}</span> : <Muted />) },
    { key: "cls", header: "طلاب الفصل", sort: (c) => c.classSize, render: (c) => (c.classSize ? (c.classSize.length <= 14 ? <span className="num whitespace-nowrap" dir="ltr">{c.classSize}</span> : <span className="text-[14px] text-muted-foreground">بحسب المرحلة · في التفاصيل</span>) : <Muted />) },
    {
      key: "offers",
      header: "خصومات",
      sort: (c) => (c.offers3 === "yes" ? 0 : c.offers3 === "no" ? 1 : 2),
      render: (c) => (c.offers3 === "yes" ? <Pill tone="ok">يوجد</Pill> : c.offers3 === "no" ? <Pill>لا يوجد</Pill> : <Muted />),
    },
    { key: "soc", header: "الحسابات (مذكورة)", sort: (c) => c.socialTags.length, render: (c) => (c.socialTags.length ? <span className="num whitespace-nowrap" title={c.socialTags.join("، ")}>{accounts(c.socialTags.length)}</span> : c.social ? <span className="text-[14px] text-muted-foreground">في التفاصيل</span> : <Muted />) },
    { key: "comp", header: "اكتمال البيانات", sort: (c) => completeness(c).pct, render: (c) => <Complete c={c} /> },
  ]
  return (
    <Panel>
      <PanelHeader title="مقارنة المدارس" hint="اضغط عنوان العمود للفرز وصف المدرسة لقراءة تفاصيلها كما كُتبت في الملف." />
      <DataTable rows={rows} columns={columns} rowKey={(c) => c.id} onRowClick={(c) => onOpen(c.id)} rowLabel={(c) => `تفاصيل ${c.name}`} caption="مقارنة مدارس المنافسين" stickyFirst />
    </Panel>
  )
}
const Muted = () => <span className="text-[14px] text-muted-foreground/80">{EMPTY}</span>
function Chips({ items }: { items: string[] }) {
  return items.length ? (
    <span className="flex flex-wrap gap-1">
      {items.map((t) => (
        <Pill key={t} tone="sky" className="text-[13px]">
          {t}
        </Pill>
      ))}
    </span>
  ) : (
    <Muted />
  )
}
function Complete({ c }: { c: Competitor }) {
  const k = completeness(c)
  return (
    <span className="flex items-center gap-2" title={`${k.filled} من ${k.total} خانة معبّأة`}>
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <span className="block h-full rounded-full bg-primary" style={{ width: `${k.pct}%` }} />
      </span>
      <span className="num text-[14px] text-muted-foreground">{k.pct}%</span>
    </span>
  )
}

/* ------------------------------------------------------------ source + data quality */
function Source({ s, onOpen }: { s: Study; onOpen: (id: string) => void }) {
  const { data } = useStore()
  const meta = data.competitorsMeta
  const all = [...(s.baseline ? [s.baseline] : []), ...s.rivals, ...s.suggested]
  const empties = DATA_KEYS.map((k) => ({ k, label: meta?.columns?.[k] ?? k, missing: all.filter((c) => !c.suggested && !c[k]).length })).filter((e) => e.missing > 0).sort((a, b) => b.missing - a.missing)
  const sheetUrl = meta ? `https://docs.google.com/spreadsheets/d/${meta.sheetId}/edit` : null
  return (
    <div className="space-y-5">
      <Banner tone="sky" title="ملف المنافسين هو المصدر">
        المنصة تقرأ الملف ولا تعدّله. لتغيير أي معلومة عدّلها في الملف نفسه ثم اطلب تحديث القراءة. أُضيفت نقطتان بلا بيانات: المدرستان المذكورتان تحت ملاحظة الملف.
      </Banner>
      <Panel>
        <PanelHeader
          title="الملف"
          actions={
            sheetUrl && (
              <a href={sheetUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[15px] hover:bg-accent">
                فتح الملف
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            )
          }
        />
        <dl className="grid gap-4 px-5 py-4 sm:grid-cols-3">
          <Info label="العنوان" v={meta?.title} />
          <Info label="الورقة" v={meta?.sheetName} />
          <Info label="آخر قراءة" v={dt(meta?.readAt)} />
        </dl>
        {meta?.notes?.length ? (
          <div className="border-t px-5 py-3">
            <p className="text-[14px] text-muted-foreground">ملاحظة الملف</p>
            {meta.notes.map((n) => (
              <p key={n} className="text-[16px]">
                {n}
              </p>
            ))}
          </div>
        ) : null}
      </Panel>
      <Panel>
        <PanelHeader title="الخانات الناقصة" hint="عدد المدارس (من المقروءة) التي لم تُعبَّأ فيها الخانة. هذه فجوات في الملف وليست في المنصة." />
        {empties.length === 0 ? (
          <EmptyState compact title="كل الخانات معبّأة" />
        ) : (
          <ul className="divide-y">
            {empties.map((e) => (
              <li key={e.k} className="flex items-center justify-between gap-3 px-5 py-2.5 text-[16px]">
                <span>{e.label}</span>
                <span className="num text-[15px] text-muted-foreground">
                  {e.missing} من {all.filter((c) => !c.suggested).length}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {s.suggested.length > 0 && (
        <Panel>
          <PanelHeader title="مدارس بلا بيانات بعد" hint="مذكورة في الملف كقريبة من مدارس الأندلس وتنتظر جمع بياناتها." />
          <div className="flex flex-wrap gap-2 px-5 py-4">
            {s.suggested.map((c) => (
              <NameButton key={c.id} c={c} onOpen={onOpen} />
            ))}
          </div>
        </Panel>
      )}
    </div>
  )
}
function Info({ label, v }: { label: string; v?: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-[14px] text-muted-foreground">{label}</dt>
      <dd className="num mt-0.5 break-words text-[17px]">{v || EMPTY}</dd>
    </div>
  )
}

/* ------------------------------------------------------------ one school */
const GROUPS: { title: string; keys: (keyof Competitor)[] }[] = [
  { title: "نبذة", keys: ["owner", "branches", "founded", "kind", "stages", "gender", "tracks"] },
  { title: "الرسوم والعروض", keys: ["feesText", "offers"] },
  { title: "الطلاب والكادر", keys: ["students", "classSize", "staff", "pd", "growth"] },
  { title: "الأكاديمي", keys: ["accreditations", "rankings", "enrichment", "platform", "digital"] },
  { title: "المبنى والمرافق", keys: ["facilities"] },
  { title: "الحضور والتسويق", keys: ["social", "website", "marketing"] },
]
const LABEL: Partial<Record<keyof Competitor, string>> = {
  owner: "المسؤول عن الدراسة", branches: "عدد الفروع", founded: "عام التأسيس", kind: "عالمية أو أهلية", stages: "المراحل الدراسية", gender: "بنين وبنات", tracks: "المسارات التعليمية",
  feesText: "معدل الرسوم الدراسية", offers: "عروض التخفيض", students: "عدد الطلاب", classSize: "عدد الطلاب في الفصل", staff: "عدد الموظفين", pd: "مستوى التنمية المهنية", growth: "معدل نمو الطلاب السنوي",
  accreditations: "الاعتمادات الأكاديمية", rankings: "المراكز في القدرات والتحصيلي", enrichment: "البرامج الإثرائية", platform: "المنصة التعليمية", digital: "تفعيل التحول الرقمي",
  facilities: "تميز المبنى والمرافق", social: "تفعيل السوشيال ميديا", website: "الموقع الإلكتروني", marketing: "معدل الإنفاق التسويقي",
}

function Detail({ c, baseline }: { c: Competitor; baseline: Competitor | null }) {
  const k = completeness(c)
  return (
    <div className="pb-6">
      <SheetHeader className="pe-8 text-start">
        <span className="flex flex-wrap gap-1.5">
          {c.baseline && <Pill tone="brand">مرجع المقارنة</Pill>}
          {c.suggested && <Pill tone="gold">مقترحة · بلا بيانات بعد</Pill>}
          {c.proxKey && (
            <Pill tone={PROX_TONE[c.proxKey]}>
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              {PROX_LABEL[c.proxKey]}
              {!c.baseline && " من الأندلس"}
            </Pill>
          )}
        </span>
        <SheetTitle className="text-start text-[26px] font-bold leading-snug">{c.name}</SheetTitle>
        <SheetDescription className="text-start">
          {c.suggested ? "ذُكرت في ملاحظة الملف ولم تُجمع بياناتها." : <>اكتمال البيانات <span className="num">{k.filled}</span> من <span className="num">{k.total}</span> خانة.</>}
        </SheetDescription>
      </SheetHeader>

      {!c.suggested && (
        <>
          {feeRange(c) && (
            <p className="mt-4 rounded-xl bg-secondary/60 px-4 py-2.5 text-[16px]">
              الرسوم المقروءة من النص: <span className="num font-bold">{feeRange(c)}</span>
              {baseline && baseline.feesMin == null && !c.baseline && <span className="block text-[13.5px] text-muted-foreground">رسوم اليسر غير مُدخلة، فلا مقارنة رقمية معها.</span>}
            </p>
          )}
          <Block title="نقاط القوة" tone="ok" text={c.strengths} themes={c.strengthThemes} />
          <Block title="نقاط الضعف" tone="bad" text={c.weaknesses} themes={c.weaknessThemes} />
          {GROUPS.map((g) => (
            <section key={g.title} className="mt-6">
              <h3 className="border-b pb-1.5 text-[17px] font-bold">{g.title}</h3>
              <dl className="mt-3 space-y-3">
                {g.keys.map((key) => {
                  const v = c[key] as string | null
                  return (
                    <div key={key}>
                      <dt className="text-[14px] text-muted-foreground">{LABEL[key]}</dt>
                      <dd className="mt-0.5 whitespace-pre-line break-words text-[16px] leading-relaxed">
                        {!v ? <span className="text-muted-foreground/80">{EMPTY}</span> : key === "website" ? <Site url={c.website!} /> : v}
                        {key === "feesText" && c.feesLinks.map((u) => (
                          <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center gap-1.5 text-[14px] text-primary hover:underline">
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                            جدول الرسوم المنشور
                          </a>
                        ))}
                      </dd>
                    </div>
                  )
                })}
              </dl>
            </section>
          ))}
        </>
      )}
    </div>
  )
}
function Site({ url }: { url: string }) {
  const ok = /^https?:\/\//i.test(url)
  return ok ? (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-primary hover:underline" dir="ltr">
      <Globe className="h-4 w-4" aria-hidden="true" />
      {url.replace(/^https?:\/\//i, "").replace(/\/$/, "")}
    </a>
  ) : (
    <span>{url}</span>
  )
}
function Block({ title, tone, text, themes }: { title: string; tone: "ok" | "bad"; text: string | null; themes: string[] }): ReactNode {
  return (
    <section className="mt-5">
      <h3 className="border-b pb-1.5 text-[17px] font-bold">{title}</h3>
      {themes.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {themes.map((t) => (
            <Pill key={t} tone={tone} className="text-[13.5px]">
              {t}
            </Pill>
          ))}
        </div>
      )}
      <p className="mt-2.5 whitespace-pre-line break-words text-[16px] leading-relaxed">{text || <span className="text-muted-foreground/80">{EMPTY}</span>}</p>
    </section>
  )
}
