/**
 * «السنترال · الفروع» as A4 pages, in the layout of the officers report: the month's
 * summary and branch ranking, the branch table and follow-up list, then every
 * branch's extensions, and last the extensions the directory lacks and head office.
 */
import type { ReactNode } from "react"
import type { PbxBranchReport, PbxDirectory, PbxOfficer } from "@/data/types"
import { monthLabel } from "@/data/social"
import { countLabel, formatDate, formatNumber } from "@/lib/format"
import { gradeOf, lastDayOf, pct, rate } from "@/lib/pbx"
import { FOLLOW_MIN, branchView, type BranchGroup, type ExtRow, type Totals } from "@/lib/pbxBranches"
import { BAR, CHIP, H, Kpi, Legend, Ltr, Page, chunk } from "./pbx"

const OFF = "#3b3bb0"
const OTH = "#0099db"
/** table rows a page holds (a branch heading counts as two) */
const CAP = 40
const FOLLOW_FIRST = 16
const FOLLOW_NEXT = 34

export const pbxBranchesTitle = (r: PbxBranchReport) => `تقرير استجابة الفروع للتحويلات المركزية – ${monthLabel(r.month)}`

const calls = (n: number) => (n === 0 ? "لا مكالمات" : countLabel(n, "مكالمة واحدة", "مكالمتان", "مكالمات", "مكالمة"))
const exts = (n: number) => countLabel(n, "تحويلة واحدة", "تحويلتان", "تحويلات", "تحويلة")
const branchesWord = (n: number) => countLabel(n, "فرع واحد", "فرعين", "فروع", "فرعًا")

function Chip({ t }: { t: Pick<Totals, "attempts" | "answered"> }) {
  const r = rate(t)
  if (r === null) return <span className="text-[11px] text-muted-foreground">—</span>
  const c = CHIP[gradeOf(t)]
  return (
    <span className="num inline-block min-w-[52px] rounded-full px-2 py-px text-center text-[10.5px] font-bold" style={{ background: c.bg, color: c.fg }}>
      <Ltr>{pct(r)}</Ltr>
    </span>
  )
}

const th = "border-b-2 border-primary bg-secondary/60 px-2 py-1.5 text-[10.5px] font-bold leading-[1.3] text-foreground whitespace-nowrap"
const td = "border-b px-2 py-[4px] text-[11px] leading-[1.3] align-middle whitespace-nowrap overflow-hidden text-ellipsis"
const person = (r: ExtRow) => (!r.inDir && !r.officer ? "غير موجود في الدليل" : r.name ?? "بلا اسم في الدليل")
const titleOf = (r: ExtRow) => r.title ?? (!r.inDir && r.label ? `في السنترال: ${r.label}` : "")

function Bars({ list }: { list: BranchGroup[] }) {
  return (
    <div className="flex flex-col">
      {list.map((b) => {
        const r = rate(b), g = gradeOf(b)
        return (
          <div key={b.name} className="grid items-center gap-3 border-b border-dashed border-border/70 py-[3px] leading-tight" style={{ gridTemplateColumns: "200px 1fr 62px 66px" }}>
            <div className="min-w-0 truncate text-[12px] leading-tight">
              <b>{b.name}</b> <span className="text-[10px] text-muted-foreground">· {b.attempts ? `${calls(b.attempts)} · ${exts(b.exts)}` : "لا تحويلات"}</span>
            </div>
            <div className="h-[11px] overflow-hidden rounded-full" style={{ background: "#efeff3" }}>
              {r !== null && <div className="h-full rounded-full" style={{ width: `${Math.max(r, 1.5)}%`, background: BAR[g] }} />}
            </div>
            <div className="text-center">{b.attempts ? <Chip t={b} /> : <span className="text-[11px] text-muted-foreground">—</span>}</div>
            <div className="num whitespace-nowrap text-[11px] text-muted-foreground">{b.attempts ? `${formatNumber(b.answered)} من ${formatNumber(b.attempts)}` : "لا تحويلات"}</div>
          </div>
        )
      })}
    </div>
  )
}

