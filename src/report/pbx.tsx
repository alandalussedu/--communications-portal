/**
 * The monthly «السنترال» report as A4 pages, laid out like the approved October
 * report: header band, three totals, a ranked bar per officer, the full table,
 * and the operational alerts. Rendered by the browser, then captured by pdf.ts.
 */
import type { ReactNode } from "react"
import { LOGO_NAVY } from "@/assets/logo"
import type { PbxLine, PbxReport } from "@/data/types"
import { monthLabel } from "@/data/social"
import { formatDate, formatNumber } from "@/lib/format"
import { SMALL_SAMPLE, gradeOf, lastDayOf, pct, ranked, rate, type Grade } from "@/lib/pbx"
import { PAGE_H, PAGE_W } from "./ReportPages"

const VOICEMAIL_ALERT = 3
const BAR: Record<Grade, string> = { good: "#1f7a3a", follow: "#b07800", weak: "#c0392b", small: "#bfbfbf", none: "transparent" }
const CHIP: Record<Grade, { bg: string; fg: string }> = {
  good: { bg: "#1f7a3a", fg: "#fff" },
  follow: { bg: "#b07800", fg: "#fff" },
  weak: { bg: "#c0392b", fg: "#fff" },
  small: { bg: "#e6e6e9", fg: "#55556a" },
  none: { bg: "transparent", fg: "#c0392b" },
}
const BARS_FIRST = 18
const BARS_NEXT = 26
const ROWS_PER_PAGE = 20

const chunk = <T,>(a: T[], n: number): T[][] => (a.length ? Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n)) : [[]])
const Ltr = ({ children }: { children: ReactNode }) => <bdi dir="ltr">{children}</bdi>

export const pbxTitle = (r: PbxReport) => `تقرير استجابة مسؤولي التواصل المؤسسي بالفروع للتحويلات المركزية – ${monthLabel(r.month)}`

