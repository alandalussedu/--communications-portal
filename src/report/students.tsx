/**
 * «أعداد الطلاب» as A4 pages: header band, the six indicators, occupancy per
 * branch, then the full table, the two breakdowns and the file's notes.
 * Rendered by the browser, then captured by pdf.ts (owner only).
 */
import type { ReactNode } from "react"
import { LOGO_NAVY } from "@/assets/logo"
import type { StudentCounts, StudentRow, StudentTarget } from "@/data/types"
import { formatDate, formatNumber } from "@/lib/format"
import { growthPreliminary, notesFor, occupancyStatus, pct, shortName, signedPct, targetSummary, withdrawalStatus, yearLabel, type Tone } from "@/lib/students"
import { PAGE_H, PAGE_W } from "./ReportPages"

const FILL: Record<Tone, string> = { ok: "#1f7a4d", sky: "#0a93d6", warn: "#9e5a00", bad: "#c0392b" }
const SOFT: Record<Tone, { bg: string; fg: string }> = {
  ok: { bg: "#e3f4ea", fg: "#1f7a4d" },
  sky: { bg: "#e4f4fc", fg: "#0a6b9e" },
  warn: { bg: "#fbefd9", fg: "#8a4f00" },
  bad: { bg: "#fbe6e4", fg: "#b03224" },
}
const Ltr = ({ children }: { children: ReactNode }) => <span dir="ltr" style={{ unicodeBidi: "isolate", display: "inline-block" }}>{children}</span>
const ALERT_RE = /ملاحظة|تصحيح|خارج|مبدئي|افتراض/

export const studentsTitle = (c: StudentCounts) => `مؤشرات أعداد الطلاب حسب الفرع – سحب ${formatDate(c.date)}`

function Page({ children, first, n, total, generatedAt }: { children: ReactNode; first?: { title: string; sub: string }; n: number; total: number; generatedAt: Date }) {
  return (
    <div className="report-page relative flex flex-col overflow-hidden bg-white font-sans text-foreground" style={{ width: PAGE_W, height: PAGE_H }} dir="rtl" data-report-page>
      <div className="flex min-h-0 flex-1 flex-col px-11 pt-9">
        {first && (
          <div className="mb-4 shrink-0 overflow-hidden rounded-xl">
            <div className="flex items-center justify-between gap-6 bg-band px-7 py-5 text-band-foreground">
              <div className="min-w-0">
                <div className="text-[13px] text-band-soft">إدارة التواصل المؤسسي · الأداء والتطوير</div>
                <h1 className="mt-1 text-[21px] font-extrabold leading-snug">{first.title}</h1>
                <div className="mt-1 text-[12px] text-band-soft">{first.sub}</div>
              </div>
              <span className="shrink-0 rounded-lg bg-white px-3 py-2">
                <img src={LOGO_NAVY} alt="شركة الأندلس التعليمية" style={{ height: 44, width: "auto" }} />
              </span>
            </div>
            <div className="flex h-1">
              <span className="flex-1" style={{ background: "#c4c4cc" }} />
              <span className="flex-1" style={{ background: "#b8962e" }} />
              <span className="flex-1" style={{ background: "#2a9fd6" }} />
            </div>
          </div>
        )}
        {children}
      </div>
      <div className="flex items-center justify-between border-t px-11 py-3 text-[11px] text-muted-foreground">
        <span>
          <b className="text-foreground">شركة الأندلس التعليمية</b> · سري · لمدير المنصة
        </span>
        <span className="num">صدر في {formatDate(generatedAt.toISOString())}</span>
        <span className="num font-bold text-primary">صفحة {formatNumber(n)} من {formatNumber(total)}</span>
      </div>
    </div>
  )
}

function H({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-2.5 mt-1">
      <h2 className="border-s-4 border-sky ps-2.5 text-[16px] font-extrabold">{children}</h2>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  )
}

function Kpi({ label, value, sub, chip }: { label: string; value: string; sub?: ReactNode; chip?: { tone: Tone; label: string } }) {
  return (
    <div className="rounded-lg border border-t-4 border-t-primary px-3 py-2">
      <div className="text-[11.5px] text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-center gap-1.5">
        <span className="num text-[22px] font-extrabold leading-none text-primary">{value}</span>
        {chip && <span className="rounded-full px-1.5 text-[10px] font-bold" style={{ background: SOFT[chip.tone].bg, color: SOFT[chip.tone].fg }}>{chip.label}</span>}
      </div>
      {sub && <div className="mt-1 text-[10.5px] text-muted-foreground">{sub}</div>}
    </div>
  )
}

const Tag = ({ tone, children }: { tone: Tone; children: ReactNode }) => (
  <span className="inline-block rounded-full px-1.5 text-[9.5px] font-bold" style={{ background: SOFT[tone].bg, color: SOFT[tone].fg }}>{children}</span>
)