function Who({ off, oth, total }: { off: Totals; oth: Totals; total: Totals }) {
  if (!total.attempts) return null
  const po = Math.round((off.attempts / total.attempts) * 100), pt = 100 - po
  const fig = (label: string, t: Totals, color?: string) => (
    <div>
      <div className="text-[11px] leading-tight text-muted-foreground">{label}</div>
      <div className="num mt-0.5 text-[20px] font-extrabold leading-tight" style={color ? { color } : undefined}><Ltr>{pct(rate(t))}</Ltr></div>
      <div className="num text-[10.5px] text-muted-foreground">{formatNumber(t.answered)} من {formatNumber(t.attempts)}</div>
    </div>
  )
  return (
    <div className="mb-4 grid items-center gap-3.5 rounded-lg border px-3.5 py-2.5" style={{ gridTemplateColumns: "1fr 170px 170px" }}>
      <div>
        <div className="flex h-4 gap-0.5 overflow-hidden rounded-md">
          {po > 0 && <span className="h-full" style={{ width: `${po}%`, background: OFF }} />}
          {pt > 0 && <span className="h-full" style={{ width: `${pt}%`, background: OTH }} />}
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
          <span><span className="me-1 inline-block h-2.5 w-2.5 rounded-sm align-[-1px]" style={{ background: OFF }} />مسؤولو التواصل · {po}%</span>
          <span><span className="me-1 inline-block h-2.5 w-2.5 rounded-sm align-[-1px]" style={{ background: OTH }} />بقية الموظفين · {pt}%</span>
        </div>
      </div>
      {fig("الرد عند مسؤولي التواصل", off)}
      {fig("الرد عند بقية الموظفين", oth, gradeOf(oth) === "weak" ? BAR.weak : undefined)}
    </div>
  )
}

type Item = { kind: "head"; b: BranchGroup; cont: boolean } | { kind: "row"; r: ExtRow; section: string }
function pack(list: BranchGroup[]): Item[][] {
  const pages: Item[][] = [[]]
  let used = 0
  const push = (it: Item, w: number) => (pages[pages.length - 1].push(it), (used += w))
  const fresh = () => (pages.push([]), (used = 0))
  for (const b of list) {
    const rows = b.sections.flatMap((s) => s.rows.map((r) => ({ r, section: s.label })))
    if (used > 0 && used + 2 + Math.min(3, rows.length) > CAP) fresh()
    push({ kind: "head", b, cont: false }, 2)
    for (const x of rows) {
      if (used + 1 > CAP) (fresh(), push({ kind: "head", b, cont: true }, 2))
      push({ kind: "row", ...x }, 1)
    }
  }
  return pages[0].length ? pages : []
}

