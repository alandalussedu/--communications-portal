import { useMemo, useState, type ReactNode } from "react"
import { BookOpen, Building2, ChevronLeft, FileSpreadsheet, Handshake, HandHeart, LayoutDashboard, ListChecks, Loader2, Plus, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { useStore } from "@/data/store"
import type { Branch, CsrInitiative, CsrPartner } from "@/data/types"
import { CSR_YEAR, TRACKS, branchRows, cityOf, evCount, isCounted, lateness, managementSummary, scoreOne, stageOf, todayIso, diffDays, STAGES, PARTNER_STAGES, EVIDENCES } from "@/data/csr"
import { CITY_GEO, KSA_PATH, project } from "@/data/csrMap"
import { CSR_GUIDE_MD } from "@/data/csrGuide"
import { useRouter } from "@/lib/router"
import { SAVE_ERROR, useDownloads } from "@/lib/downloads"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Gate } from "@/components/Gate"
import { CopyButton, EmptyState, LoadingBlock, Octagram, PageHeader, Panel, PanelHeader } from "@/components/common"
import { LoginForm } from "@/components/EditorLogin"
import { Pill, useSlidingPill } from "@/lib/motion"
import { Kpi, ScoreCell, ScoreRing, StageChip, btn, fmt } from "./csr/ui"
import { InitiativeDetail, InitiativeSheet, InitiativesTab } from "./csr/Initiatives"
import { PartnersTab } from "./csr/Partners"

/**
 * «المسؤولية المجتمعية»: the branches' initiatives under «دليل المسؤولية المجتمعية للفروع».
 * The guide is public; everything else is for signed-in members. Only the management
 * team (editors) enters, approves and decides counting; communication officers read.
 */
const TABS: { key: string; label: string; icon: typeof BookOpen }[] = [
  { key: "overview", label: "نظرة عامة", icon: LayoutDashboard },
  { key: "branches", label: "الفروع", icon: Building2 },
  { key: "initiatives", label: "المبادرات", icon: ListChecks },
  { key: "partners", label: "الشراكات", icon: Handshake },
  { key: "reports", label: "التقارير", icon: FileSpreadsheet },
  { key: "guide", label: "الدليل", icon: BookOpen },
]

