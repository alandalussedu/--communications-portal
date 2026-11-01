/**
 * Remedial-plan reports: one branch, or several / all branches. Same A4 page box,
 * PDF writer and Excel conventions as the executive reports. Every number comes
 * from the same functions the screen uses.
 */
import type { ReactNode } from "react"
import * as XLSX from "xlsx"
import { LOGO_NAVY, LOGO_WHITE } from "@/assets/logo"
import type { Data } from "@/data/store"
import type { RemedialLogEntry, RemedialMonthly, RemedialRow, RemedialStage } from "@/data/types"
import { PLAN_LABEL, STATUS_LABEL, branchPlans, causes, countRows, needsDecision, rate, rateText, type BranchPlan, type Cause, type Counts } from "@/data/remedial"
import { formatDate, formatNumber, formatTime } from "@/lib/format"
import { PAGE_H, PAGE_W } from "./ReportPages"

export type RROptions = { branches: string[]; details: boolean; monthly: boolean }
export type RRModel = {
  kind: "branch" | "overall"
  title: string
  generatedAt: Date
  readAt: string | null
  opts: RROptions
  plans: BranchPlan[]
  totals: Counts
  causes: Cause[]
  repeated: Cause[]
  decisions: Cause[]
  lowest: BranchPlan[]
  log: RemedialLogEntry[]
  monthly: RemedialMonthly[]
  quality: string[]
  summary: string[]
}

const APPROVAL_NOTE = "الاعتماد: غير معتمد في الملف ما لم تُملأ خانة الاعتماد."
const SOURCE_NOTE = "الأرقام من ملفات الفروع بتاريخ القراءة. المنصة لا تعدّل الملفات، ولا تحسب تأخرًا من التواريخ، ولا تستنتج الاعتماد، ولا تعرض متوسطًا للشركة."
const dt = (iso: string | null | undefined) => (iso ? `${formatDate(iso)} · ${formatTime(new Date(iso))}` : "لم يُقرأ بعد")

