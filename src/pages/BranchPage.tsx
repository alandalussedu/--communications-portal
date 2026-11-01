import { useMemo, useState } from "react"
import { ChevronLeft, ExternalLink } from "lucide-react"
import { useRouter } from "@/lib/router"
import { useStore } from "@/data/store"
import { INDICATORS, LINK_STATE_LABEL, resolveLink } from "@/data/links"
import type { Branch, CellValue, IndicatorKey, IndicatorSummary, StageSummary, SyncEvent } from "@/data/types"
import {
  COMPLETE_LABEL,
  COMPLETE_TONE,
  FRESH_LABEL,
  FRESH_TONE,
  PERIODS,
  SATISFACTION_COMPONENTS,
  TARGET_LABEL,
  TARGET_TONE,
  buildAlerts,
  buildRows,
  periodCells,
  sharedEvents,
  targetStatus,
  type BranchRow,
  isHandled,
} from "@/data/insights"
import { formatDate, formatNumber, matches } from "@/lib/format"
import { usePersistent } from "@/lib/persist"
import { cn } from "@/lib/utils"
import { Gate } from "@/components/Gate"
import { AlertList } from "@/components/alerts"
import { DataTable, type Column } from "@/components/DataTable"
import { GroupBars, JourneyChart, JourneySteps, Legend, StackedBars, journey } from "@/components/charts"
import { Banner, ChipGroup, EmptyState, Octagram, OpenLink, Panel, PanelHeader, Pill, SearchField, Val } from "@/components/common"
import { IndicatorSwitch, LINK_TONE, latestResult } from "./OverviewPage"

const SOURCE_NAMES: Record<string, string> = {
  "abha-snapshot": "نسخة نصية من ملف المنصة الشاملة",
  "zahra-screenshot": "لقطة شاشة من ملف المنصة الشاملة",
}
const SOURCE_LABEL = new Proxy(SOURCE_NAMES, {
  get: (t, k: string) => t[k] ?? (k.startsWith("sheet-") ? "قراءة مباشرة من ملف المنصة الشاملة" : undefined),
})
const RESULT_LABEL: Record<SyncEvent["result"], string> = { success: "نجحت", partial: "نجحت جزئيًا", failed: "فشلت" }
const RESULT_TONE = { success: "ok", partial: "sky", failed: "bad" } as const

export function BranchPage({ slug }: { slug: string }) {
  const { data } = useStore()
  const { go } = useRouter()
  const rows = useMemo(() => buildRows(data, "s1"), [data])
  const row = rows.find((r) => r.b.slug === slug)
  return (
    <>
      <nav aria-label="مسار الصفحة" className="pt-6 text-[15px] text-muted-foreground">
        <button type="button" onClick={() => go({ page: "indicators" })} className="hover:text-foreground hover:underline">
          المؤشرات
        </button>
        <ChevronLeft className="mx-1 inline h-4 w-4" aria-hidden="true" />
        <button type="button" onClick={() => go({ page: "reports" })} className="hover:text-foreground hover:underline">
          مقارنة الفروع
        </button>
        <ChevronLeft className="mx-1 inline h-4 w-4" aria-hidden="true" />
        <span className="text-foreground">{row ? row.b.name : "فرع"}</span>
      </nav>
      <Gate needs={["branches", "indicators", "stages", "syncLog", "settings", "alertState", "meta"]}>
        {!row ? (
          <Panel className="mt-6">
            <EmptyState
              title="لم نجد هذا الفرع"
              body="قد يكون الرابط قديمًا أو أن الفرع غير مسجّل في سجل الروابط."
              action={
                <button type="button" onClick={() => go({ page: "reports" })} className="text-[16px] font-bold text-primary underline">
                  العودة إلى الفروع
                </button>
              }
            />
          </Panel>
        ) : (
          <BranchBody row={row} summaries={data.indicators.filter((i) => i.branch === slug)} />
        )}
      </Gate>
    </>
  )
}

type Tab = "satisfaction" | "communication" | "plans" | "stages" | "log" | "alerts"
const SECTIONS: [Tab, string][] = [
  ["satisfaction", "رضا العملاء"],
  ["communication", "جودة التواصل"],
  ["plans", "الخطط"],
  ["stages", "المراحل"],
  ["log", "سجل التحديثات"],
  ["alerts", "التنبيهات"],
]