function Page({ children, first, n, total, generatedAt }: { children: ReactNode; first?: { title: string }; n: number; total: number; generatedAt: Date }) {
  return (
    <div className="report-page relative flex flex-col overflow-hidden bg-white font-sans text-foreground" style={{ width: PAGE_W, height: PAGE_H }} dir="rtl" data-report-page>
      <div className="flex min-h-0 flex-1 flex-col px-12 pt-10">
        {first && (
          <div className="mb-5 overflow-hidden rounded-xl">
            <div className="flex items-center justify-between gap-6 bg-band px-7 py-5 text-band-foreground">
              <div className="min-w-0">
                <div className="text-[13px] text-band-soft">إدارة التواصل المؤسسي</div>
                <h1 className="mt-1 text-[22px] font-extrabold leading-snug">{first.title}</h1>
              </div>
              <span className="shrink-0 rounded-lg bg-white px-3 py-2">
                <img src={LOGO_NAVY} alt="شركة الأندلس التعليمية" style={{ height: 46, width: "auto" }} />
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
      <div className="flex items-center justify-between border-t px-12 py-3 text-[11px] text-muted-foreground">
        <span>
          <b className="text-foreground">شركة الأندلس التعليمية</b> · إدارة التواصل المؤسسي
        </span>
        <span className="num">صدر في {formatDate(generatedAt.toISOString())}</span>
        <span className="num font-bold text-primary">
          صفحة {formatNumber(n)} من {formatNumber(total)}
        </span>
      </div>
    </div>
  )
}

function H({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-3">
      <h2 className="border-s-4 border-sky ps-2.5 text-[18px] font-extrabold">{children}</h2>
      {sub && <p className="mt-1 text-[12px] text-muted-foreground">{sub}</p>}
    </div>
  )
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-t-4 border-t-primary px-4 py-2.5">
      <div className="text-[12px] text-muted-foreground">{label}</div>
      <div className="num mt-1 text-[26px] font-extrabold leading-none text-primary">{value}</div>
      <div className="mt-1.5 text-[11px] text-muted-foreground">{sub}</div>
    </div>
  )
}

function Chip({ l }: { l: PbxLine }) {
  const r = rate(l)
  if (r === null) return <span className="text-[11px] font-bold" style={{ color: CHIP.none.fg }}>لا يوجد</span>
  const c = CHIP[gradeOf(l)]
  return (
    <span className="num inline-block min-w-[52px] rounded-full px-2 py-px text-center text-[10.5px] font-bold" style={{ background: c.bg, color: c.fg }}>
      <Ltr>{pct(r)}</Ltr>
    </span>
  )
}

function Legend() {
  const item = (color: string, label: string) => (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  )
  return (
    <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
      {item(BAR.good, "جيدة: 70% أو أكثر")}
      {item(BAR.follow, "تحتاج متابعة")}
      {item(BAR.weak, "ضعيفة: أقل من 50%")}
      {item(BAR.small, `عيّنة أصغر من ${SMALL_SAMPLE} محاولات، لا تصلح للمقارنة`)}
    </div>
  )
}

function Bars({ lines }: { lines: PbxLine[] }) {
  return (
    <div className="flex flex-col">
      {lines.map((l) => {
        const r = rate(l), g = gradeOf(l)
        return (
          <div key={l.officer} className="grid items-center gap-3 border-b border-dashed border-border/70 py-[4px]" style={{ gridTemplateColumns: "170px 1fr 62px 62px" }}>
            <div className="min-w-0">
              <div className="truncate text-[12.5px] font-bold leading-tight">{l.name}</div>
              <div className="truncate text-[10px] leading-tight text-muted-foreground">{l.branch} · {l.school}</div>
            </div>
            <div className="h-[11px] overflow-hidden rounded-full" style={{ background: "#efeff3" }}>
              {r !== null && <div className="h-full rounded-full" style={{ width: `${Math.max(r, 1.5)}%`, background: BAR[g], marginInlineStart: 0 }} />}
            </div>
            <div className="text-center"><Chip l={l} /></div>
            <div className="num text-[11px] text-muted-foreground">{r === null ? (l.exts.length ? "لا اتصالات" : "بلا تحويلة") : `${formatNumber(l.answered)} من ${formatNumber(l.attempts)}`}</div>
          </div>
        )
      })}
    </div>
  )
}

const th = "border-b-2 border-primary bg-secondary/60 px-2 py-1.5 text-[11px] font-bold text-foreground"
const td = "border-b px-2 py-[5px] text-[11px] align-middle"

function Table({ lines, prev }: { lines: PbxLine[]; prev: PbxReport | null }) {
  const cols = ["مسؤول التواصل", "الفرع", "المدرسة / القسم", "المحاولات", "رد", "لم يُرد", "نسبة الاستجابة", "بريد صوتي", ...(prev ? ["عن الشهر السابق"] : [])]
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          {cols.map((c, k) => (
            <th key={c} className={th} style={{ textAlign: k < 3 ? "start" : "center" }}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {lines.map((l) => {
          const p = prev?.lines.find((x) => x.officer === l.officer)
          const r = rate(l), pr = p ? rate(p) : null
          const d = r !== null && pr !== null ? r - pr : null
          return (
            <tr key={l.officer}>
              <td className={`${td} font-bold`}>{l.name}</td>
              <td className={td}>{l.branch}</td>
              <td className={td}>{l.school}</td>
              <td className={`${td} num text-center`}>{formatNumber(l.attempts)}</td>
              <td className={`${td} num text-center`}>{formatNumber(l.answered)}</td>
              <td className={`${td} num text-center`}>{formatNumber(l.unanswered)}</td>
              <td className={`${td} text-center`}>{r === null ? <span className="text-muted-foreground">—</span> : <Chip l={l} />}</td>
              <td className={`${td} num text-center`}>{formatNumber(l.voicemail)}</td>
              {prev && (
                <td className={`${td} num text-center font-bold`} style={{ color: d === null || d === 0 ? "#8a8a99" : d > 0 ? "#1f7a3a" : "#c0392b" }}>
                  <Ltr>{d === null ? "—" : `${d > 0 ? "+" : ""}${d.toFixed(1)}`}</Ltr>
                </td>
              )}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function Alerts({ lines }: { lines: PbxLine[] }) {
  const weak = lines.filter((l) => gradeOf(l) === "weak")
  const vm = lines.filter((l) => l.voicemail >= VOICEMAIL_ALERT).sort((a, b) => b.voicemail - a.voicemail)
  if (!weak.length && !vm.length) return null
  const sep = <span className="mx-1 text-muted-foreground">·</span>
  return (
    <div className="mt-5">
      <H>تنبيهات تشغيلية</H>
      {weak.length > 0 && (
        <div className="mb-3 border-s-4 ps-3" style={{ borderColor: BAR.weak }}>
          <div className="text-[14px] font-bold">الأضعف في الاستجابة</div>
          <p className="mt-1 text-[11.5px] leading-[1.8]">
            مسؤولو تواصل لديهم حجم محاولات كافٍ ونسبة استجابتهم أقل من النصف:{" "}
            {weak.map((l, i) => (
              <span key={l.officer}>
                {i > 0 && sep}
                <b>{l.name}</b> — {l.branch} {l.school} — <b><Ltr>{pct(rate(l))}</Ltr></b> — رد على {formatNumber(l.answered)} من {formatNumber(l.attempts)}
              </span>
            ))}
          </p>
        </div>
      )}
      {vm.length > 0 && (
        <div className="border-s-4 ps-3" style={{ borderColor: BAR.follow }}>
          <div className="text-[14px] font-bold">تسرّب المكالمات إلى البريد الصوتي</div>
          <p className="mt-1 text-[11.5px] leading-[1.8]">
            مكالمات انتهت في البريد الصوتي بدل أن تصل إلى الموظف، وولي الأمر هنا انتظر ثم تُرك لرسالة مسجّلة:{" "}
            {vm.map((l, i) => (
              <span key={l.officer}>
                {i > 0 && sep}
                <b>{l.name}</b> — {l.branch} {l.school} — <b>{formatNumber(l.voicemail)}</b> من {formatNumber(l.attempts)} محاولة، أي <Ltr>{pct((l.voicemail / l.attempts) * 100)}</Ltr>
              </span>
            ))}
          </p>
        </div>
      )}
    </div>
  )
}

export function pbxPages(report: PbxReport, prev: PbxReport | null, generatedAt = new Date()): ReactNode[] {
  const lines = ranked(report.lines)
  const t = lines.reduce((a, l) => ({ attempts: a.attempts + l.attempts, answered: a.answered + l.answered, unanswered: a.unanswered + l.unanswered, voicemail: a.voicemail + l.voicemail }), { attempts: 0, answered: 0, unanswered: 0, voicemail: 0 })
  const branches = new Set(lines.map((l) => l.branch)).size
  const partial = report.from && report.to && (report.from > `${report.month}-01` || report.to < lastDayOf(report.month))
  const bars = lines.length <= BARS_FIRST ? [lines] : [lines.slice(0, BARS_FIRST), ...chunk(lines.slice(BARS_FIRST), BARS_NEXT)]
  const rows = chunk(lines, ROWS_PER_PAGE)
  const bodies: ((n: number, total: number) => ReactNode)[] = []

  bars.forEach((part, i) =>
    bodies.push((n, total) => (
      <Page key={`b${i}`} n={n} total={total} generatedAt={generatedAt} first={i === 0 ? { title: pbxTitle(report) } : undefined}>
        {i === 0 && (
          <>
            <div className="mb-4 grid grid-cols-3 gap-3">
              <Kpi label="نسبة الاستجابة العامة" value={pct(rate(t))} sub="المكالمات المُجابة من إجمالي المحاولات" />
              <Kpi label="محاولات الاتصال" value={formatNumber(t.attempts)} sub={`على ${formatNumber(lines.length)} مسؤول تواصل في ${formatNumber(branches)} فرعًا`} />
              <Kpi label="مكالمات لم يُرد عليها" value={formatNumber(t.unanswered)} sub={`منها ${formatNumber(t.voicemail)} تحوّلت إلى البريد الصوتي`} />
            </div>
            {partial && (
              <p className="mb-4 rounded-md bg-sky-soft px-3 py-2 text-[11.5px] text-sky-ink">
                يغطي هذا التقرير المكالمات من {formatDate(report.from!)} إلى {formatDate(report.to!)} فقط، لا الشهر كاملًا.
              </p>
            )}
          </>
        )}
        <H sub={i === 0 ? "مرتبون من الأعلى استجابةً إلى الأدنى. كل شخص يُقاس على تحويلته الخاصة." : undefined}>
          تقييم كل مسؤول تواصل على تحويلته{i > 0 ? " (تابع)" : ""}
        </H>
        {i === 0 && <Legend />}
        <Bars lines={part} />
      </Page>
    )),
  )
  rows.forEach((part, i) =>
    bodies.push((n, total) => (
      <Page key={`t${i}`} n={n} total={total} generatedAt={generatedAt}>
        <H sub={i === 0 && prev ? `عمود «عن الشهر السابق» هو الفرق في نسبة الاستجابة عن ${monthLabel(prev.month)} بالنقاط.` : undefined}>
          التفاصيل الكاملة لكل مسؤول{i > 0 ? " (تابع)" : ""}
        </H>
        <Table lines={part} prev={prev} />
        {i === rows.length - 1 && <Alerts lines={lines} />}
        {i === rows.length - 1 && report.waitingExcluded > 0 && (
          <p className="mt-4 text-[11px] text-muted-foreground">استُبعدت {formatNumber(report.waitingExcluded)} مكالمة كانت لا تزال ترن («Waiting») وقت سحب التقرير.</p>
        )}
      </Page>
    )),
  )
  return bodies.map((b, i) => b(i + 1, bodies.length))
}
