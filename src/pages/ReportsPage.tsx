import { useMemo, useState } from "react"
import { BarChart3, LayoutGrid, List } from "lucide-react"
import { useRouter } from "@/lib/router"
import { branchDepth, useDerived, useStore, type DataDepth } from "@/data/store"
import { INDICATORS, LINK_STATE_LABEL, resolveLink } from "@/data/links"
import type { Branch, IndicatorKey } from "@/data/types"
import { formatNumber, matches } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Gate } from "@/components/Gate"
import { JourneyChart, Legend } from "@/components/charts"
import { ChipGroup, EmptyState, PageHeader, Panel, Pill, SearchField, Val } from "@/components/common"
import { ComparisonTable, TargetComparison } from "@/components/BranchComparison"
import { usePersistent } from "@/lib/persist"
import { IndicatorSwitch, LINK_TONE, latestResult } from "./OverviewPage"

type DepthFilter = "all" | DataDepth
type LinkFilter = "all" | "direct" | "flagged" | "missing"
const DEPTH_LABEL: Record<DataDepth, string> = { full: "بيانات كاملة", partial: "بيانات جزئية", none: "لا بيانات" }
const DEPTH_TONE = { full: "ok", partial: "sky", none: "neutral" } as const

export function ReportsPage() {
  const { data } = useStore()
  const d = useDerived()
  const { go } = useRouter()
  const [q, setQ] = useState("")
  const [depth, setDepth] = useState<DepthFilter>("all")
  const [link, setLink] = useState<LinkFilter>("all")
  const [ind, setInd] = useState<IndicatorKey>("satisfaction")
  const [view, setView] = usePersistent<"cards" | "table" | "compare">("reports-view", "cards")

  const rows = useMemo(
    () =>
      data.branches.map((b) => ({
        b,
        depth: branchDepth(b.slug, d),
        states: INDICATORS.map((i) => resolveLink(b, i.key).state),
        stages: d.stagesByBranch.get(b.slug)?.length ?? 0,
      })),
    [data.branches, d],
  )
  const filtered = rows.filter((r) => {
    if (!matches(q, r.b.name, r.b.fileTitle)) return false
    if (depth !== "all" && r.depth !== depth) return false
    if (link === "direct" && !r.states.every((s) => s === "direct")) return false
    if (link === "flagged" && !r.states.includes("flagged")) return false
    if (link === "missing" && !r.states.some((s) => s === "missing" || s === "file-only")) return false
    return true
  })
  const count = (f: (r: (typeof rows)[number]) => boolean) => rows.filter(f).length
  const clear = () => {
    setQ("")
    setDepth("all")
    setLink("all")
  }

  const empty = (
    <EmptyState
      compact
      title="لا توجد فروع تطابق البحث"
      body="غيّر كلمة البحث أو أعد المرشحات إلى «الكل»."
      action={
        <button type="button" className="text-[16px] font-bold text-primary underline underline-offset-4" onClick={clear}>
          مسح المرشحات
        </button>
      }
    />
  )

  const views = [
    ["cards", "بطاقات الفروع", LayoutGrid],
    ["table", "جدول المقارنة", List],
    ["compare", "النتيجة مقابل المستهدف", BarChart3],
  ] as const

  return (
    <>
      <PageHeader
        eyebrow="مؤشرات الفروع"
        title="مؤشرات الفروع"
        description="كل فرع ومعاملاه كما وردت في ملفه. اختر طريقة العرض، واضغط على أي فرع لفتح ملفه الكامل."
      />
      <div className="-mt-2 mb-5 flex gap-1 overflow-x-auto border-b [scrollbar-width:none]" role="tablist" aria-label="طريقة العرض">
        {views.map(([k, label, Icon]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={view === k}
            onClick={() => setView(k)}
            className={cn(
              "relative inline-flex h-12 shrink-0 items-center gap-2 px-3.5 text-[15px] transition-colors",
              view === k ? "font-bold text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
            {view === k && <span className="absolute inset-x-2 bottom-0 h-[3px] rounded-full bg-primary" aria-hidden="true" />}
          </button>
        ))}
      </div>
      <Gate needs={["branches", "indicators", "stages", "syncLog", "settings"]} emptyWhen={data.branches.length === 0}>
        {view === "table" && <ComparisonTable />}
        {view === "compare" && <TargetComparison />}
        {view === "cards" && (
          <>
            <div className="rise mb-5 flex flex-col gap-3 rounded-2xl border bg-card px-5 py-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <SearchField id="branch-search" value={q} onChange={setQ} placeholder="ابحث باسم الفرع أو الملف" className="md:w-80" />
                <IndicatorSwitch value={ind} onChange={setInd} />
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <ChipGroup<DepthFilter>
                  label="البيانات"
                  value={depth}
                  onChange={setDepth}
                  options={[
                    { value: "all", label: "الكل", count: rows.length },
                    { value: "full", label: "كاملة", count: count((r) => r.depth === "full") },
                    { value: "partial", label: "جزئية", count: count((r) => r.depth === "partial") },
                    { value: "none", label: "لا بيانات", count: count((r) => r.depth === "none") },
                  ]}
                />
                <ChipGroup<LinkFilter>
                  label="الروابط"
                  value={link}
                  onChange={setLink}
                  options={[
                    { value: "all", label: "الكل" },
                    { value: "direct", label: "مكتملة", count: count((r) => r.states.every((s) => s === "direct")) },
                    { value: "flagged", label: "تحتاج مراجعة", count: count((r) => r.states.includes("flagged")) },
                    { value: "missing", label: "ناقصة", count: count((r) => r.states.some((s) => s === "missing" || s === "file-only")) },
                  ]}
                />
              </div>
            </div>
            {filtered.length === 0 ? (
              <Panel>{empty}</Panel>
            ) : (
              <>
                <div className="mb-3">
                  <Legend items={[{ label: "المستهدف", className: "border-gold", dashed: true }, { label: "النتيجة", className: "bg-primary" }]} />
                </div>
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filtered.map((r, i) => (
                    <li key={r.b.slug} className="rise" style={{ animationDelay: `${Math.min(i, 10) * 45}ms` }}>
                      <button
                        type="button"
                        onClick={() => go({ page: "branch", slug: r.b.slug })}
                        className="lift flex h-full w-full flex-col gap-3 rounded-2xl border bg-card p-5 text-start hover:border-primary/40"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-[20px] font-bold">{r.b.name}</div>
                            <div className="truncate text-[14px] text-muted-foreground">{r.b.fileTitle ?? "اسم الملف غير ظاهر في السجل"}</div>
                          </div>
                          <Pill tone={DEPTH_TONE[r.depth]}>{DEPTH_LABEL[r.depth]}</Pill>
                        </div>
                        <JourneyChart s={d.indicatorByKey.get(`${r.b.slug}__${ind}`)} mini height={110} />
                        <div className="grid grid-cols-2 gap-3 border-t pt-3">
                          {INDICATORS.map((it) => {
                            const last = latestResult(d.indicatorByKey.get(`${r.b.slug}__${it.key}`))
                            const st = resolveLink(r.b, it.key).state
                            return (
                              <div key={it.key} className="min-w-0">
                                <div className="text-[14px] text-muted-foreground">{it.short}</div>
                                <div className="text-[18px] font-bold">
                                  {last ? <Val v={last.v} /> : <span className="text-[15px] font-normal text-muted-foreground">لا نتائج</span>}
                                </div>
                                <div className="text-[13px] text-muted-foreground">{last ? last.label : ""}</div>
                                <div className="mt-1">
                                  <Pill tone={LINK_TONE[st]}>{LINK_STATE_LABEL[st]}</Pill>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="mt-3 text-[14px] text-muted-foreground">
              عرض {formatNumber(filtered.length)} من {formatNumber(rows.length)} فرعًا. القيم كما وردت في ملفات الفروع، والمنصة لا تحسب أي قيمة.
            </p>
          </>
        )}
      </Gate>
    </>
  )
}
