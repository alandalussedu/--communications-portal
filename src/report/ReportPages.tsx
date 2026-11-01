import type { ReactNode } from "react"
import { LOGO_NAVY, LOGO_WHITE } from "@/assets/logo"
import { COMPLETE_LABEL, FRESH_LABEL, TARGET_LABEL, periodCells, targetStatus, type TargetStatus } from "@/data/insights"
import { formatDate, formatNumber, formatTime } from "@/lib/format"
import { fmtDate, plural, type ReportModel } from "./model"

/** A4 at 96 dpi. Every page is a fixed box so tables never split mid-row. */
export const PAGE_W = 794
export const PAGE_H = 1123

const chunk = <T,>(a: T[], n: number): T[][] => (a.length ? Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n)) : [])

const ST_CLS: Record<TargetStatus, string> = {
  met: "bg-ok-soft text-ok",
  unmet: "bg-bad-soft text-bad",
  "no-result": "bg-muted text-muted-foreground",
  "no-target": "bg-muted text-muted-foreground",
  "not-comparable": "bg-warn-soft text-warn",
  "no-data": "bg-muted text-muted-foreground",
}

function Status({ s }: { s: TargetStatus }) {
  return <span className={`inline-block whitespace-nowrap rounded px-1.5 py-px text-[11px] font-medium ${ST_CLS[s]}`}>{TARGET_LABEL[s]}</span>
}

function Page({ m, n, total, children, cover = false }: { m: ReportModel; n: number; total: number; children: ReactNode; cover?: boolean }) {
  return (
    <div className="report-page relative flex flex-col overflow-hidden bg-white font-sans text-foreground" style={{ width: PAGE_W, height: PAGE_H }} dir="rtl" data-report-page>
      {!cover && (
        <div className="flex items-center justify-between border-b-2 border-primary px-12 pb-3 pt-8">
          <img src={LOGO_NAVY} alt="شركة الأندلس التعليمية" style={{ height: 40, width: "auto" }} />
          <div className="text-end">
            <div className="text-[13px] font-bold text-primary">{m.title}</div>
            <div className="num text-[11px] text-muted-foreground">
              {m.periodName} · {m.year}
            </div>
          </div>
        </div>
      )}
      <div className={cover ? "flex flex-1 flex-col" : "flex flex-1 flex-col px-12 pt-6"}>{children}</div>
      <div className="flex items-center justify-between border-t px-12 py-3 text-[11px] text-muted-foreground">
        <span>إدارة التواصل المؤسسي · شركة الأندلس التعليمية</span>
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
    <div className="mb-4">
      <h2 className="text-[20px] font-extrabold text-primary">{children}</h2>
      {sub && <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{sub}</p>}
    </div>
  )
}

const th = "border-b-2 border-primary/30 bg-secondary px-2 py-1.5 text-start text-[11px] font-bold text-secondary-foreground"
const td = "border-b px-2 py-1.5 align-middle text-[12px]"