function ExtTable({ items }: { items: Item[] }) {
  return (
    <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
      <colgroup>
        <col style={{ width: 54 }} />
        <col style={{ width: 160 }} />
        <col style={{ width: 162 }} />
        <col style={{ width: 112 }} />
        <col style={{ width: 50 }} />
        <col style={{ width: 36 }} />
        <col style={{ width: 44 }} />
        <col style={{ width: 80 }} />
      </colgroup>
      <thead>
        <tr>
          {["التحويلة", "الاسم", "المسمى الوظيفي", "القسم", "المكالمات", "رد", "لم يُرد", "نسبة الرد"].map((c, k) => (
            <th key={c} className={th} style={{ textAlign: k < 4 ? "start" : "center" }}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.map((it, i) =>
          it.kind === "head" ? (
            <tr key={`h${i}`} style={{ background: "#ececf6" }}>
              <td className={`${td} font-extrabold`} colSpan={4} style={{ fontSize: 11.5 }}>
                {it.b.name}
                {it.cont ? " (تابع)" : <span className="font-normal text-muted-foreground"> · {calls(it.b.attempts)} · {exts(it.b.exts)}</span>}
              </td>
              <td className={`${td} num text-center font-bold`}>{formatNumber(it.b.attempts)}</td>
              <td className={`${td} num text-center font-bold`}>{formatNumber(it.b.answered)}</td>
              <td className={`${td} num text-center font-bold`}>{formatNumber(it.b.unanswered)}</td>
              <td className={`${td} text-center`}><Chip t={it.b} /></td>
            </tr>
          ) : (
            <tr key={it.r.ext} style={it.r.officer ? { background: "#f8f1dc" } : undefined}>
              <td className={`${td} num font-bold text-muted-foreground`}>{it.r.ext}</td>
              <td className={`${td} font-bold`}>{person(it.r)}</td>
              <td className={`${td} text-muted-foreground`}>{titleOf(it.r)}</td>
              <td className={td}>{it.section}</td>
              <td className={`${td} num text-center`}>{formatNumber(it.r.attempts)}</td>
              <td className={`${td} num text-center`}>{formatNumber(it.r.answered)}</td>
              <td className={`${td} num text-center`}>{formatNumber(it.r.unanswered)}</td>
              <td className={`${td} text-center`}><Chip t={it.r} /></td>
            </tr>
          ),
        )}
      </tbody>
    </table>
  )
}

export function pbxBranchPages(report: PbxBranchReport, directory: PbxDirectory | null, officers: PbxOfficer[], generatedAt = new Date()): ReactNode[] {
  const v = branchView(report, directory, officers)
  const t = v.total
  const partial = report.from && report.to && (report.from > `${report.month}-01` || report.to < lastDayOf(report.month))
  const withCalls = v.branches.filter((b) => b.attempts > 0)
  const follow = v.follow.length <= FOLLOW_FIRST ? [v.follow] : [v.follow.slice(0, FOLLOW_FIRST), ...chunk(v.follow.slice(FOLLOW_FIRST), FOLLOW_NEXT)]
  const extPages = pack(withCalls)
  const bodies: ((n: number, total: number) => ReactNode)[] = []

  // 1 · the month and the ranking
  bodies.push((n, total) => (
    <Page key="sum" n={n} total={total} generatedAt={generatedAt} first={{ title: "تقرير استجابة الفروع للتحويلات المركزية", sub: `${monthLabel(report.month)} · كل تحويلات الفروع` }}>
      <p className="mb-3 text-[11.5px] leading-snug text-muted-foreground">
        المكالمات المحوّلة من الخط الموحد إلى كل تحويلات الفروع، من تقرير 3CX{partial ? ` (من ${formatDate(report.from!)} إلى ${formatDate(report.to!)} فقط)` : ""}. أرقام المتصلين لا تُقرأ ولا تُحفظ.
      </p>
      <div className="mb-4 grid grid-cols-4 gap-2.5">
        <Kpi label="نسبة الرد في الفروع" value={pct(rate(t))} sub={`رد على ${formatNumber(t.answered)} من ${formatNumber(t.attempts)}`} />
        <Kpi label="المكالمات المحوّلة" value={formatNumber(t.attempts)} sub={`إلى ${exts(t.exts)} في ${branchesWord(t.branches)}`} />
        <Kpi label="لم يُرد عليها" value={formatNumber(t.unanswered)} sub={`منها ${formatNumber(t.voicemail)} في البريد الصوتي`} />
        <Kpi label="سرعة الرد" value={t.ringMedian === null ? "—" : `${formatNumber(Math.round(t.ringMedian))} ث`} sub={t.ringMedian === null ? "لا يحمل الملف مدة الرنين" : "نصف المُجابة رُد عليها خلال هذه المدة أو أقل"} />
      </div>
      <H>من استقبل المكالمات المحوّلة؟</H>
      <Who off={v.off} oth={v.oth} total={t} />
      <H sub="كل التحويلات داخل الفرع، من الأعلى استجابة إلى الأدنى.">ترتيب الفروع حسب نسبة الرد</H>
      <Legend />
      <Bars list={v.branches} />
      {v.hq && (
        <p className="mt-2 rounded-lg px-3 py-1.5 text-[11.5px] leading-snug" style={{ background: "#fdf3dc" }}>
          <b>الإدارة العامة</b> (خارج ترتيب الفروع): رد على {formatNumber(v.hq.answered)} من {formatNumber(v.hq.attempts)} · <Ltr>{pct(rate(v.hq))}</Ltr>. تفاصيلها في الصفحة الأخيرة.
        </p>
      )}
    </Page>
  ))

  // 2 · the branch table, then the follow-up list
  follow.forEach((part, i) =>
    bodies.push((n, total) => (
      <Page key={`f${i}`} n={n} total={total} generatedAt={generatedAt}>
        {i === 0 && (
          <>
            <H sub="المكالمات = رد + لم يُرد على كل تحويلات الفرع. «Waiting» مستبعدة. البريد الصوتي جزء من «لم يُرد».">تفاصيل الفروع</H>
            <table className="mb-5 w-full border-collapse">
              <thead>
                <tr>
                  {["الفرع", "المكالمات", "رد", "لم يُرد", "بريد صوتي", "نسبة الرد", "التحويلات", "مسؤول التواصل", "بقية الموظفين"].map((c, k) => (
                    <th key={c} className={th} style={{ textAlign: k === 0 ? "start" : "center" }}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {v.branches.map((b) =>
                  b.attempts ? (
                    <tr key={b.name}>
                      <td className={`${td} font-bold`}>{b.name}</td>
                      <td className={`${td} num text-center`}>{formatNumber(b.attempts)}</td>
                      <td className={`${td} num text-center`}>{formatNumber(b.answered)}</td>
                      <td className={`${td} num text-center`}>{formatNumber(b.unanswered)}</td>
                      <td className={`${td} num text-center`}>{formatNumber(b.voicemail)}</td>
                      <td className={`${td} text-center`}><Chip t={b} /></td>
                      <td className={`${td} num text-center`}>{formatNumber(b.exts)}</td>
                      <td className={`${td} num text-center`}>{b.off.attempts ? `${formatNumber(b.off.answered)} من ${formatNumber(b.off.attempts)}` : "—"}</td>
                      <td className={`${td} num text-center`}>{b.oth.attempts ? `${formatNumber(b.oth.answered)} من ${formatNumber(b.oth.attempts)}` : "—"}</td>
                    </tr>
                  ) : (
                    <tr key={b.name}>
                      <td className={`${td} font-bold`}>{b.name}</td>
                      <td className={`${td} text-muted-foreground`} colSpan={8}>لم تُحوَّل للفرع مكالمات</td>
                    </tr>
                  ),
                )}
                <tr>
                  <td className={`${td} font-extrabold`} style={{ borderTop: "2px solid hsl(var(--border))" }}>كل الفروع</td>
                  <td className={`${td} num text-center font-extrabold`}>{formatNumber(t.attempts)}</td>
                  <td className={`${td} num text-center font-extrabold`}>{formatNumber(t.answered)}</td>
                  <td className={`${td} num text-center font-extrabold`}>{formatNumber(t.unanswered)}</td>
                  <td className={`${td} num text-center font-extrabold`}>{formatNumber(t.voicemail)}</td>
                  <td className={`${td} text-center`}><Chip t={t} /></td>
                  <td className={`${td} num text-center font-extrabold`}>{formatNumber(t.exts)}</td>
                  <td className={`${td} num text-center font-extrabold`}>{formatNumber(v.off.answered)} من {formatNumber(v.off.attempts)}</td>
                  <td className={`${td} num text-center font-extrabold`}>{formatNumber(v.oth.answered)} من {formatNumber(v.oth.attempts)}</td>
                </tr>
              </tbody>
            </table>
          </>
        )}
        {part.length > 0 && (
          <>
            <H sub={i === 0 ? `التحويلات التي لم يُرد فيها على ${FOLLOW_MIN} مكالمات أو أكثر خلال الشهر، مرتبة من الأكثر.` : undefined}>تحويلات تحتاج متابعة{i > 0 ? " (تابع)" : ""}</H>
            <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: 52 }} />
                <col style={{ width: 150 }} />
                <col style={{ width: 172 }} />
                <col style={{ width: 150 }} />
                <col style={{ width: 54 }} />
                <col style={{ width: 44 }} />
                <col style={{ width: 76 }} />
              </colgroup>
              <thead>
                <tr>
                  {["التحويلة", "الاسم", "المسمى الوظيفي", "الفرع · القسم", "المكالمات", "لم يُرد", "نسبة الرد"].map((c, k) => (
                    <th key={c} className={th} style={{ textAlign: k < 4 ? "start" : "center" }}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {part.map((r) => (
                  <tr key={r.ext}>
                    <td className={`${td} num font-bold text-muted-foreground`}>{r.ext}</td>
                    <td className={`${td} font-bold`}>{person(r)}</td>
                    <td className={`${td} text-muted-foreground`}>{titleOf(r)}</td>
                    <td className={td}>{r.place.branch} · {r.place.section}</td>
                    <td className={`${td} num text-center`}>{formatNumber(r.attempts)}</td>
                    <td className={`${td} num text-center font-bold`}>{formatNumber(r.unanswered)}</td>
                    <td className={`${td} text-center`}><Chip t={r} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Page>
    )),
  )

  // 3 · every branch's extensions
  extPages.forEach((items, i) =>
    bodies.push((n, total) => (
      <Page key={`e${i}`} n={n} total={total} generatedAt={generatedAt}>
        <H sub={i === 0 ? "كل تحويلة وصلتها مكالمات، بالاسم والمسمى من دليل التحويلات. الفروع بترتيب نسبة الرد، وتحويلات مسؤولي التواصل مظللة." : undefined}>
          تحويلات كل فرع{i > 0 ? " (تابع)" : ""}
        </H>
        <ExtTable items={items} />
      </Page>
    )),
  )

  // 4 · what the directory lacks, and head office
  const missing = directory ? v.notInDir : []
  if (missing.length || v.hq)
    bodies.push((n, total) => (
      <Page key="last" n={n} total={total} generatedAt={generatedAt}>
        {missing.length > 0 && (
          <div className="mb-5">
            <H sub="نُسبت لفرعها من نطاق الرقم، وتحتاج إضافة اسمها في دليل التحويلات.">تحويلات ليست في دليل التحويلات</H>
            <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: 56 }} />
                <col style={{ width: 230 }} />
                <col style={{ width: 300 }} />
                <col style={{ width: 112 }} />
              </colgroup>
              <thead>
                <tr>
                  {["التحويلة", "الفرع · القسم", "الاسم في السنترال", "المكالمات"].map((c, k) => (
                    <th key={c} className={th} style={{ textAlign: k < 3 ? "start" : "center" }}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {missing.slice(0, 22).map((r) => (
                  <tr key={r.ext}>
                    <td className={`${td} num font-bold text-muted-foreground`}>{r.ext}</td>
                    <td className={td}>{r.place.branch} · {r.place.section}</td>
                    <td className={td}>{r.label ? <Ltr>{r.label}</Ltr> : "—"}{r.officer && r.name ? ` · ${r.name} (مسؤول التواصل)` : ""}</td>
                    <td className={`${td} num text-center`}>{formatNumber(r.attempts)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {missing.length > 22 && <p className="mt-1.5 text-[11px] text-muted-foreground">و{formatNumber(missing.length - 22)} أخرى في المنصة.</p>}
          </div>
        )}
        {v.hq && (
          <div>
            <H sub="تُعرض منفصلة ولا تدخل ترتيب الفروع.">الإدارة العامة</H>
            <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: 56 }} />
                <col style={{ width: 190 }} />
                <col style={{ width: 200 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 52 }} />
                <col style={{ width: 80 }} />
              </colgroup>
              <thead>
                <tr>
                  {["التحويلة", "الاسم", "المسمى الوظيفي", "الإدارة", "المكالمات", "نسبة الرد"].map((c, k) => (
                    <th key={c} className={th} style={{ textAlign: k < 4 ? "start" : "center" }}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...v.hq.rows].sort((a, b) => b.attempts - a.attempts).slice(0, 18).map((r) => (
                  <tr key={r.ext}>
                    <td className={`${td} num font-bold text-muted-foreground`}>{r.ext}</td>
                    <td className={`${td} font-bold`}>{r.name ?? "بلا اسم في الدليل"}</td>
                    <td className={`${td} text-muted-foreground`}>{r.title ?? ""}</td>
                    <td className={td}>{r.place.section}</td>
                    <td className={`${td} num text-center`}>{formatNumber(r.attempts)}</td>
                    <td className={`${td} text-center`}><Chip t={r} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
          خارج التقرير: الرد الآلي والطوابير وموظفو خدمة العملاء في الخط الموحد. الفرع والقسم من نطاق رقم التحويلة، والاسم والمسمى من دليل التحويلات.{report.waitingExcluded > 0 ? ` استُبعدت ${formatNumber(report.waitingExcluded)} مكالمة «Waiting».` : ""}
        </p>
      </Page>
    ))
  return bodies.map((b, i) => b(i + 1, bodies.length))
}
