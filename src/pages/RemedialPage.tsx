import { useMemo, useState, type ReactNode } from "react"
import { ArrowLeft, ChevronDown, ChevronLeft, ClipboardList, ExternalLink, FileBarChart2, RefreshCw } from "lucide-react"
import { useStore } from "@/data/store"
import { useRouter } from "@/lib/router"
import { usePersistent } from "@/lib/persist"
import { formatDate, formatNumber, formatTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { RemedialRow, RemedialStage, RemedialStatus } from "@/data/types"
import {
  PLAN_LABEL,
  PLAN_TONE,
  STATUS_LABEL,
  STATUS_TONE,
  branchPlans,
  buildRemedialAlerts,
  causes as buildCauses,
  countRows,
  latestRead,
  needsDecision,
  rate,
  rateText,
  type BranchPlan,
  type Counts,
} from "@/data/remedial"
import { Gate } from "@/components/Gate"
import { AlertList } from "@/components/alerts"
import { DataTable, type Column } from "@/components/DataTable"
import { ChipGroup, EmptyState, OpenLink, PageHeader, Panel, PanelHeader, Pill } from "@/components/common"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { RemedialReports } from "@/components/RemedialReports"

const NEEDS = ["remedialFiles", "remedialStages", "remedialRows", "remedialMonthly", "remedialLog", "remedialSync", "branches", "settings", "alertState"] as const
type Tab = "overview" | "causes" | "decisions" | "log" | "reports" | "sources"
const TABS: [Tab, string][] = [
  ["overview", "نظرة عامة"],
  ["causes", "الأسباب × الفروع"],
  ["decisions", "تحتاج قرارًا"],
  ["log", "سجل التغيّرات"],
  ["reports", "التقارير"],
  ["sources", "الملفات والمصادر"],
]

const dt = (iso: string | null | undefined) => (iso ? `${formatDate(iso)} · ${formatTime(new Date(iso))}` : "لم يُقرأ بعد")

export function RemedialPage({ slug }: { slug?: string }) {
  const [refresh, setRefresh] = useState(false)
  return (
    <>
      {slug ? <BranchView slug={slug} onRefresh={() => setRefresh(true)} /> : <Hub onRefresh={() => setRefresh(true)} />}
      <RefreshSheet open={refresh} onClose={() => setRefresh(false)} />
    </>
  )
}

/* ------------------------------------------------------------ hub */
function Hub({ onRefresh }: { onRefresh: () => void }) {
  const { data } = useStore()
  const [tab, setTab] = usePersistent<Tab>("rem-tab", "overview")
  const last = latestRead(data)
  return (
    <>
      <PageHeader
        eyebrow="الخطط العلاجية"
        title="متابعة الخطط العلاجية للفروع"
        description={
          <>
            قراءة فقط من ملفات Google Sheets للفروع. القيم كما كُتبت في الملفات، والحالة من خانة «التنفيذ» وحدها. آخر قراءة: <span className="num font-medium text-foreground">{dt(last)}</span>
          </>
        }
        actions={<RefreshButton onClick={onRefresh} />}
      />
      <div className="-mt-2 mb-5 flex gap-1 overflow-x-auto border-b [scrollbar-width:none]" role="tablist" aria-label="أقسام الخطط العلاجية">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn("relative inline-flex h-12 shrink-0 items-center px-3.5 text-[15px] transition-colors", tab === k ? "font-bold text-primary" : "text-muted-foreground hover:text-foreground")}
          >
            {label}
            {tab === k && <span className="absolute inset-x-2 bottom-0 h-[3px] rounded-full bg-primary" aria-hidden="true" />}
          </button>
        ))}
      </div>
      <Gate needs={[...NEEDS]} emptyWhen={data.remedialFiles.length === 0} emptyTitle="لم تُقرأ ملفات الخطط بعد" emptyBody="تظهر هنا الخطط العلاجية بعد أول قراءة لملفات الفروع.">
        {tab === "overview" && <Overview />}
        {tab === "causes" && <CauseMatrix />}
        {tab === "decisions" && <Decisions />}
        {tab === "log" && <ChangeLog />}
        {tab === "reports" && <RemedialReports />}
        {tab === "sources" && <Sources />}
      </Gate>
    </>
  )
}

export function RefreshButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex h-11 items-center gap-2 rounded-full border bg-card px-5 text-[15px] hover:bg-accent">
      <RefreshCw className="h-4 w-4" aria-hidden="true" />
      تحديث الآن
    </button>
  )
}