/** Builds the page list. Returns React nodes ready to render or capture. */
export function reportPages(m: ReportModel): ReactNode[] {
  const bodies: { node: (n: number, total: number) => ReactNode }[] = []
  const add = (render: (n: number, total: number) => ReactNode) => bodies.push({ node: render })

  /* 1 · cover and executive summary */
  add((n, t) => (
    <Page key="cover" m={m} n={n} total={t} cover>
      <div className="pattern-stars relative bg-band px-12 pb-10 pt-12 text-band-foreground">
        <img src={LOGO_WHITE} alt="شركة الأندلس التعليمية" style={{ height: 64, width: "auto" }} />
        <div className="mt-10 text-[14px] text-band-soft">إدارة التواصل المؤسسي</div>
        <h1 className="mt-2 text-[34px] font-extrabold leading-tight">{m.title}</h1>
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-1 text-[14px]">
          <span>
            الفترة: <b>{m.periodName}</b>
          </span>
          <span className="num">
            العام الدراسي: <b>{m.year}</b>
          </span>
          <span className="num">
            تاريخ الإصدار: <b>{formatDate(m.generatedAt)} · {formatTime(m.generatedAt)}</b>
          </span>
        </div>
        <div className="mt-1 text-[13px] text-white/75">
          الفروع: {m.opts.branches.length ? m.rows.map((r) => r.b.name).join("، ") : `جميع الفروع (${formatNumber(m.rows.length)})`}
        </div>
      </div>
      <div className="flex flex-1 flex-col px-12 pt-8">
        <H>الملخص التنفيذي</H>
        <ul className="space-y-2.5">
          {m.summary.map((s, i) => (
            <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
              <span>{s}</span>
            </li>
          ))}
        </ul>
        <div className="mt-8 grid grid-cols-3 gap-3">
          {m.kpis.map((k) => (
            <div key={k.label} className="rounded-lg border border-t-4 border-t-primary px-4 py-3">
              <div className="text-[12px] text-muted-foreground">{k.label}</div>
              <div className="num mt-0.5 text-[28px] font-extrabold text-primary">{k.value}</div>
              <div className="text-[11px] text-muted-foreground">{k.note}</div>
            </div>
          ))}
        </div>
        <p className="mt-auto pb-6 text-[11px] leading-relaxed text-muted-foreground">
          القيم منقولة كما وردت في ملفات المنصة الشاملة للفروع، ولا تحسب المنصة أي قيمة. حالة تحقيق المستهدف مقارنة مباشرة بين نتيجة الفترة ومستهدفها، ولا تُعرض إلا عندما يكونان نسبتين مئويتين.
        </p>
      </div>
    </Page>
  ))

  /* 2 · branch comparison */
  for (const [pi, part] of chunk(m.rows, 15).entries()) {
    add((n, t) => (
      <Page key={`cmp-${pi}`} m={m} n={n} total={t}>
        <H sub={`نتيجة ${m.periodName} ومستهدفها لكل فرع، وحالة البيانات وتاريخ آخر تحديث ناجح.`}>مقارنة الفروع{pi ? " (تابع)" : ""}</H>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={th}>الفرع</th>
              {m.indicators.map((i) => (
                <th key={i.key} className={th}>
                  {i.short}: النتيجة / المستهدف
                </th>
              ))}
              <th className={th}>حالة البيانات</th>
              <th className={th}>آخر تحديث</th>
            </tr>
          </thead>
          <tbody>
            {part.map((r) => (
              <tr key={r.b.slug}>
                <td className={`${td} font-bold`}>{r.b.name}</td>
                {m.indicators.map((i) => {
                  const c = r.ind[i.key]
                  return (
                    <td key={i.key} className={td}>
                      <div className="num" dir="rtl">
                        <b className="text-primary">{c.result?.raw ?? "—"}</b>
                        <span className="text-muted-foreground"> / </span>
                        <span className="text-gold-ink">{c.target?.raw ?? "—"}</span>
                      </div>
                      <Status s={c.status} />
                    </td>
                  )
                })}
                <td className={td}>
                  <div>{FRESH_LABEL[r.fresh]}</div>
                  <div className="text-[11px] text-muted-foreground">{COMPLETE_LABEL[r.complete]}</div>
                </td>
                <td className={`${td} num whitespace-nowrap`}>{fmtDate(r.sync.lastSuccess?.succeededAt ?? null)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Page>
    ))
  }

  /* 3 · charts, one page per indicator */
  if (m.opts.charts) {
    for (const i of m.indicators) {
      const list = m.rows.map((r) => ({ r, c: r.ind[i.key] }))
      const counts = (s: TargetStatus) => list.filter((x) => x.c.status === s).length
      const dist: [string, number, string][] = [
        ["حقق المستهدف", counts("met"), "bg-ok"],
        ["دون المستهدف", counts("unmet"), "bg-bad"],
        ["غير قابل للمقارنة", counts("not-comparable") + counts("no-target"), "bg-warn"],
        ["لم تُدخل النتيجة", counts("no-result"), "bg-sky"],
        ["لم تصل البيانات", counts("no-data"), "bg-muted-foreground/30"],
      ]
      const total = list.length || 1
      add((n, t) => (
        <Page key={`chart-${i.key}`} m={m} n={n} total={t}>
          <H sub={`العمود الأزرق نتيجة ${m.periodName} والعلامة الذهبية مستهدفها. تُرسم القيم المئوية فقط.`}>{i.title}: النتائج مقابل المستهدفات</H>
          {!list.some((x) => x.c.result?.unit === "%" && x.c.result.num !== null) && (
            <p className="mb-3 rounded bg-muted px-3 py-2 text-[12px] text-muted-foreground">لا توجد نتائج بنسبة مئوية لهذه الفترة بعد؛ تظهر المستهدفات وحدها.</p>
          )}
          <ul className="space-y-[7px]">
            {list.map(({ r, c }) => {
              const v = c.result?.unit === "%" ? c.result.num : null
              const tg = c.target?.unit === "%" ? c.target.num : null
              return (
                <li key={r.b.slug} className="grid grid-cols-[110px_1fr_120px] items-center gap-3 text-[12px]">
                  <span className="truncate font-medium">{r.b.name}</span>
                  <div className={`relative h-3.5 rounded-full ${c.s ? "bg-muted" : "border border-dashed"}`}>
                    {v !== null && <div className="absolute inset-y-0 start-0 rounded-full bg-primary" style={{ width: `${Math.min(100, v!)}%` }} />}
                    {tg !== null && <span className="absolute -bottom-1 -top-1 w-[3px] rounded bg-gold" style={{ insetInlineStart: `calc(${Math.min(100, tg!)}% - 1.5px)` }} />}
                  </div>
                  <span className="num text-muted-foreground">
                    {c.result?.raw ?? (c.s ? "لم تُدخل" : "لا بيانات")}
                    {c.target?.raw ? ` · المستهدف ${c.target.raw}` : ""}
                  </span>
                </li>
              )
            })}
          </ul>
          <div className="mt-8">
            <h3 className="mb-2 text-[15px] font-bold text-primary">توزيع الفروع حسب تحقيق المستهدف</h3>
            <div className="flex h-5 w-full overflow-hidden rounded-full bg-muted">
              {dist.map(([l, v, cls]) => (v ? <span key={l} className={`h-full ${cls}`} style={{ width: `${(v / total) * 100}%` }} /> : null))}
            </div>
            <ul className="mt-3 grid grid-cols-3 gap-x-4 gap-y-1 text-[12px]">
              {dist.map(([l, v, cls]) => (
                <li key={l} className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${cls}`} />
                  {l}: <b className="num">{formatNumber(v)}</b>
                </li>
              ))}
            </ul>
          </div>
        </Page>
      ))
    }
  }

  /* 4 · follow-up: alerts, data gaps, plans */
  type FItem = { kind: "alert"; a: ReportModel["followUps"][number] } | { kind: "gap"; g: ReportModel["gaps"][number] }
  const items: FItem[] = [...m.followUps.filter((a) => a.kind !== "no-data" && a.kind !== "invalid" && a.kind !== "link").map((a) => ({ kind: "alert" as const, a })), ...m.gaps.map((g) => ({ kind: "gap" as const, g }))]
  const fChunks = chunk(items, 22)
  if (!fChunks.length) fChunks.push([])
  fChunks.forEach((part, pi) => {
    const last = pi === fChunks.length - 1
    add((n, t) => (
      <Page key={`follow-${pi}`} m={m} n={n} total={t}>
        <H sub="الفروع التي تحتاج متابعة، والبيانات الناقصة أو المصادر التي لم تُحدّث.">المتابعة والبيانات الناقصة{pi ? " (تابع)" : ""}</H>
        {part.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">لا توجد حالات تحتاج متابعة في الفروع المشمولة.</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th} style={{ width: 130 }}>الفرع</th>
                <th className={th}>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {part.map((x, k) => (
                <tr key={k}>
                  <td className={`${td} font-bold`}>{x.kind === "alert" ? x.a.branch?.name : x.g.branch}</td>
                  <td className={td}>{x.kind === "alert" ? `${x.a.title}. ${x.a.reason}` : x.g.issue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {last && m.opts.includePlans && (
          <div className="mt-6 rounded-lg border p-4">
            <h3 className="text-[15px] font-bold text-primary">الخطط العلاجية والتحسينية</h3>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              لا تحتوي الملفات المقروءة للفروع المشمولة جدولًا للخطط العلاجية أو التحسينية؛ صفحة ولاء العملاء فيها جداول «خطة العمل» فقط. لذلك لا يعرض التقرير حالات أو نسب إنجاز لهذه الخطط.
            </p>
          </div>
        )}
      </Page>
    ))
  })

  /* 5 · stage detail for branches whose stages were read */
  for (const sb of m.stageBranches) {
    for (const g of sb.byIndicator) {
      chunk(g.stages, 22).forEach((part, pi) =>
        add((n, t) => (
          <Page key={`st-${sb.row.b.slug}-${g.key}-${pi}`} m={m} n={n} total={t}>
            <H sub={`قيم ${m.periodName} في كل مرحلة كما وردت في ملف الفرع.`}>
              فرع {sb.row.b.name}: {g.title} حسب المراحل{pi ? " (تابع)" : ""}
            </H>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={th}>المرحلة</th>
                  <th className={th}>المسار</th>
                  <th className={th}>مسؤول المؤشر</th>
                  <th className={th}>المستهدف</th>
                  <th className={th}>النتيجة</th>
                  <th className={th}>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {part.map((s) => {
                  const { target, result } = periodCells(s, m.opts.period)
                  return (
                    <tr key={s.id}>
                      <td className={`${td} font-medium`}>{s.stage}</td>
                      <td className={td}>{s.track}</td>
                      <td className={td}>{s.owner ?? "—"}</td>
                      <td className={`${td} num text-gold-ink`}>{target?.raw ?? "—"}</td>
                      <td className={`${td} num font-bold text-primary`}>{result?.raw ?? "—"}</td>
                      <td className={td}>
                        <Status s={targetStatus(result, target)} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Page>
        )),
      )
    }
  }

  /* 6 · sources and reliability */
  const unread = m.rows.filter((r) => !r.sync.lastSuccess).map((r) => r.b.name)
  add((n, t) => (
    <Page key="sources" m={m} n={n} total={t}>
      <H sub="من أين جاءت أرقام هذا التقرير، ومتى قُرئت آخر مرة بنجاح.">مصادر البيانات وموثوقيتها</H>
      <dl className="mb-5 grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg bg-muted/60 p-4 text-[12px]">
        <div>
          <dt className="text-muted-foreground">تاريخ ووقت إنشاء التقرير</dt>
          <dd className="num font-bold">{formatDate(m.generatedAt)} · {formatTime(m.generatedAt)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">الفترة التي يغطيها</dt>
          <dd className="num font-bold">
            {m.periodName} · {m.year}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-muted-foreground">الفروع المشمولة</dt>
          <dd className="font-bold">{m.rows.map((r) => r.b.name).join("، ")}</dd>
        </div>
      </dl>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={th}>المصدر</th>
            <th className={th}>النطاق</th>
            <th className={th}>آخر محاولة</th>
            <th className={th}>آخر نجاح</th>
            <th className={th}>طريقة القراءة</th>
          </tr>
        </thead>
        <tbody>
          {m.sources.map((s) => (
            <tr key={s.id}>
              <td className={td}>
                <div className="font-medium">{s.title}</div>
                {s.url && (
                  <div className="num break-all text-[10px] text-sky-ink" dir="ltr">
                    {s.url.replace(/[?#].*$/, "")}
                  </div>
                )}
              </td>
              <td className={td}>{s.scope}</td>
              <td className={`${td} num whitespace-nowrap`}>{fmtDate(s.lastAttempt)}</td>
              <td className={`${td} num whitespace-nowrap`}>{fmtDate(s.lastSuccess)}</td>
              <td className={`${td} text-[11px]`}>{s.method}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-5 space-y-2 text-[12px] leading-relaxed">
        <p>
          <b>البيانات الحديثة:</b> الفروع التي لها تاريخ «آخر نجاح» في الجدول أعلاه. قيمها منقولة من ملفاتها في ذلك التاريخ.
        </p>
        <p>
          <b>بيانات لم تُحدّث:</b>{" "}
          {unread.length ? `لم تُقرأ بيانات ${plural(unread.length)} من الفروع المشمولة بعد: ${unread.join("، ")}. تظهر في التقرير بحالة «بانتظار الربط» ولا تُنسب لها أي قيمة.` : "لا يوجد."}
        </p>
        <p className="text-muted-foreground">{m.liveSync ? "المزامنة التلقائية مع Google Sheets مفعّلة." : m.lastRun ? `آخر قراءة مباشرة لملفات الفروع عبر Google Sheets: ${formatDate(m.lastRun)}. القراءة الدورية التلقائية لم تُجدول بعد.` : "المزامنة التلقائية مع Google Sheets غير مفعّلة في هذه النسخة؛ النقل الحالي يدوي من الملفات."}</p>
      </div>
    </Page>
  ))

  const total = bodies.length
  return bodies.map((b, i) => b.node(i + 1, total))
}