function BranchBody({ row, summaries }: { row: BranchRow; summaries: IndicatorSummary[] }) {
  const { data } = useStore()
  const { b, sync, fresh, complete, stages } = row
  const alerts = useMemo(() => buildAlerts(data).filter((a) => a.branch?.slug === b.slug), [data, b.slug])
  const openAlerts = alerts.filter((a) => !isHandled(a, data.alertState)).length
  const [tab, setTab] = usePersistent<Tab>("branch-tab", "satisfaction")

  return (
    <>
      <section className="pattern-stars rise relative mt-4 overflow-hidden rounded-3xl bg-band px-6 py-7 text-band-foreground sm:px-9">
        <Octagram className="pointer-events-none absolute -end-12 -top-14 h-56 w-56 text-gold/25" strokeWidth={1} />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0">
            <p className="text-[15px] text-band-soft">{b.fileTitle ?? "المنصة الشاملة 2026/2027"}</p>
            <h1 className="mt-1 text-[34px] font-extrabold leading-tight sm:text-[42px]">أندلس {b.name}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <Pill tone={FRESH_TONE[fresh]}>{FRESH_LABEL[fresh]}</Pill>
              <Pill tone={COMPLETE_TONE[complete]}>{COMPLETE_LABEL[complete]}</Pill>
              {INDICATORS.map((it) => {
                const st = resolveLink(b, it.key).state
                return (
                  <Pill key={it.key} tone={LINK_TONE[st]}>
                    {it.short}: {LINK_STATE_LABEL[st]}
                  </Pill>
                )
              })}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {INDICATORS.map((it) => {
              const last = latestResult(summaries.find((x) => x.indicator === it.key))
              return (
                <div key={it.key} className="min-w-[150px] rounded-2xl bg-white/[0.08] px-4 py-3 ring-1 ring-white/15">
                  <div className="text-[14px] text-white/70">{it.short}</div>
                  <div className="num text-[26px] font-extrabold" dir="ltr">{last?.v?.raw ?? "—"}</div>
                  <div className="text-[13px] text-white/65">{last ? `آخر نتيجة: ${last.label}` : "لا نتائج مستلمة"}</div>
                </div>
              )
            })}
          </div>
        </div>
        <dl className="relative mt-6 grid grid-cols-1 gap-3 border-t border-white/15 pt-5 text-[15px] sm:grid-cols-3">
          <div>
            <dt className="text-white/65">آخر مزامنة ناجحة</dt>
            <dd className="num mt-0.5 font-bold">{sync.lastSuccess ? formatDate(sync.lastSuccess.succeededAt) : "لم تُقرأ بيانات الفرع بعد"}</dd>
          </div>
          <div>
            <dt className="text-white/65">آخر محاولة تحديث</dt>
            <dd className="num mt-0.5 font-bold">
              {sync.lastAttempt ? `${formatDate(sync.lastAttempt.attemptedAt)} · ${RESULT_LABEL[sync.lastAttempt.result]}` : "لا محاولات مسجلة"}
            </dd>
          </div>
          <div>
            <dt className="text-white/65">طريقة القراءة</dt>
            <dd className="mt-0.5 font-bold">{sync.lastSuccess?.method ?? "بانتظار الربط"}</dd>
          </div>
        </dl>
        <div className="relative mt-5 flex flex-wrap gap-2">
          {b.fileUrl ? (
            <a href={b.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[16px] font-bold text-[hsl(240_57%_30%)] hover:bg-white/90">
              فتح ملف المنصة الشاملة
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          ) : (
            <span className="inline-flex h-11 items-center rounded-full border border-dashed border-white/40 px-5 text-[15px] text-white/75">رابط ملف الفرع غير متاح بعد</span>
          )}
          {INDICATORS.map((it) => {
            const l = resolveLink(b, it.key)
            return l.url && (l.state === "direct" || l.state === "flagged") ? (
              <a key={it.key} href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-full bg-white/10 px-4 text-[15px] ring-1 ring-white/25 hover:bg-white/15">
                {it.short}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            ) : null
          })}
        </div>
      </section>

      {sync.failing && (
        <div className="mt-5">
          <Banner tone="bad" title="فشل آخر تحديث لبيانات هذا الفرع">
            {sync.lastAttempt?.message ?? "تعذّرت قراءة ملف الفرع."}{" "}
            {sync.lastSuccess ? `القيم المعروضة من قراءة ${formatDate(sync.lastSuccess.succeededAt)} وليست محدّثة.` : "لا توجد قيم سابقة."}
          </Banner>
        </div>
      )}

      <div
        role="tablist"
        aria-label="أقسام ملف الفرع"
        className="sticky z-20 -mx-4 mt-5 flex gap-1 overflow-x-auto border-b bg-background/95 px-4 backdrop-blur [scrollbar-width:none]"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 56px)" }}
      >
        {SECTIONS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls="branch-panel"
            onClick={() => setTab(id)}
            className={cn(
              "relative inline-flex h-12 shrink-0 items-center gap-1.5 px-3.5 text-[15px] transition-colors",
              tab === id ? "font-bold text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
            {id === "alerts" && openAlerts > 0 && <span className="num rounded-full bg-warn-soft px-1.5 text-[12px] font-bold leading-5 text-warn">{openAlerts}</span>}
            {tab === id && <span className="absolute inset-x-2 bottom-0 h-[3px] rounded-full bg-primary" aria-hidden="true" />}
          </button>
        ))}
      </div>

      <div id="branch-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {(tab === "satisfaction" || tab === "communication") && (
          <IndicatorSection key={tab} b={b} ind={tab} s={summaries.find((x) => x.indicator === tab)} stages={stages} />
        )}

        {tab === "alerts" &&
          (alerts.length > 0 ? (
            <Panel className="mt-6">
              <PanelHeader title="تنبيهات هذا الفرع" hint="الحالات التي رُصدت في بيانات الفرع وروابطه." />
              <AlertList alerts={alerts} compact />
            </Panel>
          ) : (
            <Panel className="mt-6">
              <EmptyState compact title="لا تنبيهات لهذا الفرع" body="لم تُرصد حالات تحتاج متابعة في بيانات الفرع وروابطه." />
            </Panel>
          ))}

        {tab === "plans" && (
          <section className="mt-6" aria-labelledby="plans-title">
            <h2 id="plans-title" className="text-[24px] font-bold">الخطط العلاجية والتحسينية</h2>
            <p className="text-[16px] text-muted-foreground">قسمان منفصلان، يُعرض فيهما ما يرد في ملف الفرع فقط.</p>
            <div className="mt-4 grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
              {(["الخطط العلاجية", "الخطط التحسينية"] as const).map((t) => (
                <Panel key={t}>
                  <PanelHeader title={t} />
                  <EmptyState
                    compact
                    title={complete === "full" ? `لا يوجد جدول ${t.replace("الخطط", "خطط")} في ملف الفرع` : "بانتظار ربط ملف الفرع"}
                    body={
                      complete === "full"
                        ? "صفحة ولاء العملاء المقروءة من الملف تحتوي جداول «خطة العمل» فقط، ولا تحدد خططًا علاجية أو تحسينية. تظهر هنا عند إضافتها إلى الملف بحقولها: الاسم والحالة والاستحقاق والمسؤول ونسبة الإنجاز."
                        : "تظهر خطط الفرع هنا بعد قراءة ملفه، إن كان يحتوي هذا الجدول."
                    }
                    action={b.fileUrl ? <OpenLink href={b.fileUrl} size="sm">فتح ملف الفرع</OpenLink> : undefined}
                  />
                </Panel>
              ))}
            </div>
          </section>
        )}

        {tab === "stages" &&
          (stages.length > 0 ? (
            <StageSection stages={stages} />
          ) : (
            <Panel className="mt-6">
              <EmptyState title="تفاصيل المراحل غير متاحة لهذا الفرع" body="تظهر هنا مراحل الفرع ومساراته عند قراءة صفحة «ولاء العملاء» من ملفه." />
            </Panel>
          ))}

        {tab === "log" && <SyncLog b={b} />}
      </div>
    </>
  )
}