export function buildRemedialReport(data: Data, opts: RROptions, now = new Date()): RRModel {
  const all = branchPlans(data)
  const plans = opts.branches.length ? all.filter((p) => opts.branches.includes(p.b.slug)) : all
  const kind: RRModel["kind"] = opts.branches.length === 1 ? "branch" : "overall"
  const slugs = new Set(plans.map((p) => p.b.slug))
  const rows = data.remedialRows.filter((r) => slugs.has(r.branch))
  const cs = causes(rows)
  const totals = countRows(rows)
  const reads = plans.map((p) => p.lastRead).filter(Boolean) as string[]
  const readAt = reads.sort().pop() ?? null
  const withRows = plans.filter((p) => p.counts.done + p.counts.notDone > 0)
  const lowest = [...withRows].sort((a, b) => (rate(a.counts) ?? 0) - (rate(b.counts) ?? 0) || b.counts.notDone - a.counts.notDone).slice(0, 5)
  const stages = plans.flatMap((p) => p.stages)
  const approved = stages.filter((s) => s.approval.filled).length
  const files = plans.flatMap((p) => p.files)
  const quality: string[] = []
  const empties = plans.flatMap((p) => p.emptyStages.map((s) => `${p.b.name}: ${s.name}`))
  if (empties.length) quality.push(`مراحل فارغة (${formatNumber(empties.length)}): ${empties.join("، ")}.`)
  if (totals.noPlan) quality.push(`${formatNumber(totals.noPlan)} صفًا فيها سبب أو مشكلة بلا إجراءات (بدون خطة)، ولا تدخل في نسبة التنفيذ.`)
  if (totals.noCheckbox) quality.push(`${formatNumber(totals.noCheckbox)} صفًا فيها محتوى بلا خانة تنفيذ، ولا تدخل في نسبة التنفيذ.`)
  const templateOnly = plans.filter((p) => p.files.length && p.stages.length === 0).map((p) => p.b.name)
  if (templateOnly.length) quality.push(`فروع لم يُعثر في ملفها على تبويب خطة معبّأ (قالب فارغ فقط): ${templateOnly.join("، ")}.`)
  const noFile = plans.filter((p) => !p.files.length).map((p) => p.b.name)
  if (noFile.length) quality.push(`فروع بلا ملف في سجل الروابط: ${noFile.join("، ")}.`)
  const failed = files.filter((f) => f.readStatus !== "success")
  if (failed.length) quality.push(`ملفات لم تُقرأ أو فشلت قراءتها: ${failed.map((f) => f.label ?? f.id).join("، ")}.`)
  quality.push(`خانة الاعتماد مكتوبة في ${formatNumber(approved)} من ${formatNumber(stages.length)} مرحلة؛ والبقية «غير معتمد في الملف».`)
  const excluded = files.reduce((n, f) => n + f.sheets.filter((s) => s.kind === "excluded").length, 0)
  if (excluded) quality.push(`${formatNumber(excluded)} تبويبًا لم يُعتبر خطة (أدلة تعبئة، قوالب فارغة، تبويبات أخرى) ولم يدخل في الحساب.`)
  const noBaseline = stages.filter((s) => !s.columns.some((c) => c.startsWith("خط الأساس"))).length
  if (noBaseline) quality.push(`${formatNumber(noBaseline)} مرحلة بلا عمود «خط الأساس» في الملف.`)
  const extras = Array.from(new Set(rows.flatMap((r) => Object.keys(r.extra))))
  if (extras.length) quality.push(`أعمدة إضافية محفوظة كما هي: ${extras.join("، ")}.`)
  const noCause = rows.filter((r) => !r.cause).length
  if (noCause) quality.push(`${formatNumber(noCause)} صفًا بلا سبب مكتوب (عمود «السبب» فارغ أو غير موجود)، فلا تظهر في الأسباب المتكررة.`)

  const summary: string[] = []
  if (kind === "branch") {
    const p = plans[0]
    summary.push(`نسبة التنفيذ ${rateText(p.counts)}: ${formatNumber(p.counts.done)} صفًا منفّذًا من ${formatNumber(p.counts.done + p.counts.notDone)} (منفّذ + غير منفّذ).`)
    summary.push(`بدون خطة ${formatNumber(p.counts.noPlan)} صفًا، وبدون خانة تنفيذ ${formatNumber(p.counts.noCheckbox)}، ولا يدخلان في النسبة.`)
    summary.push(`${formatNumber(p.stages.length)} مرحلة مقروءة، منها ${formatNumber(p.emptyStages.length)} فارغة. حالة الخطة من الصفوف: ${PLAN_LABEL[p.state]}.`)
    summary.push(p.lastChange ? `آخر تغيّر في التنفيذ: ${formatDate(p.lastChange)}.` : `لا تغيّر في التنفيذ مسجّل منذ أول قراءة (${dt(p.firstRead)}).`)
  } else {
    summary.push(`قُرئت خطط ${formatNumber(plans.filter((p) => p.readOk).length)} فروع من ${formatNumber(plans.length)} مشمولة.`)
    summary.push(`أعداد الحالات في الصفوف المقروءة: منفّذ ${formatNumber(totals.done)}، غير منفّذ ${formatNumber(totals.notDone)}، بدون خطة ${formatNumber(totals.noPlan)}، بدون خانة ${formatNumber(totals.noCheckbox)}. نسبة التنفيذ تُعرض لكل فرع على حدة، دون متوسط للشركة.`)
    summary.push(`${formatNumber(cs.filter((c) => c.branches.length >= 2).length)} سببًا تكرر في فرعين فأكثر، و${formatNumber(needsDecision(cs).length)} سببًا يحتاج قرارًا (ورد في ٣ فروع فأكثر بلا تنفيذ).`)
  }
  summary.push(APPROVAL_NOTE)

  const name = kind === "branch" ? plans[0]?.b.name : null
  return {
    kind,
    title: kind === "branch" ? `تقرير الخطة العلاجية — فرع ${name}` : opts.branches.length ? "التقرير الشامل للخطط العلاجية — فروع مختارة" : "التقرير الشامل للخطط العلاجية",
    generatedAt: now,
    readAt,
    opts,
    plans,
    totals,
    causes: cs,
    repeated: cs.filter((c) => c.branches.length >= 2),
    decisions: needsDecision(cs),
    lowest,
    log: data.remedialLog.filter((e) => slugs.has(e.branch)).sort((a, b) => b.readAt.localeCompare(a.readAt)),
    monthly: data.remedialMonthly.filter((m) => slugs.has(m.branch)).sort((a, b) => a.file.localeCompare(b.file) || a.order - b.order),
    quality,
    summary,
  }
}