export function CsrPage({ tab: tabProp, id }: { tab?: string; id?: string }) {
  const { vault, canEdit, data } = useStore()
  const { go } = useRouter()
  const open = vault.status === "unlocked"
  const tab = TABS.some((t) => t.key === tabProp) ? tabProp! : open ? "overview" : "guide"
  const [branchFilter, setBranchFilter] = useState("")
  const [editing, setEditing] = useState<CsrInitiative | "new" | null>(null)
  const setTab = (k: string) => go({ page: "csr", tab: k })
  const pill = useSlidingPill<HTMLUListElement>(tab)
  const openInit = (i: CsrInitiative) => go({ page: "csr", tab: "initiatives", id: i.id })

  const header = (
    <PageHeader
      eyebrow={`المسؤولية المجتمعية · ${CSR_YEAR}`}
      title={tab === "guide" ? "دليل المسؤولية المجتمعية للفروع" : "مبادرات الفروع"}
      description="مبادرتان لكل فرع: واحدة من المسار التعليمي، وواحدة من المسار التربوي القيمي."
      actions={
        open && canEdit && tab !== "guide" ? (
          <button type="button" onClick={() => setEditing("new")} className={btn.primary}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            مبادرة جديدة
          </button>
        ) : undefined
      }
    />
  )

  let body: ReactNode
  if (tab === "guide") body = <GuideTab />
  else if (vault.status === "loading")
    body = (
      <Panel>
        <LoadingBlock rows={3} label="جارٍ التحقق من الدخول…" />
      </Panel>
    )
  else if (!open) body = <SignIn />
  else
    body = (
      <Gate needs={["branches", "csrInitiatives", "csrPartners"]}>
        {tab === "overview" && <OverviewTab onOpen={openInit} onBranch={(slug) => (setBranchFilter(slug), setTab("initiatives"))} />}
        {tab === "branches" && <BranchesTab onBranch={(slug) => (setBranchFilter(slug), setTab("initiatives"))} />}
        {tab === "initiatives" &&
          (id ? (
            <InitiativeDetail id={id} onBack={() => setTab("initiatives")} onEdit={(i) => setEditing(i)} />
          ) : (
            <InitiativesTab branch={branchFilter} setBranch={setBranchFilter} onOpen={openInit} onNew={() => setEditing("new")} />
          ))}
        {tab === "partners" && <PartnersTab />}
        {tab === "reports" && <ReportsTab />}
      </Gate>
    )

  return (
    <>
      {header}
      <nav className="mb-5 rounded-2xl border bg-card p-1.5" aria-label="أقسام المسؤولية المجتمعية">
        <ul ref={pill.ref} className="relative flex gap-1 overflow-x-auto [scrollbar-width:none]">
          <Pill box={pill.box} ready={pill.ready} className="rounded-xl bg-secondary" />
          {TABS.map((t) => {
            const Icon = t.icon
            const on = t.key === tab
            return (
              <li key={t.key} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setTab(t.key)}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "relative z-10 inline-flex h-10 items-center gap-2 rounded-xl px-3 text-[15px] transition-colors duration-300",
                    on ? "font-bold text-secondary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {t.label}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
      {body}
      {open && canEdit && editing && data.branches.length > 0 && (
        <InitiativeSheet initial={editing === "new" ? null : editing} defaultBranch={branchFilter} onClose={() => setEditing(null)} onSaved={(i) => (setEditing(null), openInit(i))} />
      )}
    </>
  )
}

function SignIn() {
  const { member, connection } = useStore()
  return (
    <section className="rise mx-auto mt-4 max-w-[520px] overflow-hidden rounded-2xl border bg-card">
      <div className="pattern-stars relative overflow-hidden bg-band px-6 py-6 text-band-foreground">
        <Octagram className="pointer-events-none absolute -end-10 -top-12 h-40 w-40 text-gold/25" strokeWidth={1} />
        <div className="relative flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[14px] text-band-soft">المسؤولية المجتمعية</p>
            <h2 className="text-[24px] font-extrabold leading-tight">سجّل الدخول</h2>
          </div>
        </div>
      </div>
      <div className="px-6 py-6">
        <p className="mb-5 text-[16px] leading-relaxed text-muted-foreground">المبادرات والدرجات والشراكات لمسؤولي التواصل وفريق إدارة التواصل المؤسسي. «الدليل» متاح للجميع.</p>
        {connection.kind === "unavailable" ? (
          <p className="text-[15px] text-muted-foreground">{connection.reason}</p>
        ) : member.enabled ? (
          member.mustChange ? <p className="text-[15px] text-muted-foreground">اختر كلمة مرور جديدة من النافذة الظاهرة للمتابعة.</p> : <LoginForm />
        ) : (
          <p className="text-[15px] text-muted-foreground">افتح قسم «الأداء والتطوير» بكلمة المرور، ثم عد إلى هذه الصفحة.</p>
        )}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------ overview */
type Action = { key: string; title: string; sub: string; tag: string; tone: "sky" | "warn" | "bad" | "brand"; init?: CsrInitiative }

function actionsList(inits: CsrInitiative[], partners: CsrPartner[], branchName: (s: string) => string): Action[] {
  const out: Action[] = []
  const today = todayIso()
  for (const i of inits) {
    const where = `${branchName(i.branch)} · ${TRACKS[i.track].label}`
    if (!i.planApproved) out.push({ key: "p" + i.id, title: `اعتماد خطة «${i.name}»`, sub: where, tag: "خطة", tone: "sky", init: i })
    if (i.status === "done" && i.decision === null) {
      const lt = lateness(i)
      if (evCount(i) < 5 || !i.evidenceDate) {
        if (lt.late) out.push({ key: "l" + i.id, title: `شواهد متأخرة: «${i.name}»`, sub: `${where} · تجاوزت أسبوعين من التنفيذ (${formatDate(i.executedDate!)})`, tag: "قرار", tone: "bad", init: i })
        else if (lt.due) {
          const left = diffDays(lt.due, today)
          out.push({ key: "e" + i.id, title: `الشواهد: بقي ${fmt(left)} ${left === 1 ? "يوم" : left === 2 ? "يومان" : left <= 10 ? "أيام" : "يومًا"}`, sub: `${where} · «${i.name}» نُفذت ${formatDate(i.executedDate!)}`, tag: "توثيق", tone: "warn", init: i })
        }
      } else out.push({ key: "d" + i.id, title: `قرار احتساب «${i.name}»`, sub: lt.late ? `${where} · الشواهد وصلت بعد أسبوعين` : where, tag: "احتساب", tone: lt.late ? "bad" : "brand", init: i })
    }
  }
  for (const p of partners) if (!p.approved && p.stage !== "opp") out.push({ key: "s" + p.id, title: `اعتماد شراكة «${p.name}»`, sub: p.branch ? branchName(p.branch) : "شراكة عامة", tag: "شراكة", tone: "sky" })
  return out
}

function OverviewTab({ onOpen, onBranch }: { onOpen: (i: CsrInitiative) => void; onBranch: (slug: string) => void }) {
  const { data } = useStore()
  const { go } = useRouter()
  const branches = data.branches
  const inits = useMemo(() => data.csrInitiatives.filter((i) => i.year === CSR_YEAR), [data.csrInitiatives])
  const rows = useMemo(() => branchRows(branches, inits), [branches, inits])
  const nameOf = (s: string) => branches.find((b) => b.slug === s)?.name ?? s
  const counted = inits.filter(isCounted)
  const full = rows.filter((r) => r.score.edu && r.score.val).length
  const pendingPlans = inits.filter((i) => !i.planApproved).length
  const pendingDecisions = inits.filter((i) => i.status === "done" && i.decision === null).length
  const pendingPartners = data.csrPartners.filter((p) => !p.approved && p.stage !== "opp").length
  const actions = actionsList(inits, data.csrPartners, nameOf)
  const summary = managementSummary(branches, inits, fmt, formatDate(todayIso()))

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="مبادرات محتسبة" value={fmt(counted.length)} of={fmt(branches.length * 2)} hint={`مطلوبة (مبادرتان × ${fmt(branches.length)} فرعًا)`} />
        <Kpi label="فروع أكملت المسارين" value={fmt(full)} of={fmt(branches.length)} hint="مبادرة محتسبة في كل مسار" />
        <Kpi label="المستفيدون في المبادرات المحتسبة" value={fmt(counted.reduce((a, i) => a + (i.beneficiaries ?? 0), 0))} hint="العدد كما سُجّل في المبادرات" />
        <Kpi label="بانتظار قرار الإدارة" value={fmt(pendingPlans + pendingDecisions + pendingPartners)} hint={`${fmt(pendingPlans)} خطط · ${fmt(pendingDecisions)} احتساب · ${fmt(pendingPartners)} شراكات`} tone={pendingPlans + pendingDecisions + pendingPartners ? "warn" : undefined} />
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel className="overflow-hidden">
          <PanelHeader title="درجات الفروع" hint="أفضل مبادرة محتسبة في كل مسار، من 100." />
          <ScoreTable rows={rows} onBranch={onBranch} />
        </Panel>
        <Panel>
          <PanelHeader title="تحتاج إجراء" hint={actions.length ? undefined : "لا يوجد ما ينتظر الإدارة الآن."} />
          {actions.length > 0 && (
            <ul className="divide-y">
              {actions.slice(0, 8).map((a) => (
                <li key={a.key}>
                  <button type="button" onClick={() => (a.init ? onOpen(a.init) : go({ page: "csr", tab: "partners" }))} className="flex w-full items-start gap-3 px-5 py-3 text-start hover:bg-accent/50">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-bold">{a.title}</span>
                      <span className="block text-[13px] text-muted-foreground">{a.sub}</span>
                    </span>
                    <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-bold", { sky: "bg-sky-soft text-sky-ink", warn: "bg-warn-soft text-warn", bad: "bg-bad-soft text-bad", brand: "bg-secondary text-secondary-foreground" }[a.tone])}>{a.tag}</span>
                  </button>
                </li>
              ))}
              {actions.length > 8 && <li className="px-5 py-2.5 text-[13px] text-muted-foreground">و{fmt(actions.length - 8)} غيرها في تبويب «المبادرات».</li>}
            </ul>
          )}
          <p className="border-t px-5 py-2.5 text-[13px] text-muted-foreground">مهلة الأسبوعين محسوبة من تاريخ التنفيذ الفعلي المسجّل في المبادرة.</p>
        </Panel>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="خريطة الفروع في المملكة" />
          <MapView branches={branches} inits={inits} />
        </Panel>
        <Panel>
          <PanelHeader title="الملخص الإداري" hint="يُكتب آليًا من البيانات" actions={<CopyButton text={summary.join("\n")} label="نسخ الملخص" />} />
          <div className="space-y-2.5 px-5 py-4 text-[15px] leading-relaxed">
            {summary.map((p, k) => (
              <p key={k} className={k === summary.length - 1 ? "text-[13px] text-muted-foreground" : undefined}>{p}</p>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  )
}

function ScoreTable({ rows, onBranch }: { rows: ReturnType<typeof branchRows>; onBranch: (slug: string) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-[14px]">
        <thead>
          <tr className="border-b bg-muted/50 text-[13px] text-muted-foreground">
            <th scope="col" className="px-4 py-2.5 text-start font-medium">الفرع</th>
            <th scope="col" className="px-2 py-2.5 text-start font-medium">المسار التعليمي</th>
            <th scope="col" className="px-2 py-2.5 text-start font-medium">المسار التربوي القيمي</th>
            <th scope="col" className="px-2 py-2.5 text-start font-medium">الالتزام</th>
            <th scope="col" className="px-2 py-2.5 text-start font-medium">التوثيق</th>
            <th scope="col" className="px-2 py-2.5 text-start font-medium">الوصول</th>
            <th scope="col" className="px-4 py-2.5 text-start font-medium">الدرجة /100</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.branch.slug} className="border-b last:border-b-0 hover:bg-accent/40">
              <th scope="row" className="px-4 py-2.5 text-start font-bold">
                <button type="button" onClick={() => onBranch(r.branch.slug)} className="hover:text-primary hover:underline">{r.branch.name}</button>
              </th>
              <td className="px-2 py-2.5"><StageChip i={r.eduLead} /></td>
              <td className="px-2 py-2.5"><StageChip i={r.valLead} /></td>
              <td className="px-2 py-2.5"><ScoreCell v={r.score.compliance} of={40} /></td>
              <td className="px-2 py-2.5"><ScoreCell v={r.score.docs} of={35} /></td>
              <td className="px-2 py-2.5"><ScoreCell v={r.score.access} of={25} /></td>
              <td className="px-4 py-2">
                <ScoreRing value={r.score.total} size={46} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MapView({ branches, inits }: { branches: Branch[]; inits: CsrInitiative[] }) {
  const cities = useMemo(() => {
    const m = new Map<string, { count: number; counted: number }>()
    for (const b of branches) {
      const c = cityOf(b.slug)
      if (!CITY_GEO[c]) continue
      const e = m.get(c) ?? { count: 0, counted: 0 }
      e.count++
      e.counted += inits.filter((i) => i.branch === b.slug && isCounted(i)).length
      m.set(c, e)
    }
    return [...m.entries()].sort((a, b) => b[1].count - a[1].count || b[1].counted - a[1].counted)
  }, [branches, inits])
  return (
    <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(190px,auto)]">
      <svg viewBox="0 0 600 503" direction="ltr" className="h-auto w-full" role="img" aria-label="خريطة المملكة العربية السعودية ومدن الفروع">
        <path d={KSA_PATH} className="fill-muted stroke-border" strokeWidth={1.2} />
        {cities.map(([c, v]) => {
          const g = CITY_GEO[c]
          const [x, y] = project(g.lat, g.lon)
          const r = 5 + Math.min(8, v.count)
          return (
            <g key={c}>
              <circle cx={x} cy={y} r={r} className={v.counted ? "fill-gold" : "fill-muted-foreground/50"} stroke="white" strokeWidth={2} />
              <text x={x + g.dx} y={y + g.dy} textAnchor={g.anchor} className="fill-foreground" style={{ fontSize: 15, fontWeight: 700 }}>{c}</text>
            </g>
          )
        })}
      </svg>
      <div>
        <ul className="space-y-1.5 text-[14px]">
          {cities.map(([c, v]) => (
            <li key={c} className="flex items-center justify-between gap-3 whitespace-nowrap">
              <span>
                <span className={cn("me-1.5 inline-block h-2.5 w-2.5 rounded-full", v.counted ? "bg-gold" : "bg-muted-foreground/50")} aria-hidden="true" />
                {c} · <span className="num">{v.count === 1 ? "فرع" : `${fmt(v.count)} فروع`}</span>
              </span>
              <span className="num text-[13px] text-muted-foreground">{fmt(v.counted)} محتسبة</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">لون النقطة: ذهبي = في المدينة مبادرة محتسبة، رمادي = لا يوجد بعد.</p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ branches ranking */
function BranchesTab({ onBranch }: { onBranch: (slug: string) => void }) {
  const { data } = useStore()
  const inits = useMemo(() => data.csrInitiatives.filter((i) => i.year === CSR_YEAR), [data.csrInitiatives])
  const rows = useMemo(() => [...branchRows(data.branches, inits)].sort((a, b) => b.score.total - a.score.total || b.counted - a.counted || a.branch.name.localeCompare(b.branch.name, "ar")), [data.branches, inits])
  let rank = 0, prev = -1
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((r, k) => {
        if (r.score.total !== prev) (rank = k + 1), (prev = r.score.total)
        return (
          <button key={r.branch.slug} type="button" onClick={() => onBranch(r.branch.slug)} className="rounded-2xl border bg-card p-4 text-start transition-colors hover:border-primary/40 hover:bg-accent/30">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] text-muted-foreground">
                  <span className="num">#{rank}</span> · {r.city}
                </p>
                <p className="text-[19px] font-bold">{r.branch.name}</p>
              </div>
              <ScoreRing value={r.score.total} size={60} />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[13px]">
              <span className="inline-flex items-center gap-1.5">تعليمي <StageChip i={r.eduLead} /></span>
              <span className="inline-flex items-center gap-1.5">تربوي قيمي <StageChip i={r.valLead} /></span>
            </div>
            <dl className="mt-3 grid grid-cols-4 gap-2 border-t pt-3 text-center">
              {[
                ["مسجّلة", r.registered],
                ["منفذة", r.done],
                ["محتسبة", r.counted],
                ["مستفيد", r.ben],
              ].map(([l, v]) => (
                <div key={l as string}>
                  <dd className="num text-[17px] font-bold">{fmt(v as number)}</dd>
                  <dt className="text-[12px] text-muted-foreground">{l}</dt>
                </div>
              ))}
            </dl>
            <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-bold text-primary">
              مبادرات الفرع
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------ reports */
function ReportsTab() {
  const { data } = useStore()
  const downloads = useDownloads()
  const [busy, setBusy] = useState(false)
  const inits = useMemo(() => data.csrInitiatives.filter((i) => i.year === CSR_YEAR), [data.csrInitiatives])
  const rows = useMemo(() => branchRows(data.branches, inits), [data.branches, inits])
  const summary = managementSummary(data.branches, inits, fmt, formatDate(todayIso()))
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0)

  const exportXlsx = async () => {
    if (!downloads) return void toast.error("التنزيل غير متاح في هذا العرض")
    setBusy(true)
    try {
      const XLSX = await import("xlsx")
      const nameOf = (s: string) => data.branches.find((b) => b.slug === s)?.name ?? s
      const yes = (b: boolean) => (b ? "نعم" : "لا")
      const wb = XLSX.utils.book_new()
      const add = (rows: Record<string, unknown>[], name: string, empty: string) => {
        const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "ملاحظة": empty }])
        ws["!views"] = [{ RTL: true }] as never
        XLSX.utils.book_append_sheet(wb, ws, name)
      }
      add(
        rows.map((r) => ({
          "الفرع": r.branch.name, "المدينة": r.city,
          "المسار التعليمي": r.eduLead ? (r.eduLead.decision === "rejected" ? "غير محتسبة" : STAGES[stageOf(r.eduLead)]) : "لم تُسجّل",
          "المسار التربوي القيمي": r.valLead ? (r.valLead.decision === "rejected" ? "غير محتسبة" : STAGES[stageOf(r.valLead)]) : "لم تُسجّل",
          "الالتزام /40": r.score.compliance, "التوثيق /35": r.score.docs, "الوصول /25": r.score.access, "الدرجة /100": r.score.total,
          "مسجّلة": r.registered, "منفذة": r.done, "محتسبة": r.counted, "المستفيدون": r.ben, "المتطوعون": r.vol, "الساعات التطوعية": r.hours, "التكلفة (ريال)": r.cost,
        })),
        "درجات الفروع", "لا توجد فروع",
      )
      add(
        inits.map((i) => {
          const s = scoreOne(i), lt = lateness(i)
          return {
            "الفرع": nameOf(i.branch), "المسار": TRACKS[i.track].label, "المبادرة": i.name, "الفئة المستهدفة": i.audience,
            "المرحلة": i.decision === "rejected" ? "غير محتسبة" : STAGES[stageOf(i)], "التاريخ المخطط": i.plannedDate ?? "", "ضمن الخطة السنوية": yes(i.inPlan),
            "تستهدف المجتمع الخارجي": yes(i.external), "مجانية": yes(i.free), "اعتماد الخطة": yes(i.planApproved), "عمل خيري مدمج": yes(i.charity), "الجهة الشريكة": i.partnerName,
            "تاريخ التنفيذ": i.executedDate ?? "", "المستفيدون": i.beneficiaries ?? "", "طريقة الحصر": i.countMethod, "الطلاب المتطوعون": i.students ?? "", "المنسوبون المتطوعون": i.staff ?? "",
            "الساعات التطوعية": i.hours ?? "", "التكلفة (ريال)": i.cost ?? "", "تاريخ رفع الشواهد": i.evidenceDate ?? "", "الشواهد المكتملة /5": evCount(i),
            ...Object.fromEntries(EVIDENCES.map((e) => [`شاهد: ${e.label}`, e.key === "partner" && !i.partnerName.trim() ? "لا شراكة" : yes(i.ev[e.key])])),
            "متأخرة عن أسبوعين": yes(lt.late), "رابط الشواهد": i.evidenceLink,
            "قرار الإدارة": i.decision === "counted" ? "محتسبة" : i.decision === "rejected" ? "غير محتسبة" : "لم يُتخذ", "صاحب القرار": i.decidedBy ?? "", "تاريخ القرار": i.decidedAt ? i.decidedAt.slice(0, 10) : "",
            "الالتزام /20": s.compliance, "التوثيق /17.5": s.docs, "الوصول /12.5": s.access, "درجة المبادرة /50": s.total, "ملاحظات": i.notes,
          }
        }),
        "المبادرات", "لا توجد مبادرات مسجّلة",
      )
      add(
        data.csrPartners.map((p) => ({
          "الجهة": p.name, "النوع": p.org, "الفرع": p.branch ? nameOf(p.branch) : "عامة", "المسار": p.track ? TRACKS[p.track].label : "",
          "المرحلة": PARTNER_STAGES.find((s) => s.key === p.stage)?.label ?? "", "التقييم /5": p.quality || "", "معتمدة": yes(p.approved), "التواصل": p.contact, "ملاحظات": p.note,
        })),
        "الشراكات", "لا توجد شراكات",
      )
      add(summary.map((t) => ({ "الملخص الإداري": t })), "الملخص", "")
      const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer
      await downloads.save({ filename: `csr-${CSR_YEAR.replace("/", "-")}-${todayIso()}.xlsx`, data: new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }) })
    } catch (e) {
      const code = (e as { code?: string })?.code
      toast.error(code && SAVE_ERROR[code] ? SAVE_ERROR[code] : "تعذّر إنشاء الملف")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <Panel className="overflow-hidden">
        <PanelHeader
          title="تقرير الفروع التفصيلي"
          hint={`العام الدراسي ${CSR_YEAR}. الأرقام من المبادرات المنفذة كما سُجّلت.`}
          actions={
            <button type="button" onClick={exportXlsx} disabled={busy || downloads === undefined} className={btn.outline}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />}
              تصدير Excel
            </button>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-[14px]">
            <thead>
              <tr className="border-b bg-muted/50 text-[13px] text-muted-foreground">
                {["الفرع", "مسجّلة", "منفذة", "محتسبة", "المستفيدون", "المتطوعون", "الساعات", "التكلفة (ريال)", "متأخرة بلا قرار", "الدرجة /100"].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2.5 text-start font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="num">
              {rows.map((r) => (
                <tr key={r.branch.slug} className="border-b">
                  <th scope="row" className="px-3 py-2 text-start font-bold">{r.branch.name}</th>
                  <td className="px-3 py-2">{fmt(r.registered)}</td>
                  <td className="px-3 py-2">{fmt(r.done)}</td>
                  <td className="px-3 py-2">{fmt(r.counted)}</td>
                  <td className="px-3 py-2">{fmt(r.ben)}</td>
                  <td className="px-3 py-2">{fmt(r.vol)}</td>
                  <td className="px-3 py-2">{fmt(r.hours)}</td>
                  <td className="px-3 py-2">{fmt(r.cost)}</td>
                  <td className={cn("px-3 py-2", r.late > 0 && "font-bold text-bad")}>{fmt(r.late)}</td>
                  <td className="px-3 py-2 font-extrabold">{fmt(r.score.total)}</td>
                </tr>
              ))}
              <tr className="bg-muted/40 font-bold">
                <th scope="row" className="px-3 py-2.5 text-start">الإجمالي</th>
                <td className="px-3 py-2.5">{fmt(sum((r) => r.registered))}</td>
                <td className="px-3 py-2.5">{fmt(sum((r) => r.done))}</td>
                <td className="px-3 py-2.5">{fmt(sum((r) => r.counted))}</td>
                <td className="px-3 py-2.5">{fmt(sum((r) => r.ben))}</td>
                <td className="px-3 py-2.5">{fmt(sum((r) => r.vol))}</td>
                <td className="px-3 py-2.5">{fmt(sum((r) => r.hours))}</td>
                <td className="px-3 py-2.5">{fmt(sum((r) => r.cost))}</td>
                <td className="px-3 py-2.5">{fmt(sum((r) => r.late))}</td>
                <td className="px-3 py-2.5">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel>
        <PanelHeader title="الملخص الإداري" hint="يُكتب آليًا من البيانات" actions={<CopyButton text={summary.join("\n")} label="نسخ الملخص" />} />
        <div className="space-y-2.5 px-5 py-4 text-[15px] leading-relaxed">
          {summary.map((p, k) => (
            <p key={k}>{p}</p>
          ))}
        </div>
      </Panel>
    </div>
  )
}

/* ------------------------------------------------------------ the guide, verbatim */
const clean = (s: string) => s.replace(/\*\*/g, "").replace(/\\([#+.\-*_])/g, "$1").trim()

type GBlock = { t: "h1" | "h2" | "p"; text: string } | { t: "table"; rows: string[][] }
function parseGuide(md: string): GBlock[] {
  const lines = md.split("\n")
  const out: GBlock[] = []
  for (let k = 0; k < lines.length; k++) {
    const l = lines[k].trim()
    if (!l) continue
    if (l.startsWith("|")) {
      const rows: string[][] = []
      while (k < lines.length && lines[k].trim().startsWith("|")) {
        const cells = lines[k].trim().replace(/^\||\|$/g, "").split("|").map(clean)
        if (!cells.every((c) => /^:?-+:?$/.test(c))) rows.push(cells)
        k++
      }
      k--
      out.push({ t: "table", rows })
    } else if (l.startsWith("## ")) out.push({ t: "h2", text: clean(l.slice(3)) })
    else if (l.startsWith("# ")) out.push({ t: "h1", text: clean(l.slice(2)) })
    else out.push({ t: "p", text: clean(l) })
  }
  return out
}

function GuideTab() {
  const blocks = useMemo(() => parseGuide(CSR_GUIDE_MD), [])
  // the first line is the guide's own title, already the page title
  const rest = blocks[0]?.t === "p" && blocks[0].text.startsWith("دليل") ? blocks.slice(1) : blocks
  return (
    <Panel className="mx-auto max-w-[900px] px-5 py-4 sm:px-8 sm:py-6">
      <div className="mb-2 flex items-center gap-2 text-[13px] text-muted-foreground">
        <HandHeart className="h-4 w-4 text-gold" aria-hidden="true" />
        نص الدليل كما اعتمدته إدارة التواصل المؤسسي.
      </div>
      {rest.map((b, k) => {
        if (b.t === "table") {
          const [head, ...body] = b.rows
          return (
            <div key={k} className="my-3 overflow-x-auto rounded-xl border">
              <table className="w-full border-collapse text-[14px]">
                <thead>
                  <tr>
                    {head.map((c, j) => (
                      <th key={j} scope="col" className="border-b bg-muted px-3 py-2 text-start font-bold">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {body.map((r, j) => (
                    <tr key={j} className="border-b last:border-b-0">
                      {r.map((c, m) => (
                        <td key={m} className={cn("px-3 py-2 align-top", m === 0 && "font-medium")}>{c}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
        if (b.t === "h1") return <h2 key={k} className="mb-2 mt-8 border-b pb-2 text-[22px] font-extrabold text-primary first:mt-2">{b.text}</h2>
        if (b.t === "h2") return <h3 key={k} className="mb-1.5 mt-5 text-[18px] font-bold">{b.text}</h3>
        return <p key={k} className="my-2 text-[15px] leading-relaxed">{b.text}</p>
      })}
      {rest.length === 0 && <EmptyState title="الدليل غير متاح" />}
    </Panel>
  )
}