function OccupancyBars({ c }: { c: StudentCounts }) {
  const list = [...c.branches].sort((a, b) => b.occupancy - a.occupancy)
  const maxCap = Math.max(...c.branches.map((b) => b.capacity), 1)
  return (
    <div className="flex flex-col">
      {list.map((b) => {
        const s = occupancyStatus(b.occupancy)
        return (
          <div key={b.name} className="grid items-center gap-3 border-b border-dashed border-border/70 py-[5px]" style={{ gridTemplateColumns: "92px 1fr 52px 110px" }}>
            <span className="truncate text-[12.5px] font-bold">{shortName(b.name)}{notesFor(c, b.name).length > 0 && <span style={{ color: SOFT.warn.fg }}> !</span>}</span>
            <span className="block h-[11px] overflow-hidden rounded-full" style={{ width: `${(b.capacity / maxCap) * 100}%`, background: "#efeff3" }}>
              <span className="block h-full rounded-full" style={{ width: `${Math.min(b.occupancy, 1) * 100}%`, background: FILL[s.tone] }} />
            </span>
            <b className="num text-[12px]">{pct(b.occupancy)}</b>
            <span className="num text-[10.5px] text-muted-foreground">{formatNumber(b.current)} من {formatNumber(b.capacity)}</span>
          </div>
        )
      })}
      <div className="mt-2 flex flex-wrap gap-x-4 text-[10.5px] text-muted-foreground">
        {([["ok", "مرتفع: 85% فأكثر"], ["sky", "جيد: من 70% إلى 85%"], ["warn", "منخفض: أقل من 70%"]] as [Tone, string][]).map(([t, l]) => (
          <span key={t} className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: FILL[t] }} />{l}</span>
        ))}
        <span>طول الشريط = الطاقة التشغيلية</span>
      </div>
    </div>
  )
}