/* ------------------------------------------------------------ pagination */
const BODY_H = PAGE_H - 90 - 46 - 24 - 60 // header, footer, padding, section title
const lines = (s: string | null | undefined, perLine: number) => (s ? s.split("\n").reduce((n, l) => n + Math.max(1, Math.ceil(l.length / perLine)), 0) : 1)
function paginate<T>(items: T[], height: (t: T) => number, budget = BODY_H): T[][] {
  const pages: T[][] = []
  let cur: T[] = []
  let used = 0
  for (const it of items) {
    const h = height(it)
    if (cur.length && used + h > budget) {
      pages.push(cur)
      cur = []
      used = 0
    }
    cur.push(it)
    used += h
  }
  if (cur.length) pages.push(cur)
  return pages
}

/* ------------------------------------------------------------ page parts */
function Page({ m, n, total, children, cover = false }: { m: RRModel; n: number; total: number; children: ReactNode; cover?: boolean }) {
  return (
    <div className="report-page relative flex flex-col overflow-hidden bg-white font-sans text-foreground" style={{ width: PAGE_W, height: PAGE_H }} dir="rtl" data-report-page>
      {!cover && (
        <div className="flex items-center justify-between border-b-2 border-primary px-12 pb-3 pt-8">
          <img src={LOGO_NAVY} alt="شركة الأندلس التعليمية" style={{ height: 40, width: "auto" }} />
          <div className="text-end">
            <div className="text-[13px] font-bold text-primary">{m.title}</div>
            <div className="num text-[11px] text-muted-foreground">تاريخ القراءة: {dt(m.readAt)}</div>
          </div>
        </div>
      )}
      <div className={cover ? "flex flex-1 flex-col" : "flex flex-1 flex-col px-12 pt-6"}>{children}</div>
      <div className="flex items-center justify-between border-t px-12 py-3 text-[11px] text-muted-foreground">
        <span>إدارة التواصل المؤسسي · الأرقام من ملفات الفروع بتاريخ القراءة</span>
        <span className="num">صدر في {formatDate(m.generatedAt)}</span>
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
      <h2 className="text-[19px] font-extrabold text-primary">{children}</h2>
      {sub && <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">{sub}</p>}
    </div>
  )
}
const th = "border-b-2 border-primary/30 bg-secondary px-1.5 py-1.5 text-start text-[10.5px] font-bold text-secondary-foreground"
const td = "border-b px-1.5 py-1.5 align-top text-[11px] leading-snug"
const pre = "whitespace-pre-line break-words"

function StageTable({ stages, rowsOf }: { stages: RemedialStage[]; rowsOf: (s: RemedialStage) => RemedialRow[] }) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          {["المرحلة", "الصفوف", "منفّذ", "غير منفّذ", "بدون خطة", "بدون خانة", "نسبة التنفيذ", "الاعتماد"].map((h) => (
            <th key={h} className={th}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {stages.map((s) => {
          const c = countRows(rowsOf(s))
          return (
            <tr key={s.id}>
              <td className={td}>{s.name}{s.empty ? " (فارغة)" : ""}</td>
              <td className={`${td} num`}>{formatNumber(s.total)}</td>
              <td className={`${td} num`}>{formatNumber(c.done)}</td>
              <td className={`${td} num`}>{formatNumber(c.notDone)}</td>
              <td className={`${td} num`}>{formatNumber(c.noPlan)}</td>
              <td className={`${td} num`}>{formatNumber(c.noCheckbox)}</td>
              <td className={`${td} num font-bold`}>{rateText(c)}</td>
              <td className={td}>{s.approval.filled ? `مكتوب: ${s.approval.value}` : "غير معتمد في الملف"}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

const rowH = (r: RemedialRow) => 14 + 15 * Math.max(lines(r.cause, 18), lines(r.problem, 26), lines(r.actions, 46), lines(r.owner, 14), 1)
const monthCols = ["أكتوبر", "نوفمبر", "ديسمبر", "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو"]
const monthlyH = (m: RemedialMonthly) => 14 + 15 * Math.max(lines(m.cells["المؤشر"], 34), lines(m.cells["المشكلة الفرعية"], 20), 1)

export function remedialPages(m: RRModel): ReactNode[] {
  const out: ((n: number, t: number) => ReactNode)[] = []
  const add = (f: (n: number, t: number) => ReactNode) => out.push(f)
  const branchName = (slug: string) => m.plans.find((p) => p.b.slug === slug)?.b.name ?? slug

  /* cover + executive summary */
  add((n, t) => (
    <Page key="cover" m={m} n={n} total={t} cover>
      <div className="pattern-stars relative bg-band px-12 pb-10 pt-12 text-band-foreground">
        <img src={LOGO_WHITE} alt="شركة الأندلس التعليمية" style={{ height: 64, width: "auto" }} />
        <div className="mt-10 text-[14px] text-band-soft">إدارة التواصل المؤسسي</div>
        <h1 className="mt-2 text-[30px] font-extrabold leading-tight">{m.title}</h1>
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-1 text-[13px]">
          <span className="num">تاريخ القراءة: <b>{dt(m.readAt)}</b></span>
          <span className="num">تاريخ الإصدار: <b>{formatDate(m.generatedAt)} · {formatTime(m.generatedAt)}</b></span>
        </div>
        {m.kind === "overall" && <div className="mt-1 text-[12px] text-white/75">الفروع: {m.opts.branches.length ? m.plans.map((p) => p.b.name).join("، ") : `جميع الفروع (${formatNumber(m.plans.length)})`}</div>}
      </div>
      <div className="flex flex-1 flex-col px-12 pt-8">
        <H>الملخص التنفيذي</H>
        <ul className="space-y-2.5">
          {m.summary.map((s, i) => (
            <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
              <span>{s}</span>
            </li>
          ))}
        </ul>
        <div className="mt-8 grid grid-cols-4 gap-3">
          {[
            ["منفّذ", m.totals.done],
            ["غير منفّذ", m.totals.notDone],
            ["بدون خطة", m.totals.noPlan],
            ["بدون خانة", m.totals.noCheckbox],
          ].map(([l, v]) => (
            <div key={l as string} className="rounded-lg border border-t-4 border-t-primary px-3 py-3">
              <div className="text-[12px] text-muted-foreground">{l}</div>
              <div className="num mt-0.5 text-[26px] font-extrabold text-primary">{formatNumber(v as number)}</div>
            </div>
          ))}
        </div>
        {m.kind === "branch" && (
          <div className="mt-4 rounded-lg bg-muted/60 px-4 py-3 text-[13px]">
            نسبة التنفيذ: <b className="num">{rateText(m.plans[0].counts)}</b> = منفّذ ÷ (منفّذ + غير منفّذ).
          </div>
        )}
        <p className="mt-auto pb-6 text-[11px] leading-relaxed text-muted-foreground">{SOURCE_NOTE}</p>
      </div>
    </Page>
  ))

  if (m.kind === "branch") {
    const p = m.plans[0]
    const rowsOf = (s: RemedialStage) => p.rows.filter((r) => r.stage === s.id)
    for (const [i, part] of paginate(p.stages, () => 30, BODY_H - 30).entries())
      add((n, t) => (
        <Page key={`st-${i}`} m={m} n={n} total={t}>
          <H sub="لكل مرحلة: أعداد الحالات من خانة «التنفيذ»، ونسبة التنفيذ = منفّذ ÷ (منفّذ + غير منفّذ).">جدول المراحل</H>
          {part.length ? <StageTable stages={part} rowsOf={rowsOf} /> : <p className="text-[13px] text-muted-foreground">لم يُعثر في الملف على تبويب خطة معبّأ.</p>}
        </Page>
      ))
    if (m.opts.details) {
      const pending = p.rows.filter((r) => r.status === "not-done" || r.status === "no-plan").sort((a, b) => a.stage.localeCompare(b.stage) || a.sheetRow - b.sheetRow)
      const parts = paginate(pending, rowH)
      ;(parts.length ? parts : [[]]).forEach((part, i) =>
        add((n, t) => (
          <Page key={`rows-${i}`} m={m} n={n} total={t}>
            <H sub="النصوص كما كُتبت في الملف، والتواريخ نص حر لا يُحسب منه تأخر.">الصفوف غير المنفّذة وبدون خطة{parts.length > 1 ? ` (${formatNumber(i + 1)}/${formatNumber(parts.length)})` : ""}</H>
            {part.length ? (
              <table className="w-full table-fixed border-collapse">
                <colgroup>
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "13%" }} />
                  <col style={{ width: "17%" }} />
                  <col style={{ width: "32%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "14%" }} />
                </colgroup>
                <thead>
                  <tr>
                    {["المرحلة / الحالة", "السبب", "المشكلة الفرعية", "الإجراءات", "المسؤول", "البدء / الاكتمال"].map((h) => (
                      <th key={h} className={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {part.map((r) => (
                    <tr key={r.id}>
                      <td className={td}>{r.stageName}<br /><b>{STATUS_LABEL[r.status]}</b>{r.num ? ` · #${r.num}` : ""}</td>
                      <td className={`${td} ${pre}`}>{r.cause ?? "—"}</td>
                      <td className={`${td} ${pre}`}>{r.problem ?? "—"}</td>
                      <td className={`${td} ${pre}`}>{r.actions ?? "—"}</td>
                      <td className={`${td} ${pre}`}>{r.owner ?? "—"}</td>
                      <td className={`${td} ${pre}`}>{r.start ?? "—"}<br />{r.end ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-[13px] text-muted-foreground">لا توجد صفوف غير منفّذة أو بدون خطة.</p>
            )}
          </Page>
        )),
      )
    }
    add((n, t) => (
      <Page key="log" m={m} n={n} total={t}>
        <H sub="تغيّرات خانة «التنفيذ» بين قراءة والتي تليها.">آخر التغييرات</H>
        {m.log.length ? (
          <table className="w-full border-collapse">
            <thead>
              <tr>{["التاريخ", "المرحلة", "الصف", "السبب / المشكلة", "من", "إلى"].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {m.log.slice(0, 30).map((e) => (
                <tr key={e.id}>
                  <td className={`${td} num`}>{formatDate(e.readAt)}</td>
                  <td className={td}>{e.stageName}</td>
                  <td className={`${td} num`}>{formatNumber(e.sheetRow)}</td>
                  <td className={td}>{e.cause ?? e.problem ?? "—"}</td>
                  <td className={td}>{e.fromStatus ? STATUS_LABEL[e.fromStatus] : "—"}</td>
                  <td className={td}>{STATUS_LABEL[e.toStatus]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-[13px] text-muted-foreground">لا تغيّرات مسجّلة منذ أول قراءة ({dt(p.firstRead)}).</p>
        )}
      </Page>
    ))
  } else {
    /* overall */
    for (const [i, part] of paginate(m.plans, () => 30, BODY_H - 40).entries())
      add((n, t) => (
        <Page key={`br-${i}`} m={m} n={n} total={t}>
          <H sub="نسبة التنفيذ لكل فرع على حدة. «بدون خطة» و«بدون خانة» خارج النسبة.">جدول الفروع</H>
          <table className="w-full border-collapse">
            <thead>
              <tr>{["الفرع", "نسبة التنفيذ", "منفّذ", "غير منفّذ", "بدون خطة", "بدون خانة", "المراحل", "فارغة", "حالة الخطة", "آخر قراءة"].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {part.map((p) => (
                <tr key={p.b.slug}>
                  <td className={`${td} font-bold`}>{p.b.name}</td>
                  <td className={`${td} num font-bold`}>{p.files.length ? rateText(p.counts) : "—"}</td>
                  <td className={`${td} num`}>{formatNumber(p.counts.done)}</td>
                  <td className={`${td} num`}>{formatNumber(p.counts.notDone)}</td>
                  <td className={`${td} num`}>{formatNumber(p.counts.noPlan)}</td>
                  <td className={`${td} num`}>{formatNumber(p.counts.noCheckbox)}</td>
                  <td className={`${td} num`}>{formatNumber(p.stages.length)}</td>
                  <td className={`${td} num`}>{formatNumber(p.emptyStages.length)}</td>
                  <td className={td}>{PLAN_LABEL[p.state]}</td>
                  <td className={`${td} num`}>{p.lastRead ? formatDate(p.lastRead) : "لم يُقرأ بعد"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Page>
      ))
    const causeH = (c: Cause) => 14 + 15 * lines(c.name, 40)
    const cparts = paginate(m.repeated, causeH, BODY_H - 40)
    ;(cparts.length ? cparts : [[]]).forEach((part, i) =>
      add((n, t) => (
        <Page key={`c-${i}`} m={m} n={n} total={t}>
          <H sub="أسباب وردت في فرعين أو أكثر، بعد توحيد التنويعات الإملائية الواضحة فقط.">الأسباب المتكررة{cparts.length > 1 ? ` (${formatNumber(i + 1)}/${formatNumber(cparts.length)})` : ""}</H>
          {part.length ? (
            <table className="w-full border-collapse">
              <thead>
                <tr>{["السبب", "الفروع", "الصفوف", "منفّذ", "غير منفّذ", "بدون خطة"].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {part.map((c) => (
                  <tr key={c.key}>
                    <td className={td}>{c.name}</td>
                    <td className={`${td} num font-bold`}>{formatNumber(c.branches.length)}</td>
                    <td className={`${td} num`}>{formatNumber(c.rows.length)}</td>
                    <td className={`${td} num`}>{formatNumber(c.counts.done)}</td>
                    <td className={`${td} num`}>{formatNumber(c.counts.notDone)}</td>
                    <td className={`${td} num`}>{formatNumber(c.counts.noPlan)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-[13px] text-muted-foreground">لا يوجد سبب تكرر في فرعين أو أكثر.</p>
          )}
        </Page>
      )),
    )
    add((n, t) => (
      <Page key="dec" m={m} n={n} total={t}>
        <H sub="سبب ورد في ٣ فروع أو أكثر ولم يُنفَّذ فيه أي صف.">تحتاج قرارًا</H>
        {m.decisions.length ? (
          <ul className="space-y-2">
            {m.decisions.slice(0, 14).map((c) => (
              <li key={c.key} className="rounded border-s-4 border-s-bad bg-muted/40 px-3 py-2 text-[12px]">
                <b>{c.name}</b>
                <div className="text-muted-foreground">
                  {formatNumber(c.branches.length)} فروع · {formatNumber(c.rows.length)} صفًا · غير منفّذ {formatNumber(c.counts.notDone)} · بدون خطة {formatNumber(c.counts.noPlan)} — {c.branches.map(branchName).join("، ")}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted-foreground">لا يوجد ما يحتاج قرارًا.</p>
        )}
        <div className="mt-6">
          <H sub="الأقل في نسبة التنفيذ بين الفروع التي لها صفوف منفّذة أو غير منفّذة؛ عند التساوي يُقدَّم الأكثر صفوفًا غير منفّذة.">الفروع الأقل تنفيذًا</H>
          <table className="w-full border-collapse">
            <thead>
              <tr>{["الفرع", "نسبة التنفيذ", "منفّذ", "غير منفّذ", "بدون خطة"].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {m.lowest.map((p) => (
                <tr key={p.b.slug}>
                  <td className={`${td} font-bold`}>{p.b.name}</td>
                  <td className={`${td} num font-bold`}>{rateText(p.counts)}</td>
                  <td className={`${td} num`}>{formatNumber(p.counts.done)}</td>
                  <td className={`${td} num`}>{formatNumber(p.counts.notDone)}</td>
                  <td className={`${td} num`}>{formatNumber(p.counts.noPlan)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Page>
    ))
    if (m.opts.details) {
      const blocks = m.plans.filter((p) => p.stages.length)
      for (const [i, part] of paginate(blocks, (p) => 50 + 30 * p.stages.length).entries())
        add((n, t) => (
          <Page key={`det-${i}`} m={m} n={n} total={t}>
            <H>تفاصيل المراحل حسب الفرع</H>
            <div className="space-y-4">
              {part.map((p) => (
                <div key={p.b.slug}>
                  <p className="mb-1 text-[13px] font-bold">{p.b.name}</p>
                  <StageTable stages={p.stages} rowsOf={(s) => p.rows.filter((r) => r.stage === s.id)} />
                </div>
              ))}
            </div>
          </Page>
        ))
    }
  }

  if (m.opts.monthly) {
    const parts = paginate(m.monthly, monthlyH, BODY_H - 30)
    ;(parts.length ? parts : [[]]).forEach((part, i) =>
      add((n, t) => (
        <Page key={`mo-${i}`} m={m} n={n} total={t}>
          <H sub="قيم الأشهر كما كُتبت في تبويب المتابعة الشهرية.">المتابعة الشهرية{parts.length > 1 ? ` (${formatNumber(i + 1)}/${formatNumber(parts.length)})` : ""}</H>
          {part.length ? (
            <table className="w-full table-fixed border-collapse">
              <colgroup>
                {m.kind === "overall" && <col style={{ width: "9%" }} />}
                <col style={{ width: m.kind === "overall" ? "15%" : "18%" }} />
                <col style={{ width: m.kind === "overall" ? "24%" : "28%" }} />
                <col style={{ width: "10%" }} />
                {monthCols.map((c) => <col key={c} />)}
              </colgroup>
              <thead>
                <tr>
                  {m.kind === "overall" && <th className={th}>الفرع</th>}
                  {["المشكلة الفرعية", "المؤشر", "المستهدف", ...monthCols].map((h) => <th key={h} className={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {part.map((r) => (
                  <tr key={r.id}>
                    {m.kind === "overall" && <td className={td}>{branchName(r.branch)}</td>}
                    <td className={`${td} ${pre}`}>{r.cells["المشكلة الفرعية"] ?? "—"}</td>
                    <td className={`${td} ${pre}`}>{r.cells["المؤشر"] ?? "—"}</td>
                    <td className={`${td} ${pre}`}>{r.cells["المستهدف"] ?? "—"}</td>
                    {monthCols.map((c) => <td key={c} className={`${td} ${pre}`}>{r.cells[c] ?? "—"}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-[13px] text-muted-foreground">لا توجد صفوف معبّأة في تبويبات المتابعة الشهرية.</p>
          )}
        </Page>
      )),
    )
  }

  add((n, t) => (
    <Page key="q" m={m} n={n} total={t}>
      <H>ملاحظات جودة البيانات</H>
      <ul className="space-y-2">
        {m.quality.map((q, i) => (
          <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
            <span>{q}</span>
          </li>
        ))}
      </ul>
      <p className="mt-6 rounded-lg bg-muted/60 px-4 py-3 text-[12px]">{APPROVAL_NOTE} {SOURCE_NOTE}</p>
    </Page>
  ))

  return out.map((f, i) => f(i + 1, out.length))
}

/* ------------------------------------------------------------ Excel */
type XRow = Record<string, string | number | null>
function sheet(rows: XRow[], fallback: XRow): XLSX.WorkSheet {
  const data = rows.length ? rows : [fallback]
  const ws = XLSX.utils.json_to_sheet(data)
  const headers = Object.keys(data[0])
  ws["!cols"] = headers.map((h) => ({ wch: Math.min(60, Math.max(10, Math.max(h.length, ...data.map((r) => String(r[h] ?? "").split("\n")[0].length)) + 2)) }))
  if (rows.length) ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: data.length, c: headers.length - 1 } }) }
  return ws
}
const sheetName = (s: string, used: Set<string>) => {
  let n = s.replace(/[[\]:*?/\\]/g, " ").slice(0, 31).trim() || "فرع"
  let i = 2
  while (used.has(n)) n = `${n.slice(0, 28)} ${i++}`
  used.add(n)
  return n
}

export function exportRemedialXlsx(m: RRModel): Blob {
  const wb = XLSX.utils.book_new()
  const used = new Set<string>()
  const info: XRow[] = [
    { "البند": "عنوان التقرير", "القيمة": m.title },
    { "البند": "تاريخ القراءة", "القيمة": dt(m.readAt) },
    { "البند": "تاريخ الإصدار", "القيمة": `${formatDate(m.generatedAt)} ${formatTime(m.generatedAt)}` },
    { "البند": "الفروع", "القيمة": m.plans.map((p) => p.b.name).join("، ") },
    { "البند": "الاعتماد", "القيمة": APPROVAL_NOTE },
    { "البند": "المصدر", "القيمة": SOURCE_NOTE },
    ...m.summary.map((s, i) => ({ "البند": `الملخص ${i + 1}`, "القيمة": s })),
  ]
  const branches: XRow[] = m.plans.map((p) => ({
    "الفرع": p.b.name,
    "نسبة التنفيذ": p.files.length ? rateText(p.counts) : "—",
    "منفّذ": p.counts.done,
    "غير منفّذ": p.counts.notDone,
    "بدون خطة": p.counts.noPlan,
    "بدون خانة تنفيذ": p.counts.noCheckbox,
    "المراحل": p.stages.length,
    "مراحل فارغة": p.emptyStages.length,
    "حالة الخطة": PLAN_LABEL[p.state],
    "آخر تغيّر": p.lastChange ? formatDate(p.lastChange) : "لا تغيّر منذ أول قراءة",
    "آخر قراءة": p.lastRead ? dt(p.lastRead) : "لم يُقرأ بعد",
  }))
  const summary = XLSX.utils.json_to_sheet(info)
  XLSX.utils.sheet_add_json(summary, [{}], { origin: -1, skipHeader: true })
  XLSX.utils.sheet_add_json(summary, branches.length ? branches : [{ "ملاحظة": "لا فروع" }], { origin: -1 })
  summary["!cols"] = [{ wch: 22 }, { wch: 70 }, ...Array(9).fill({ wch: 14 })]
  XLSX.utils.book_append_sheet(wb, summary, sheetName("ملخص", used))
  for (const p of m.plans) {
    const rows: XRow[] = p.rows
      .slice()
      .sort((a, b) => a.stage.localeCompare(b.stage) || a.sheetRow - b.sheetRow)
      .map((r) => ({
        "المرحلة": r.stageName,
        "صف الملف": r.sheetRow,
        "#": r.num,
        "الحالة": STATUS_LABEL[r.status],
        "خانة التنفيذ": r.executionRaw ?? (r.hasCheckbox ? "" : "لا توجد"),
        "السبب": r.cause,
        "المشكلة الفرعية": r.problem,
        "الإجراءات": r.actions,
        "المسؤول": r.owner,
        "تاريخ البدء": r.start,
        "تاريخ الاكتمال": r.end,
        "مؤشر القياس": r.indicator,
        "خط الأساس": r.baseline,
        "المستهدف": r.target,
        "أعمدة إضافية": Object.entries(r.extra).map(([k, v]) => `${k}: ${v}`).join(" | ") || null,
      }))
    const ws = sheet(rows, { "ملاحظة": p.files.length ? "لا توجد صفوف مقروءة في ملف هذا الفرع" : "لا يوجد ملف لهذا الفرع في سجل الروابط" })
    XLSX.utils.book_append_sheet(wb, ws, sheetName(p.b.name, used))
  }
  if (m.kind === "overall") {
    XLSX.utils.book_append_sheet(
      wb,
      sheet(m.repeated.map((c) => ({ "السبب": c.name, "الصيغ الأصلية": c.variants.join(" | "), "عدد الفروع": c.branches.length, "الفروع": c.branches.map((s) => m.plans.find((p) => p.b.slug === s)?.b.name ?? s).join("، "), "الصفوف": c.rows.length, "منفّذ": c.counts.done, "غير منفّذ": c.counts.notDone, "بدون خطة": c.counts.noPlan })), { "ملاحظة": "لا أسباب متكررة" }),
      sheetName("الأسباب المتكررة", used),
    )
    XLSX.utils.book_append_sheet(
      wb,
      sheet(m.decisions.map((c) => ({ "السبب": c.name, "عدد الفروع": c.branches.length, "الفروع": c.branches.map((s) => m.plans.find((p) => p.b.slug === s)?.b.name ?? s).join("، "), "غير منفّذ": c.counts.notDone, "بدون خطة": c.counts.noPlan })), { "ملاحظة": "لا يوجد ما يحتاج قرارًا" }),
      sheetName("تحتاج قرارا", used),
    )
  }
  if (m.opts.monthly)
    XLSX.utils.book_append_sheet(
      wb,
      sheet(m.monthly.map((r) => ({ "الفرع": m.plans.find((p) => p.b.slug === r.branch)?.b.name ?? r.branch, "التبويب": r.sheet, ...r.cells })), { "ملاحظة": "لا صفوف متابعة شهرية معبّأة" }),
      sheetName("المتابعة الشهرية", used),
    )
  XLSX.utils.book_append_sheet(wb, sheet(m.log.map((e) => ({ "التاريخ": dt(e.readAt), "الفرع": m.plans.find((p) => p.b.slug === e.branch)?.b.name ?? e.branch, "المرحلة": e.stageName, "صف الملف": e.sheetRow, "السبب": e.cause, "من": e.fromStatus ? STATUS_LABEL[e.fromStatus] : "", "إلى": STATUS_LABEL[e.toStatus] })), { "ملاحظة": "لا تغيّرات مسجّلة منذ أول قراءة" }), sheetName("آخر التغييرات", used))
  XLSX.utils.book_append_sheet(wb, sheet(m.quality.map((q, i) => ({ "#": i + 1, "الملاحظة": q })), { "ملاحظة": "لا ملاحظات" }), sheetName("جودة البيانات", used))
  wb.Workbook = { Views: [{ RTL: true }] }
  wb.Props = { Title: m.title, Author: "إدارة التواصل المؤسسي" }
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer
  return new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
}