function Stat({ label, value, sub, tone = "brand" }: { label: string; value: string; sub?: string; tone?: "brand" | "ok" | "warn" | "bad" }) {
  const bar = { brand: "bg-primary", ok: "bg-ok", warn: "bg-warn", bad: "bg-bad" }[tone]
  return (
    <li className="rise relative rounded-xl border bg-card px-4 py-3.5 ps-5">
      <span className={cn("absolute inset-y-3 start-0 w-1 rounded-full", bar)} aria-hidden="true" />
      <span className="block text-[14px] font-medium text-muted-foreground">{label}</span>
      <span className="num mt-0.5 block text-[28px] font-extrabold leading-tight">{value}</span>
      {sub && <span className="block text-[13px] text-muted-foreground">{sub}</span>}
    </li>
  )
}

export function RateBar({ c, className }: { c: Counts; className?: string }) {
  const r = rate(c)
  if (r === null) return <span className={cn("text-[13px] text-muted-foreground", className)}>لا صفوف منفّذة أو غير منفّذة</span>
  return (
    <div className={cn("min-w-[120px]", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="num text-[16px] font-bold">{rateText(c)}</span>
        <span className="num text-[12px] text-muted-foreground">
          {formatNumber(c.done)} من {formatNumber(c.done + c.notDone)}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">{r !== null && r > 0 && <div className="h-full rounded-full bg-ok" style={{ width: `${r * 100}%` }} />}</div>
    </div>
  )
}

function Overview() {
  const { data } = useStore()
  const { go } = useRouter()
  const plans = useMemo(() => branchPlans(data), [data])
  const alerts = useMemo(() => buildRemedialAlerts(data), [data])
  const all = countRows(data.remedialRows)
  const read = plans.filter((p) => p.readOk).length
  const cols: Column<BranchPlan>[] = [
    { key: "b", header: "الفرع", sort: (p) => p.b.name, render: (p) => <span className="whitespace-nowrap text-[16px] font-bold">{p.b.name}</span> },
    { key: "rate", header: "نسبة التنفيذ", sort: (p) => rate(p.counts), render: (p) => (p.files.length ? <RateBar c={p.counts} /> : <span className="text-[14px] text-muted-foreground">لم يُقرأ بعد</span>) },
    { key: "stages", header: "المراحل", sort: (p) => p.stages.length, render: (p) => <span className="num">{p.files.length ? formatNumber(p.stages.length) : "—"}</span> },
    { key: "empty", header: "مراحل فارغة", sort: (p) => p.emptyStages.length, render: (p) => <span className={cn("num", p.emptyStages.length && "font-bold text-warn")}>{p.files.length ? formatNumber(p.emptyStages.length) : "—"}</span> },
    { key: "noplan", header: "بدون خطة", sort: (p) => p.counts.noPlan, render: (p) => <span className={cn("num", p.counts.noPlan && "font-bold text-bad")}>{p.files.length ? formatNumber(p.counts.noPlan) : "—"}</span> },
    { key: "nobox", header: "بدون خانة", sort: (p) => p.counts.noCheckbox, render: (p) => <span className="num">{p.files.length ? formatNumber(p.counts.noCheckbox) : "—"}</span> },
    {
      key: "change",
      header: "آخر تغيّر",
      sort: (p) => p.lastChange,
      render: (p) => <span className="num whitespace-nowrap text-[14px]">{p.lastChange ? formatDate(p.lastChange) : p.files.length ? <span className="text-muted-foreground">لا تغيّر منذ أول قراءة</span> : "—"}</span>,
    },
    { key: "state", header: "حالة الخطة", sort: (p) => p.state, render: (p) => <Pill tone={PLAN_TONE[p.state]}>{PLAN_LABEL[p.state]}</Pill> },
    { key: "read", header: "آخر قراءة", sort: (p) => p.lastRead, render: (p) => <span className="num whitespace-nowrap text-[14px] text-muted-foreground">{p.lastRead ? formatDate(p.lastRead) : "لم يُقرأ بعد"}</span> },
    { key: "go", header: "", render: () => <ArrowLeft className="h-4 w-4 text-muted-foreground" aria-hidden="true" />, className: "w-8" },
  ]
  return (
    <>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="الفروع المقروءة" value={`${formatNumber(read)} من ${formatNumber(plans.length)}`} sub={`${formatNumber(plans.filter((p) => !p.files.length).length)} بلا ملف في السجل`} />
        <Stat tone="ok" label="صفوف منفّذة" value={formatNumber(all.done)} sub="خانة «التنفيذ» = TRUE" />
        <Stat tone="warn" label="صفوف غير منفّذة" value={formatNumber(all.notDone)} sub="فيها إجراءات والخانة غير محددة" />
        <Stat tone="bad" label="صفوف بدون خطة" value={formatNumber(all.noPlan)} sub={`و${formatNumber(all.noCheckbox)} بدون خانة تنفيذ`} />
      </ul>
      <p className="mt-3 text-[13px] text-muted-foreground">نسبة التنفيذ لكل فرع = المنفّذ ÷ (المنفّذ + غير المنفّذ). صفوف «بدون خطة» و«بدون خانة» تُعرض بجانبها ولا تدخل فيها. لا يوجد متوسط للشركة.</p>
      <Panel className="mt-5">
        <PanelHeader title="الفروع" hint="اضغط على فرع لعرض مراحله وصفوفه." />
        <DataTable caption="الخطط العلاجية لكل فرع" rows={plans} columns={cols} rowKey={(p) => p.b.slug} rowLabel={(p) => `افتح خطة فرع ${p.b.name}`} onRowClick={(p) => go({ page: "remedial", slug: p.b.slug })} stickyFirst />
      </Panel>
      <Panel className="mt-5">
        <PanelHeader title="تنبيهات الخطط العلاجية" hint="تُسجَّل كمُتابَعة، وتُفتح من جديد فقط إذا تغيّرت البيانات التي أطلقتها." />
        <AlertList alerts={alerts} limit={6} />
      </Panel>
    </>
  )
}

/* ------------------------------------------------------------ causes × branches */
function CauseMatrix() {
  const { data } = useStore()
  const [scope, setScope] = useState<"repeated" | "all">("repeated")
  const [open, setOpen] = useState<string | null>(null)
  const list = useMemo(() => buildCauses(data.remedialRows), [data.remedialRows])
  const shown = scope === "repeated" ? list.filter((c) => c.branches.length >= 2) : list
  const branches = data.branches.filter((b) => list.some((c) => c.branches.includes(b.slug)))
  const noCause = data.remedialRows.filter((r) => !r.cause).length
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <ChipGroup<"repeated" | "all">
          label="العرض"
          value={scope}
          onChange={setScope}
          options={[
            { value: "repeated", label: "المتكررة في فرعين فأكثر", count: list.filter((c) => c.branches.length >= 2).length },
            { value: "all", label: "كل الأسباب", count: list.length },
          ]}
        />
        <p className="text-[13px] text-muted-foreground">وُحّدت التنويعات الإملائية الواضحة فقط. السبب المركّب بـ « / » يبقى كما كُتب. {noCause ? `${formatNumber(noCause)} صفًا بلا سبب مكتوب لا تظهر هنا.` : ""}</p>
      </div>
      {shown.length === 0 ? (
        <Panel>
          <EmptyState compact title="لا أسباب متكررة" body="لم يتكرر أي سبب في فرعين أو أكثر." />
        </Panel>
      ) : (
        <Panel className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-[14px]">
              <caption className="sr-only">الأسباب وعدد صفوفها في كل فرع</caption>
              <thead>
                <tr className="border-b bg-muted/50 text-[13px] text-muted-foreground">
                  <th scope="col" className="sticky start-0 z-10 min-w-[220px] bg-muted px-3 py-2 text-start font-medium">السبب</th>
                  <th scope="col" className="px-2 py-2 text-center font-medium">الفروع</th>
                  <th scope="col" className="px-2 py-2 text-center font-medium">منفّذ</th>
                  <th scope="col" className="px-2 py-2 text-center font-medium">غير منفّذ</th>
                  <th scope="col" className="px-2 py-2 text-center font-medium">بدون خطة</th>
                  {branches.map((b) => (
                    <th key={b.slug} scope="col" className="whitespace-nowrap px-2 py-2 text-center font-medium">{b.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => (
                  <MatrixRow key={c.key} c={c} branches={branches} open={open === c.key} onToggle={() => setOpen(open === c.key ? null : c.key)} />
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t px-4 py-2.5 text-[13px] text-muted-foreground">الرقم في خانة الفرع = عدد الصفوف بهذا السبب، والنقطة الخضراء تعني أن فيها صفًا منفّذًا على الأقل.</p>
        </Panel>
      )}
    </>
  )
}

function MatrixRow({ c, branches, open, onToggle }: { c: ReturnType<typeof buildCauses>[number]; branches: { slug: string; name: string }[]; open: boolean; onToggle: () => void }) {
  const { data } = useStore()
  return (
    <>
      <tr className="border-b align-top">
        <th scope="row" className="sticky start-0 z-10 bg-card px-3 py-2 text-start font-medium">
          <button type="button" onClick={onToggle} aria-expanded={open} className="flex items-start gap-1 text-start hover:text-primary">
            <ChevronDown className={cn("mt-1 h-3.5 w-3.5 shrink-0 transition-transform", !open && "-rotate-90")} aria-hidden="true" />
            <span>{c.name}</span>
          </button>
        </th>
        <td className="num px-2 py-2 text-center font-bold">{formatNumber(c.branches.length)}</td>
        <td className="num px-2 py-2 text-center text-ok">{formatNumber(c.counts.done)}</td>
        <td className="num px-2 py-2 text-center">{formatNumber(c.counts.notDone)}</td>
        <td className={cn("num px-2 py-2 text-center", c.counts.noPlan && "font-bold text-bad")}>{formatNumber(c.counts.noPlan)}</td>
        {branches.map((b) => {
          const pc = c.perBranch[b.slug]
          const n = pc ? pc.done + pc.notDone + pc.noPlan + pc.noCheckbox : 0
          return (
            <td key={b.slug} className="px-2 py-2 text-center">
              {n ? (
                <span className="num inline-flex items-center gap-1">
                  {formatNumber(n)}
                  <span className={cn("inline-block h-2 w-2 rounded-full", pc!.done ? "bg-ok" : "bg-muted-foreground/30")} aria-label={pc!.done ? "فيه تنفيذ" : "لا تنفيذ"} />
                </span>
              ) : (
                <span className="text-muted-foreground/40">·</span>
              )}
            </td>
          )
        })}
      </tr>
      {open && (
        <tr className="border-b bg-muted/30">
          <td colSpan={5 + branches.length} className="px-4 py-3 text-[13px]">
            <p className="font-medium">الصيغ كما وردت في الملفات:</p>
            <ul className="mt-1 list-inside list-disc text-muted-foreground">
              {c.variants.map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
            <p className="mt-2 font-medium">الفروع: <span className="font-normal text-muted-foreground">{c.branches.map((s) => data.branches.find((b) => b.slug === s)?.name ?? s).join("، ")}</span></p>
          </td>
        </tr>
      )}
    </>
  )
}

/* ------------------------------------------------------------ needs a decision */
function Decisions() {
  const { data } = useStore()
  const list = useMemo(() => needsDecision(buildCauses(data.remedialRows)), [data.remedialRows])
  return (
    <>
      <p className="mb-4 text-[15px] text-muted-foreground">سبب ورد في ٣ فروع أو أكثر، ولم يُنفَّذ فيه أي صف حتى آخر قراءة.</p>
      {list.length === 0 ? (
        <Panel>
          <EmptyState compact title="لا يوجد ما يحتاج قرارًا" body="لا يوجد سبب ورد في ثلاثة فروع أو أكثر دون أي تنفيذ." />
        </Panel>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((c) => (
            <li key={c.key} className="rise rounded-xl border border-s-4 border-s-bad bg-card p-4">
              <p className="text-[17px] font-bold">{c.name}</p>
              <p className="mt-1 text-[14px] text-muted-foreground">
                في <b className="num text-foreground">{formatNumber(c.branches.length)}</b> فروع · <span className="num">{formatNumber(c.rows.length)}</span> صفًا · منفّذ <span className="num">0</span> · غير منفّذ{" "}
                <span className="num">{formatNumber(c.counts.notDone)}</span> · بدون خطة <span className="num">{formatNumber(c.counts.noPlan)}</span>
              </p>
              <p className="mt-2 text-[13px] text-muted-foreground">{c.branches.map((s) => data.branches.find((b) => b.slug === s)?.name ?? s).join("، ")}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

/* ------------------------------------------------------------ change log */
function ChangeLog({ branch }: { branch?: string }) {
  const { data } = useStore()
  const list = data.remedialLog.filter((e) => !branch || e.branch === branch).sort((a, b) => b.readAt.localeCompare(a.readAt))
  const first = data.remedialFiles.filter((f) => f.readAt && (!branch || f.branch === branch)).map((f) => f.firstReadAt ?? f.readAt!).sort()[0]
  if (!list.length)
    return (
      <Panel>
        <EmptyState
          compact
          title="لا تغيّرات مسجّلة بعد"
          body={first ? `أول قراءة كانت ${dt(first)}. تظهر التغيّرات هنا عندما تتغيّر خانة «التنفيذ» بين قراءة والتي تليها.` : "تظهر التغيّرات بعد قراءتين على الأقل."}
        />
      </Panel>
    )
  return (
    <Panel className="overflow-hidden">
      <ul className="divide-y">
        {list.map((e) => (
          <li key={e.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[15px] font-medium">
                {data.branches.find((b) => b.slug === e.branch)?.name} · {e.stageName} · صف {formatNumber(e.sheetRow)}
              </p>
              <p className="text-[14px] text-muted-foreground">{e.cause ?? e.problem ?? "—"}</p>
            </div>
            <div className="text-end text-[13px]">
              <p>
                <span className="text-muted-foreground">{e.fromStatus ? STATUS_LABEL[e.fromStatus] : "—"}</span> ← <b>{STATUS_LABEL[e.toStatus]}</b>
              </p>
              <p className="num text-muted-foreground">{dt(e.readAt)}</p>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

/* ------------------------------------------------------------ sources */
function Sources({ branch }: { branch?: string }) {
  const { data } = useStore()
  const files = data.remedialFiles.filter((f) => (branch ? f.branch === branch : true)).sort((a, b) => (a.isRegister ? -1 : b.isRegister ? 1 : (a.label ?? "").localeCompare(b.label ?? "", "ar")))
  const sync = data.remedialSync.find((s) => s.id === "status")
  return (
    <div className="space-y-4">
      {!branch && sync && (
        <Panel>
          <PanelHeader title="طريقة القراءة" />
          <div className="space-y-1 px-5 py-4 text-[15px]">
            <p>{sync.method}</p>
            <p className="text-muted-foreground">
              آخر تشغيل: <span className="num">{dt(sync.lastRun)}</span> · {sync.previousRunCompared ? `قورنت بالقراءة السابقة (${formatNumber(sync.changes)} تغيّرًا)` : "أول قراءة، لا توجد قراءة سابقة للمقارنة"}
            </p>
          </div>
        </Panel>
      )}
      {files.map((f) => {
        const excluded = f.sheets.filter((s) => s.kind === "excluded")
        return (
          <Panel key={f.id}>
            <PanelHeader
              title={f.isRegister ? f.label : `${data.branches.find((b) => b.slug === f.branch)?.name ?? ""}${f.label ? ` · ${f.label}` : ""}`}
              hint={
                <span className="num">
                  {f.readStatus === "success" ? `قُرئ ${dt(f.readAt)}` : f.readStatus === "failed" ? `فشلت القراءة ${dt(f.readAt)}` : "لم يُقرأ بعد"}
                  {f.message ? ` · ${f.message}` : ""}
                </span>
              }
              actions={<OpenLink href={f.url} size="sm">فتح الملف</OpenLink>}
            />
            {!f.isRegister && (
              <div className="grid gap-4 px-5 py-4 md:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-[14px] font-bold">تبويبات اعتُبرت خططًا أو متابعة</p>
                  <ul className="space-y-1 text-[14px]">
                    {f.sheets.filter((s) => s.kind !== "excluded").map((s) => (
                      <li key={s.title} className="flex flex-wrap items-baseline gap-2">
                        <Pill tone={s.kind === "plan" ? "brand" : "sky"}>{s.kind === "plan" ? "خطة" : "متابعة شهرية"}</Pill>
                        <span>{s.title.trim()}</span>
                        <span className="num text-[12px] text-muted-foreground">
                          صف العناوين {formatNumber(s.headerRow ?? 0)} · {formatNumber(s.rows ?? 0)} صفًا
                        </span>
                      </li>
                    ))}
                    {f.sheets.every((s) => s.kind === "excluded") && <li className="text-muted-foreground">لا يوجد</li>}
                  </ul>
                </div>
                <div>
                  <p className="mb-1.5 text-[14px] font-bold">تبويبات لم تُعتبر خططًا</p>
                  <ul className="space-y-1.5 text-[14px]">
                    {excluded.map((s) => (
                      <li key={s.title}>
                        <span className="font-medium">{s.title.trim()}</span>
                        <span className="block text-[13px] text-muted-foreground">{s.reason}</span>
                      </li>
                    ))}
                    {!excluded.length && <li className="text-muted-foreground">لا يوجد</li>}
                  </ul>
                </div>
              </div>
            )}
          </Panel>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------ refresh explainer */
function RefreshSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data } = useStore()
  const files = data.remedialFiles.filter((f) => !f.isRegister)
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-lg" dir="rtl">
        <SheetHeader className="pe-8 text-start">
          <SheetTitle className="text-start text-[22px] font-bold">تحديث الخطط العلاجية</SheetTitle>
          <SheetDescription className="text-start text-[15px]">المنصة لا تقرأ ملفات Google بنفسها، ولا تكتب فيها شيئًا.</SheetDescription>
        </SheetHeader>
        <div className="mt-5 space-y-4 text-[15px] leading-relaxed">
          <ol className="list-inside list-decimal space-y-2">
            <li>افتح محادثة Claude المرتبطة بهذه المنصة، والتي فيها موصل Google Sheets بحساب له صلاحية عرض ملفات الفروع.</li>
            <li>
              اكتب: <b>«حدّث الخطط العلاجية في مركز التواصل المؤسسي»</b>.
            </li>
            <li>يقرأ Claude سجل الروابط وكل ملف فرع، ويقارن خانة «التنفيذ» بالقراءة السابقة، ثم يكتب النتائج وسجل التغيّرات في قاعدة المنصة.</li>
            <li>تتحدث هذه الصفحة تلقائيًا عند وصول البيانات.</li>
          </ol>
          <div>
            <p className="mb-1.5 font-bold">آخر قراءة لكل ملف</p>
            <ul className="divide-y rounded-lg border text-[14px]">
              {files.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span>{f.label ?? data.branches.find((b) => b.slug === f.branch)?.name}</span>
                  <span className={cn("num text-[13px]", f.readStatus === "success" ? "text-muted-foreground" : "text-bad")}>{f.readStatus === "success" ? dt(f.readAt) : f.readStatus === "failed" ? "فشلت" : "لم يُقرأ بعد"}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

/* ------------------------------------------------------------ branch page */
type RowFilter = "all" | RemedialStatus
function BranchView({ slug, onRefresh }: { slug: string; onRefresh: () => void }) {
  const { data } = useStore()
  const { go } = useRouter()
  const [, setTab] = usePersistent<Tab>("rem-tab", "overview")
  const plan = useMemo(() => branchPlans(data).find((p) => p.b.slug === slug), [data, slug])
  const monthly = data.remedialMonthly.filter((m) => m.branch === slug)
  const openReport = () => {
    try {
      sessionStorage.setItem("hub:rr-scope", JSON.stringify("one"))
      sessionStorage.setItem("hub:rr-one", JSON.stringify(slug))
    } catch {
      /* storage blocked: the report opens with its defaults */
    }
    setTab("reports")
    go({ page: "remedial" })
  }
  return (
    <>
      <nav aria-label="مسار الصفحة" className="pt-6 text-[15px] text-muted-foreground">
        <button type="button" onClick={() => go({ page: "remedial" })} className="hover:text-foreground hover:underline">
          الخطط العلاجية
        </button>
        <ChevronLeft className="mx-1 inline h-4 w-4" aria-hidden="true" />
        <span className="text-foreground">{plan?.b.name ?? "فرع"}</span>
      </nav>
      <Gate needs={[...NEEDS]}>
        {!plan ? (
          <Panel className="mt-6">
            <EmptyState title="لم نجد هذا الفرع" action={<button type="button" onClick={() => go({ page: "remedial" })} className="font-bold text-primary underline">العودة</button>} />
          </Panel>
        ) : (
          <>
            <section className="pattern-stars rise relative mt-4 overflow-hidden rounded-2xl bg-band px-6 py-6 text-band-foreground sm:px-8">
              <div className="relative flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[14px] text-band-soft">
                    <ClipboardList className="h-4 w-4 text-gold" aria-hidden="true" />
                    الخطة العلاجية
                  </p>
                  <h1 className="mt-1 text-[28px] font-extrabold leading-tight sm:text-[32px]">أندلس {plan.b.name}</h1>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Pill tone={PLAN_TONE[plan.state]}>{PLAN_LABEL[plan.state]}</Pill>
                    <Pill tone="neutral">{formatNumber(plan.stages.length)} مراحل</Pill>
                    {plan.emptyStages.length > 0 && <Pill tone="warn">{formatNumber(plan.emptyStages.length)} مرحلة فارغة</Pill>}
                  </div>
                </div>
                <div className="rounded-xl bg-white/[0.08] px-4 py-3 ring-1 ring-white/15">
                  <p className="text-[13px] text-white/70">نسبة التنفيذ</p>
                  <p className="num text-[28px] font-extrabold">{rateText(plan.counts)}</p>
                  <p className="num text-[12px] text-white/70">
                    {formatNumber(plan.counts.done)} منفّذ من {formatNumber(plan.counts.done + plan.counts.notDone)}
                  </p>
                </div>
              </div>
              <div className="relative mt-4 flex flex-wrap gap-2">
                {plan.files.map((f) => (
                  <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-[14px] ring-1 ring-white/25 hover:bg-white/15">
                    {f.label ?? "ملف الخطة"} · <span className="num">{f.readStatus === "success" ? formatDate(f.readAt) : "لم يُقرأ"}</span>
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                ))}
                <button type="button" onClick={openReport} className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-[14px] font-bold text-[hsl(240_57%_30%)] hover:bg-white/90">
                  <FileBarChart2 className="h-4 w-4" aria-hidden="true" />
                  تقرير هذا الفرع
                </button>
                <button type="button" onClick={onRefresh} className="inline-flex h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-[14px] ring-1 ring-white/25 hover:bg-white/15">
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  تحديث الآن
                </button>
              </div>
            </section>

            {plan.files.length === 0 ? (
              <Panel className="mt-5">
                <EmptyState title="لا يوجد ملف خطة لهذا الفرع" body="الفرع غير مدرج في سجل روابط الخطط العلاجية، فلم يُقرأ له ملف. عند إضافة رابطه للسجل يُقرأ في التحديث التالي." />
              </Panel>
            ) : (
              <>
                <ul className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <Stat tone="ok" label="منفّذ" value={formatNumber(plan.counts.done)} />
                  <Stat tone="warn" label="غير منفّذ" value={formatNumber(plan.counts.notDone)} />
                  <Stat tone="bad" label="بدون خطة" value={formatNumber(plan.counts.noPlan)} />
                  <Stat label="بدون خانة تنفيذ" value={formatNumber(plan.counts.noCheckbox)} />
                </ul>
                <h2 className="mt-8 text-[22px] font-bold">المراحل</h2>
                {plan.stages.length === 0 && (
                  <Panel className="mt-3">
                    <EmptyState compact title="لا توجد مراحل مقروءة" body="لم يُعثر في الملف على تبويب خطة معبّأ. راجع «تبويبات لم تُعتبر خططًا» أسفل الصفحة." />
                  </Panel>
                )}
                <div className="mt-3 space-y-3">
                  {plan.stages.map((s, i) => (
                    <StageBlock key={s.id} s={s} rows={plan.rows.filter((r) => r.stage === s.id)} defaultOpen={i === 0} />
                  ))}
                </div>

                <h2 className="mt-8 text-[22px] font-bold">المتابعة الشهرية</h2>
                <MonthlyBlock rows={monthly} files={plan.files} />

                <h2 className="mt-8 text-[22px] font-bold">سجل آخر التغييرات</h2>
                <div className="mt-3">
                  <ChangeLog branch={slug} />
                </div>

                <h2 className="mt-8 text-[22px] font-bold">الملفات والتبويبات</h2>
                <div className="mt-3">
                  <Sources branch={slug} />
                </div>
              </>
            )}
          </>
        )}
      </Gate>
    </>
  )
}

function StageBlock({ s, rows, defaultOpen }: { s: RemedialStage; rows: RemedialRow[]; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const [filter, setFilter] = useState<RowFilter>("all")
  const c = countRows(rows)
  const shown = rows.filter((r) => filter === "all" || r.status === filter).sort((a, b) => a.sheetRow - b.sheetRow)
  return (
    <Panel className="overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-start hover:bg-accent/40">
        <span className="flex min-w-0 items-center gap-2">
          <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", !open && "-rotate-90")} aria-hidden="true" />
          <span className="text-[18px] font-bold">{s.name}</span>
          {s.empty && <Pill tone="warn">مرحلة فارغة</Pill>}
        </span>
        <span className="flex flex-wrap items-center gap-3 text-[13px]">
          <span className="num">نسبة التنفيذ <b>{rateText(c)}</b></span>
          <span className="num text-muted-foreground">
            {formatNumber(c.done)} منفّذ · {formatNumber(c.notDone)} غير منفّذ · {formatNumber(c.noPlan)} بدون خطة · {formatNumber(c.noCheckbox)} بدون خانة
          </span>
        </span>
      </button>
      {open && (
        <div className="border-t px-5 py-4">
          <div className="mb-3 space-y-0.5 text-[13px] text-muted-foreground">
            {s.heading.map((h, i) => (
              <p key={i}>{h}</p>
            ))}
            <p className="pt-1 text-[14px]">
              الاعتماد: {s.approval.filled ? <b className="text-foreground">مكتوب في الملف: {s.approval.value}</b> : <b className="text-foreground">غير معتمد في الملف</b>}
            </p>
          </div>
          {!s.empty && (
            <ChipGroup<RowFilter>
              label="الحالة"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "الكل", count: rows.length },
                { value: "done", label: STATUS_LABEL.done, count: c.done },
                { value: "not-done", label: STATUS_LABEL["not-done"], count: c.notDone },
                { value: "no-plan", label: STATUS_LABEL["no-plan"], count: c.noPlan },
                { value: "no-checkbox", label: STATUS_LABEL["no-checkbox"], count: c.noCheckbox },
              ]}
            />
          )}
          {s.empty ? (
            <p className="rounded-lg bg-muted/70 px-4 py-3 text-[14px] text-muted-foreground">لا يوجد في هذا التبويب أي صف فيه سبب أو مشكلة أو إجراءات.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {shown.map((r) => (
                <RowCard key={r.id} r={r} />
              ))}
            </ul>
          )}
        </div>
      )}
    </Panel>
  )
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd className={cn("whitespace-pre-line break-words text-[14px]", !value && "text-muted-foreground")}>{value ?? "غير مكتوب في الملف"}</dd>
    </div>
  )
}

function Expandable({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const long = text.length > 280 || text.split("\n").length > 5
  return (
    <div>
      <p className={cn("whitespace-pre-line break-words text-[14px] leading-relaxed", long && !open && "line-clamp-5")}>{text}</p>
      {long && (
        <button type="button" onClick={() => setOpen(!open)} className="mt-1 text-[13px] font-bold text-primary hover:underline">
          {open ? "إخفاء" : "عرض النص كاملًا"}
        </button>
      )}
    </div>
  )
}

function RowCard({ r }: { r: RemedialRow }) {
  return (
    <li className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
          {r.num && <span className="num rounded bg-muted px-1.5 py-0.5 font-bold text-foreground">#{r.num}</span>}
          <span className="num">صف {formatNumber(r.sheetRow)} في الملف</span>
        </span>
        <Pill tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Pill>
      </div>
      <dl className="mt-2 space-y-2">
        <Field label="السبب" value={r.cause} />
        <Field label="المشكلة الفرعية" value={r.problem} />
        <div>
          <dt className="text-[12px] text-muted-foreground">الإجراءات</dt>
          <dd>{r.actions ? <Expandable text={r.actions} /> : <span className="text-[14px] text-muted-foreground">غير مكتوب في الملف</span>}</dd>
        </div>
      </dl>
      {(() => {
        const items: [string, string | null][] = [
          ["المسؤول عن التنفيذ", r.owner],
          ["تاريخ البدء (كما كُتب)", r.start],
          ["تاريخ الاكتمال (كما كُتب)", r.end],
          ["مؤشر القياس", r.indicator],
          ["خط الأساس", r.baseline],
          ["المستهدف", r.target],
          ...Object.entries(r.extra),
        ]
        const filled = items.filter(([, v]) => v)
        const missing = items.filter(([, v]) => !v).map(([k]) => k.replace(" (كما كُتب)", ""))
        return (
          <div className="mt-3 border-t pt-3">
            {filled.length > 0 && (
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filled.map(([k, v]) => (
                  <Field key={k} label={k} value={v} />
                ))}
              </dl>
            )}
            {missing.length > 0 && <p className={cn("text-[12px] text-muted-foreground", filled.length && "mt-2")}>غير مكتوب في الملف: {missing.join("، ")}</p>}
          </div>
        )
      })()}
    </li>
  )
}

function MonthlyBlock({ rows, files }: { rows: ReturnType<typeof useStore>["data"]["remedialMonthly"]; files: BranchPlan["files"] }) {
  const sheets = files.flatMap((f) => f.sheets.filter((s) => s.kind === "monthly").map((s) => ({ file: f, s })))
  if (!sheets.length)
    return (
      <Panel className="mt-3">
        <EmptyState compact title="لا يوجد تبويب متابعة شهرية" body="لم يُعثر على تبويب فيه صف عناوين يحتوي «أكتوبر»." />
      </Panel>
    )
  return (
    <div className="mt-3 space-y-3">
      {sheets.map(({ file, s }) => {
        const list = rows.filter((m) => m.file === file.id && m.sheet === s.title.replace(/\s+/g, " ").trim()).sort((a, b) => a.order - b.order)
        const cols = s.columns ?? []
        return (
          <Panel key={file.id + s.title} className="overflow-hidden">
            <PanelHeader title={s.title.trim()} hint={list.length ? `${formatNumber(list.length)} صفًا` : "التبويب موجود ولم تُعبّأ فيه صفوف بعد"} />
            {list.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-[13px]">
                  <caption className="sr-only">{s.title}</caption>
                  <thead>
                    <tr className="border-b bg-muted/50 text-muted-foreground">
                      {cols.map((c) => (
                        <th key={c} scope="col" className="px-2 py-2 text-start font-medium">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((m) => (
                      <tr key={m.id} className="border-b align-top last:border-0">
                        {cols.map((c) => (
                          <td key={c} className={cn("max-w-[260px] whitespace-pre-line break-words px-2 py-2", !m.cells[c] && "text-muted-foreground/50")}>{m.cells[c] ?? "—"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        )
      })}
    </div>
  )
}

export type { ReactNode }