/* ------------------------------------------------------------ indicator section */
function IndicatorSection({ b, ind, s, stages }: { b: Branch; ind: IndicatorKey; s?: IndicatorSummary; stages: StageSummary[] }) {
  const def = INDICATORS.find((x) => x.key === ind)!
  const components = s?.components.length ? s.components : ind === "satisfaction" ? SATISFACTION_COMPONENTS : []
  return (
    <section id={`sec-${ind}`} className="mt-6" aria-labelledby={`title-${ind}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="num text-[14px] font-bold text-sky-ink" dir="ltr">{s?.code ?? def.code}</p>
          <h2 id={`title-${ind}`} className="text-[24px] font-bold">مؤشرات {def.short}</h2>
          <p className="text-[16px] text-muted-foreground">{def.title} ومكوناته كما وردت في ملف الفرع.</p>
        </div>
      </div>

      <div className="mt-4 grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel className="rise">
          <PanelHeader title="المعامل خلال العام" actions={<Legend items={[{ label: "المستهدف", className: "border-gold", dashed: true }, { label: "النتيجة", className: "bg-primary" }]} />} />
          <div className="space-y-4 px-5 py-5">
            <JourneyChart s={s} height={260} />
            {s && <JourneySteps s={s} />}
            {s && journey(s).skipped.length > 0 && (
              <p className="text-[14px] text-muted-foreground">
                قيم ليست نسبة مئوية فلا تظهر في الرسم: <span className="num" dir="ltr">{journey(s).skipped.join(" · ")}</span>
              </p>
            )}
          </div>
        </Panel>
        <IndicatorFacts b={b} ind={ind} s={s} />
      </div>

      <Panel className="mt-5">
        <PanelHeader title="حالة تحقيق المستهدف" hint="مقارنة مباشرة بين نتيجة كل فترة ومستهدفها، فقط عندما يكونان نسبتين مئويتين في الملف." />
        <ul className="grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:divide-x-reverse">
          {PERIODS.map((p) => {
            const { target, result } = periodCells(s, p.key)
            const st = targetStatus(result, target, !!s)
            return (
              <li key={p.key} className="px-5 py-4">
                <div className="text-[15px] font-medium text-muted-foreground">{p.label}</div>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-3 text-[15px]">
                  <span>
                    النتيجة <Val v={result} className="text-[17px] font-bold text-primary" />
                  </span>
                  <span>
                    المستهدف <Val v={target} empty="غير منقول" className="text-[17px] font-bold text-gold-ink" />
                  </span>
                </div>
                <Pill tone={TARGET_TONE[st]} className="mt-2">{TARGET_LABEL[st]}</Pill>
              </li>
            )
          })}
        </ul>
      </Panel>

      <h3 className="mt-6 text-[20px] font-bold">{ind === "satisfaction" ? "المكونات الأربعة المعتمدة" : "مكونات المعامل في الملف"}</h3>
      {components.length === 0 ? (
        <Panel className="mt-3">
          <EmptyState compact title="أسماء المكونات تظهر بعد قراءة ملف الفرع" body="تُقرأ أسماء مكونات معامل جودة التواصل من ملف الفرع نفسه، ولا تفترض المنصة أسماء إضافية." />
        </Panel>
      ) : (
        <ul className={cn("mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2", components.length > 4 ? "xl:grid-cols-5" : "xl:grid-cols-4")}>
          {components.map((name) => (
            <ComponentCard key={name} name={name} s={s} stages={stages.filter((x) => x.indicator === ind)} ind={ind} />
          ))}
        </ul>
      )}
      {ind === "communication" && stages.some((x) => x.indicator === "communication" && x.subIndicators?.length) && (
        <ComponentStages stages={stages.filter((x) => x.indicator === "communication")} names={components} />
      )}
    </section>
  )
}

function ComponentCard({ name, s, stages, ind }: { name: string; s?: IndicatorSummary; stages: StageSummary[]; ind: IndicatorKey }) {
  const v = s?.componentValues?.[name]
  const withTargets = stages.filter((x) => x.subIndicators?.find((y) => y.name.trim() === name.trim())?.annualTarget?.raw).length
  const status = v ? targetStatus(v.result ?? null, v.target ?? null) : null
  return (
    <li className="rise flex h-full flex-col rounded-2xl border bg-card p-4">
      <p className="text-[17px] font-bold leading-snug">{name}</p>
      <dl className="mt-3 space-y-1.5 text-[15px]">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">القيمة الحالية</dt>
          <dd><Val v={v?.result ?? null} empty="غير مسجّلة" /></dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">المستهدف</dt>
          <dd><Val v={v?.target ?? null} empty="غير مسجّل" /></dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">الفترة</dt>
          <dd>{v?.period ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">الوحدة</dt>
          <dd>{v?.result?.unit === "%" ? "نسبة مئوية" : v?.result?.raw ? "كما في الملف" : "—"}</dd>
        </div>
      </dl>
      <div className="mt-3">{status ? <Pill tone={TARGET_TONE[status]}>{TARGET_LABEL[status]}</Pill> : <Pill>لا قيمة للمقارنة</Pill>}</div>
      <p className="mt-auto pt-3 text-[13px] leading-snug text-muted-foreground">
        {!s
          ? "بانتظار قراءة ملف الفرع."
          : v
            ? `المصدر: ${SOURCE_LABEL[s.source] ?? s.source} · ${formatDate(s.capturedAt)}`
            : ind === "communication" && withTargets
              ? `القيم مسجّلة على مستوى المراحل (${formatNumber(withTargets)} مرحلة لها مستهدف). انظر الجدول أدناه.`
              : `الملف يسجّل اسم المكوّن دون قيمة على مستوى الفرع. ${SOURCE_LABEL[s.source] ?? s.source} · ${formatDate(s.capturedAt)}`}
      </p>
    </li>
  )
}

function ComponentStages({ stages, names }: { stages: StageSummary[]; names: string[] }) {
  const [name, setName] = useState(names[0] ?? "")
  const rows = stages.map((st) => ({ st, sub: st.subIndicators?.find((x) => x.name.trim() === name.trim()) }))
  const columns: Column<(typeof rows)[number]>[] = [
    { key: "stage", header: "المرحلة", sort: (r) => r.st.stage, render: (r) => <span className="whitespace-nowrap font-bold">{r.st.stage}</span> },
    { key: "track", header: "المسار", render: (r) => <Pill tone="brand">{r.st.track ?? "—"}</Pill> },
    { key: "per", header: "لكل طالب", render: (r) => <Val v={r.sub?.perStudent ?? null} empty="—" /> },
    { key: "annual", header: "مستهدف العام", sort: (r) => r.sub?.annualTarget?.num ?? null, render: (r) => <Val v={r.sub?.annualTarget ?? null} empty="—" /> },
    { key: "s1", header: "نتيجة ف1", render: (r) => <Val v={r.sub?.s1Result ?? null} empty="—" /> },
    { key: "s2", header: "نتيجة ف2", render: (r) => <Val v={r.sub?.s2Result ?? null} empty="—" /> },
    { key: "ye", header: "نهاية العام", render: (r) => <Val v={r.sub?.yearEnd ?? null} empty="—" /> },
  ]
  return (
    <Panel className="mt-5">
      <PanelHeader title="قيم المكونات في المراحل" hint="اختر مكوّنًا لعرض قيمه في كل مرحلة كما وردت في الملف." />
      <div className="border-b px-5 py-3">
        <ChipGroup label="المكوّن" value={name} onChange={setName} options={names.map((n) => ({ value: n, label: n }))} />
      </div>
      <DataTable caption={`قيم ${name} في مراحل الفرع`} rows={rows} columns={columns} rowKey={(r) => r.st.id} stickyFirst />
    </Panel>
  )
}

function IndicatorFacts({ b, ind, s }: { b: Branch; ind: IndicatorKey; s?: IndicatorSummary }) {
  const def = INDICATORS.find((x) => x.key === ind)!
  const link = resolveLink(b, ind)
  return (
    <Panel className="rise flex flex-col">
      <div className="border-b px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="num rounded-md bg-secondary px-2 py-0.5 text-[14px] font-bold text-secondary-foreground" dir="ltr">{s?.code ?? def.code}</span>
          {s?.status ? <Pill tone="ok">{s.status}</Pill> : <Pill>لم تصل القيم</Pill>}
        </div>
        <h3 className="mt-2 text-[22px] font-bold">{def.title}</h3>
        <p className="mt-1 text-[16px] text-muted-foreground">
          مسؤول المؤشر: <span className="font-medium text-foreground">{s?.owner ?? "غير مسجّل"}</span>
        </p>
      </div>
      <div className="space-y-3 px-5 py-4">
        {link.state === "flagged" && <Banner tone="warn" title="الرابط يحتاج مراجعة">{link.note}</Banner>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Pill tone={LINK_TONE[link.state]}>{LINK_STATE_LABEL[link.state]}</Pill>
          <OpenLink href={link.url} variant="solid">
            {link.state === "file-only" ? "فتح ملف الفرع" : link.url ? "فتح المعامل في Google Sheets" : "لا يوجد رابط"}
          </OpenLink>
        </div>
        {link.state !== "direct" && link.state !== "flagged" && link.note && <p className="text-[14px] text-muted-foreground">{link.note}</p>}
        {b.links[ind]?.registerNote && (
          <p className="rounded-lg bg-muted/70 px-3 py-2 text-[14px] text-muted-foreground">
            {b.links[ind]!.registerNote}{" "}
            {b.links[ind]!.registerUrl && (
              <a href={b.links[ind]!.registerUrl!} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-2">
                رابط السجل
              </a>
            )}
          </p>
        )}
        {s?.note && <p className="text-[14px] text-muted-foreground">{s.note}</p>}
        {s && (
          <p className="text-[14px] text-muted-foreground">
            المصدر: {SOURCE_LABEL[s.source] ?? s.source}
            {s.sourceRow ? ` · الصف ${s.sourceRow}` : ""} · {formatDate(s.capturedAt)}
          </p>
        )}
      </div>
    </Panel>
  )
}

/* ------------------------------------------------------------ sync log */
function SyncLog({ b }: { b: Branch }) {
  const { data } = useStore()
  const sourceUrl = (id: string) => data.meta?.sources.find((s) => s.id === id)?.url ?? null
  const sourceTitle = (id: string) => data.meta?.sources.find((s) => s.id === id)?.title ?? id
  const own = data.syncLog.filter((e) => e.branch === b.slug)
  const shared = sharedEvents(data.syncLog)
  const rows = [...own, ...shared]
  // Group by source so attempt and success times sit side by side.
  const bySource = Array.from(new Set(rows.map((e) => e.source))).map((src) => {
    const evs = rows.filter((e) => e.source === src).sort((x, y) => y.attemptedAt.localeCompare(x.attemptedAt))
    const ok = evs.filter((e) => e.succeededAt).sort((x, y) => y.succeededAt!.localeCompare(x.succeededAt!))[0]
    return { src, last: evs[0], ok, scope: evs[0].branch ? "بيانات الفرع" : "سجل مشترك لكل الفروع" }
  })
  const columns: Column<(typeof bySource)[number]>[] = [
    {
      key: "src",
      header: "المصدر",
      render: (r) => (
        <div className="min-w-[200px]">
          <div className="font-bold">{sourceTitle(r.src)}</div>
          <div className="text-[14px] text-muted-foreground">{r.scope} · {r.last.method}</div>
        </div>
      ),
    },
    { key: "attempt", header: "آخر محاولة مزامنة", sort: (r) => r.last.attemptedAt, render: (r) => <span className="num whitespace-nowrap">{formatDate(r.last.attemptedAt)}</span> },
    {
      key: "ok",
      header: "آخر مزامنة ناجحة",
      sort: (r) => r.ok?.succeededAt ?? null,
      render: (r) => (r.ok ? <span className="num whitespace-nowrap">{formatDate(r.ok.succeededAt)}</span> : <span className="text-muted-foreground">لا يوجد</span>),
    },
    { key: "res", header: "النتيجة", render: (r) => <Pill tone={RESULT_TONE[r.last.result]}>{RESULT_LABEL[r.last.result]}</Pill> },
    { key: "msg", header: "رسالة", render: (r) => <span className="text-[14px] text-muted-foreground">{r.last.message ?? "—"}</span> },
    { key: "url", header: "الرابط", render: (r) => <OpenLink href={r.last.url ?? sourceUrl(r.src)} size="sm">فتح</OpenLink> },
  ]
  return (
    <section id="sec-log" className="mt-6" aria-labelledby="log-title">
      <h2 id="log-title" className="text-[24px] font-bold">سجل آخر التحديثات</h2>
      <p className="text-[16px] text-muted-foreground">آخر محاولة قراءة لكل مصدر، وآخر قراءة نجحت منه. الفرق بينهما يبيّن إن كانت القيم المعروضة أقدم من آخر محاولة.</p>
      <Panel className="mt-4">
        {bySource.length ? (
          <DataTable caption="سجل مزامنة مصادر الفرع" rows={bySource} columns={columns} rowKey={(r) => r.src} />
        ) : (
          <EmptyState compact title="لا قراءات مسجلة" body="يظهر هنا كل تحديث لبيانات الفرع بعد ربط ملفه." />
        )}
        {own.length === 0 && bySource.length > 0 && (
          <p className="border-t px-5 py-3 text-[14px] text-muted-foreground">
            لم تُقرأ بيانات هذا الفرع من ملفه بعد. المعروض أعلاه سجلات مشتركة لكل الفروع فقط.
          </p>
        )}
      </Panel>
    </section>
  )
}

/* ------------------------------------------------------------ stages */
const entered = (v: CellValue | undefined) => !!v?.raw

function Cell({ v, kind }: { v: CellValue | undefined; kind: "target" | "result" }) {
  if (!v?.raw) return <span className="inline-flex rounded-md border border-dashed px-2 py-0.5 text-[14px] text-muted-foreground">لم تُدخل</span>
  return (
    <span className={cn("num inline-flex rounded-md px-2 py-0.5 text-[15px] font-bold", kind === "result" ? "bg-secondary text-primary" : "bg-gold-soft text-gold-ink")} dir="ltr">
      {v.raw}
    </span>
  )
}

function StageSection({ stages }: { stages: StageSummary[] }) {
  const [ind, setInd] = useState<IndicatorKey>("satisfaction")
  const [track, setTrack] = useState("all")
  const [q, setQ] = useState("")
  const tracks = useMemo(() => Array.from(new Set(stages.map((s) => s.track).filter(Boolean))) as string[], [stages])
  const indStages = stages.filter((s) => s.indicator === ind)
  const visible = indStages.filter((s) => (track === "all" || s.track === track) && matches(q, s.stage, s.owner))
  const byTrack = (track === "all" ? tracks : [track]).map((t) => ({ t, list: indStages.filter((s) => s.track === t) }))
  const sub = (s: StageSummary, word: string) => s.subIndicators?.find((x) => x.name.includes(word))

  const columns: Column<StageSummary>[] = [
    { key: "stage", header: "المرحلة", sort: (s) => s.stage, render: (s) => <span className="whitespace-nowrap text-[16px] font-bold">{s.stage ?? "—"}</span> },
    { key: "track", header: "المسار", sort: (s) => s.track, render: (s) => <Pill tone="brand">{s.track ?? "—"}</Pill> },
    {
      key: "owner",
      header: "مسؤول المؤشر",
      sort: (s) => s.owner,
      render: (s) => (s.owner ? <span className="whitespace-nowrap">{s.owner}</span> : <span className="text-[14px] text-muted-foreground">غير مسجّل</span>),
    },
    ...(ind === "communication"
      ? ([{ key: "students", header: "عدد الطلاب", sort: (s) => s.studentCount?.num ?? null, render: (s) => <Val v={s.studentCount ?? null} empty="—" /> }] as Column<StageSummary>[])
      : []),
    { key: "annual", header: "مستهدف العام", sort: (s) => s.annualTarget?.num ?? null, render: (s) => <Cell v={s.annualTarget} kind="target" /> },
    { key: "s1t", header: "مستهدف ف1", sort: (s) => s.s1Target?.num ?? null, render: (s) => <Cell v={s.s1Target} kind="target" /> },
    { key: "s1r", header: "نتيجة ف1", sort: (s) => s.s1Result?.num ?? null, render: (s) => <Cell v={s.s1Result} kind="result" /> },
    { key: "s2t", header: "مستهدف ف2", sort: (s) => s.s2Target?.num ?? null, render: (s) => <Cell v={s.s2Target} kind="target" /> },
    { key: "s2r", header: "نتيجة ف2", sort: (s) => s.s2Result?.num ?? null, render: (s) => <Cell v={s.s2Result} kind="result" /> },
    { key: "st", header: "حالة ف1", render: (s) => <Pill tone={TARGET_TONE[targetStatus(s.s1Result, s.s1Target)]}>{TARGET_LABEL[targetStatus(s.s1Result, s.s1Target)]}</Pill> },
  ]

  return (
    <section className="mt-6" aria-labelledby="stages-title">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 id="stages-title" className="text-[24px] font-bold">المراحل والمسارات</h2>
          <p className="text-[16px] text-muted-foreground">قيم {INDICATORS.find((i) => i.key === ind)!.title} في كل مرحلة كما وردت في ملف الفرع.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <IndicatorSwitch value={ind} onChange={setInd} />
          <SearchField id="stage-search" value={q} onChange={setQ} placeholder="ابحث بالمرحلة أو المسؤول" className="md:w-72" />
        </div>
      </div>
      <div className="mb-5">
        <ChipGroup
          label="المسار"
          value={track}
          onChange={setTrack}
          options={[{ value: "all", label: "الكل", count: indStages.length }, ...tracks.map((t) => ({ value: t, label: t, count: indStages.filter((s) => s.track === t).length }))]}
        />
      </div>

      <div className={cn("grid grid-cols-1 items-start gap-5", ind === "communication" ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
        <Panel className="rise">
          <PanelHeader title="إدخال نتائج الفصل الأول" hint="عدد المراحل التي أُدخلت نتيجتها في كل مسار." />
          <div className="space-y-4 px-5 py-5">
            <Legend items={[{ label: "أُدخلت", className: "bg-primary" }, { label: "لم تُدخل", className: "bg-muted-foreground/30" }]} />
            <StackedBars
              unit="مراحل"
              rows={byTrack.map(({ t, list }) => ({
                id: t,
                label: t,
                segments: [
                  { key: "in", label: "أُدخلت", value: list.filter((s) => entered(s.s1Result)).length, className: "bg-primary" },
                  { key: "out", label: "لم تُدخل", value: list.filter((s) => !entered(s.s1Result)).length, className: "bg-muted-foreground/30" },
                ],
              }))}
            />
          </div>
        </Panel>
        <Panel className="rise">
          <PanelHeader title="تعيين مسؤول المؤشر" hint="المراحل التي سُجّل لها مسؤول في الملف." />
          <div className="space-y-4 px-5 py-5">
            <Legend items={[{ label: "مسؤول مسجّل", className: "bg-sky" }, { label: "بلا مسؤول", className: "bg-gold" }]} />
            <StackedBars
              unit="مراحل"
              rows={byTrack.map(({ t, list }) => ({
                id: t,
                label: t,
                segments: [
                  { key: "own", label: "مسؤول مسجّل", value: list.filter((s) => s.owner).length, className: "bg-sky" },
                  { key: "none", label: "بلا مسؤول", value: list.filter((s) => !s.owner).length, className: "bg-gold" },
                ],
              }))}
            />
          </div>
        </Panel>
        {ind === "communication" && (
          <Panel className="rise">
            <PanelHeader title="الطلاب والمستهدفات" hint="لكل مرحلة: عدد الطلاب، والمشاركات والاتصالات المستهدفة." />
            <div className="max-h-[520px] space-y-4 overflow-y-auto px-5 py-5">
              <Legend items={[{ label: "الطلاب", className: "bg-primary" }, { label: "مشاركات", className: "bg-sky" }, { label: "اتصالات", className: "bg-gold" }]} />
              <GroupBars
                metrics={[
                  { key: "students", label: "عدد الطلاب", className: "bg-primary" },
                  { key: "part", label: "مشاركات مستهدفة", className: "bg-sky" },
                  { key: "calls", label: "اتصالات مستهدفة", className: "bg-gold" },
                ]}
                rows={visible
                  .filter((s) => (s.studentCount?.num ?? 0) > 0)
                  .map((s) => ({
                    id: s.id,
                    label: s.stage ?? "",
                    values: {
                      students: { num: s.studentCount?.num ?? null, raw: s.studentCount?.raw ?? null },
                      part: { num: sub(s, "مشاركة")?.annualTarget?.num ?? null, raw: sub(s, "مشاركة")?.annualTarget?.raw ?? null },
                      calls: { num: sub(s, "الاتصالات")?.annualTarget?.num ?? null, raw: sub(s, "الاتصالات")?.annualTarget?.raw ?? null },
                    },
                  }))}
              />
            </div>
          </Panel>
        )}
      </div>

      <Panel className="mt-5">
        <DataTable
          caption="مراحل الفرع وقيم المعامل لكل مرحلة"
          rows={visible}
          columns={columns}
          rowKey={(s) => s.id}
          stickyFirst
          empty={<EmptyState compact title="لا مراحل تطابق الاختيار" body="غيّر المسار أو كلمة البحث." />}
        />
        <p className="border-t px-5 py-3 text-[14px] text-muted-foreground">
          عرض {formatNumber(visible.length)} من {formatNumber(indStages.length)} مرحلة. الذهبي للمستهدف والأزرق للنتيجة، والمنصة لا تحسب أي قيمة.
        </p>
      </Panel>
    </section>
  )
}