function FullTable({ c }: { c: StudentCounts }) {
  const rows = [...c.branches].sort((a, b) => b.current - a.current)
  const cell = "px-2 py-[5px]"
  const line = (b: StudentRow, total?: boolean) => {
    const ws = withdrawalStatus(b.withdrawalRate), os = occupancyStatus(b.occupancy)
    return (
      <tr key={b.name} className={total ? "border-t-2 font-extrabold" : "border-b"}>
        <th className={`${cell} text-start font-bold`}>{total ? "الإجمالي" : shortName(b.name)}</th>
        <td className={`num ${cell}`}>{formatNumber(b.current)}</td>
        <td className={`num ${cell}`}>{formatNumber(b.newcomers)}</td>
        <td className={`num ${cell}`}>{formatNumber(b.withdrawn)}</td>
        <td className={`num ${cell}`}>{pct(b.withdrawalRate)} {!total && <Tag tone={ws.tone}>{ws.label}</Tag>}</td>
        <td className={`num ${cell}`}>{pct(b.occupancy)} {!total && <Tag tone={os.tone}>{os.label}</Tag>}</td>
        <td className={`num ${cell}`}>{formatNumber(b.capacity)}</td>
        <td className={`num ${cell}`} style={{ color: b.growth === null ? undefined : b.growth >= 0 ? FILL.ok : FILL.bad }}><Ltr>{signedPct(b.growth)}</Ltr></td>
      </tr>
    )
  }
  return (
    <table className="w-full text-[11.5px]">
      <thead>
        <tr className="border-b text-[10.5px] text-muted-foreground" style={{ background: "#f4f4f8" }}>
          {["الفرع", "الحاليون", "الجدد", "المنسحبون", "نسبة الانسحاب", "نسبة الإشغال", "الطاقة", growthPreliminary(c) ? "النمو (مبدئي)" : "النمو"].map((h) => (
            <th key={h} className="px-2 py-1.5 text-start font-bold">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>{rows.map((b) => line(b))}</tbody>
      <tfoot>{line(c.total, true)}</tfoot>
    </table>
  )
}

function Split({ title, names, rows, total }: { title: string; names: string[]; rows: { name: string; v: number[] }[]; total: number[] }) {
  if (!names.length) return null
  return (
    <div className="mb-3">
      <H>{title}</H>
      <table className="w-full text-[10.5px]">
        <thead>
          <tr className="border-b text-muted-foreground" style={{ background: "#f4f4f8" }}>
            <th className="px-1.5 py-1 text-start">الفرع</th>
            {names.map((n) => <th key={n} className="px-1.5 py-1 text-start">{n}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b">
              <th className="px-1.5 py-[3px] text-start font-bold">{shortName(r.name)}</th>
              {r.v.map((x, i) => <td key={i} className="num px-1.5 py-[3px]">{formatNumber(x)}</td>)}
            </tr>
          ))}
          <tr className="border-t-2 font-extrabold">
            <th className="px-1.5 py-[3px] text-start">الإجمالي</th>
            {total.map((x, i) => <td key={i} className="num px-1.5 py-[3px]">{formatNumber(x)}</td>)}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export function studentsPages(c: StudentCounts, target: StudentTarget | null = null, targetYear = ""): ReactNode[] {
  const ts = targetSummary(target, c)
  const generatedAt = new Date()
  const t = c.total
  const ws = withdrawalStatus(t.withdrawalRate), os = occupancyStatus(t.occupancy)
  const alerts = c.notes.filter((n) => ALERT_RE.test(n.title))
  const source = c.notes.find((n) => n.title === "المصدر")?.text
  const pages: ((n: number, total: number) => ReactNode)[] = [
    (n, total) => (
      <Page key="p1" n={n} total={total} generatedAt={generatedAt} first={{ title: studentsTitle(c), sub: `العام الدراسي ${c.year.replace("-", "/")} · ${formatNumber(c.branches.length)} فرعًا في تقرير النظام` }}>
        <div className="mb-4 grid grid-cols-3 gap-2.5">
          <Kpi label="الطلاب الحاليون" value={formatNumber(t.current)} sub={t.regular !== null ? `منتظم ${formatNumber(t.regular)} · مستجد ${formatNumber(t.newcomers)}` : undefined} />
          <Kpi label="الطلاب الجدد" value={formatNumber(t.newcomers)} sub={t.growth !== null ? <>نمو الحاليين <Ltr>{signedPct(t.growth)}</Ltr>{growthPreliminary(c) ? " (مبدئي)" : ""}</> : undefined} />
          <Kpi label="المنسحبون" value={formatNumber(t.withdrawn)} sub={t.transferred !== null ? `لا يشمل ${formatNumber(t.transferred)} محوّلًا إلى فرع آخر` : undefined} />
          <Kpi label="نسبة الانسحاب" value={pct(t.withdrawalRate)} chip={ws} sub="جيد حتى 8% · متابعة حتى 12% · مرتفع فوقها" />
          <Kpi label="نسبة الإشغال" value={pct(t.occupancy)} chip={os} sub="مرتفع من 85% · جيد من 70%" />
          <Kpi label="الطاقة التشغيلية" value={formatNumber(t.capacity)} sub={`${formatNumber(Math.max(t.capacity - t.current, 0))} مقعدًا متاحًا`} />
        </div>
        {ts.total > 0 && (
          <p className="-mt-1 mb-3 rounded-lg px-4 py-2 text-[12px]" style={{ background: "#fbf6e8" }}>
            <b>مستهدف العام القادم <Ltr>{yearLabel(targetYear)}</Ltr>:</b> <span className="num">{formatNumber(ts.total)}</span> طالبًا
            {ts.complete ? <> · الحاليون <span className="num">{pct(ts.current / ts.total)}</span> منه</> : <> · مُدخل لـ {formatNumber(ts.entered)} من {formatNumber(ts.of)} فرعًا</>}
          </p>
        )}
        <H sub="الحاليون مقابل الطاقة التشغيلية، مرتبة من الأعلى إشغالًا.">نسبة الإشغال لكل فرع</H>
        <OccupancyBars c={c} />
        {alerts.length > 0 && (
          <p className="mt-4 rounded-lg px-4 py-2.5 text-[11px] leading-5" style={{ background: "#fbf6e8" }}>
            <b>ملاحظات الملف:</b> {alerts.map((a) => a.title).join("، ")}. نصها كاملًا في صفحة التعريفات.
          </p>
        )}
      </Page>
    ),
    (n, total) => (
      <Page key="p2" n={n} total={total} generatedAt={generatedAt}>
        <H sub="مرتبة حسب عدد الطلاب الحاليين.">كل الفروع</H>
        <FullTable c={c} />
        <div className="mt-4" />
        <Split title="الطلاب الحاليون حسب المرحلة" names={c.stageNames} rows={c.branches.map((b) => ({ name: b.name, v: b.stages }))} total={t.stages} />
        {source && <p className="mt-auto pb-2 text-[10px] text-muted-foreground">المصدر: {source}</p>}
      </Page>
    ),
    (n, total) => (
      <Page key="p3" n={n} total={total} generatedAt={generatedAt}>
        <Split title="الطلاب الحاليون حسب نوع الدراسة" names={c.typeNames} rows={c.branches.map((b) => ({ name: b.name, v: b.types }))} total={t.types} />
        <H>التعريفات</H>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[10.5px] leading-[1.55]">
          {c.notes.map((x) => (
            <div key={x.title}>
              <dt className="font-bold">{x.title}</dt>
              <dd className="text-muted-foreground">{x.text}</dd>
            </div>
          ))}
        </dl>
      </Page>
    ),
  ]
  return pages.map((p, i) => p(i + 1, pages.length))
}
