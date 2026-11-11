import { useMemo, useState } from "react"
import { AlertTriangle, ArrowRight, ExternalLink, Plus } from "lucide-react"
import { useStore } from "@/data/store"
import type { CsrInitiative, CsrPlan, CsrPlanProject } from "@/data/types"
import { TRACKS, blankInitiative, todayIso } from "@/data/csr"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { EmptyState, Panel, PanelHeader } from "@/components/common"
import { Kpi, btn, fmt } from "./ui"

/**
 * «خطط الفروع»: each branch's CSR section («PROJECTS 2027» in its comprehensive
 * platform file), copied as it is at every update. Read-only: the branch edits
 * its own sheet; the portal only shows it and can start an initiative from it.
 */

const TRACK_LABEL: Record<CsrPlanProject["track"], string> = { edu: TRACKS.edu.label, val: TRACKS.val.label, other: "مشروع إضافي" }

function Approval({ v }: { v: string | null }) {
  const cls = v === "معتمد" ? "bg-ok-soft text-ok" : v === "غير معتمد" ? "bg-bad-soft text-bad" : "bg-muted text-muted-foreground"
  return <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[13px] font-medium", cls)}>{v ?? "الاعتماد لم يُحدَّد"}</span>
}

const projectsOf = (p: CsrPlan) => (p.projects ?? []).filter((x) => !x.empty)
const nextStep = (p: CsrPlan, today: string) =>
  (p.projects ?? [])
    .flatMap((x) => x.steps.filter((s) => s.dateIso && s.dateIso >= today).map((s) => ({ ...s, project: x.name })))
    .sort((a, b) => a.dateIso!.localeCompare(b.dateIso!))[0] ?? null
const totalBudget = (p: CsrPlan) => (p.projects ?? []).reduce((a, x) => a + (x.budget || 0), 0)

export function PlansTab({ onOpen, onCreate }: { onOpen: (i: CsrInitiative) => void; onCreate: (i: CsrInitiative) => void }) {
  const { data } = useStore()
  const [sel, setSel] = useState<string | null>(null)
  const today = todayIso()
  const plans = useMemo(() => new Map(data.csrPlans.map((p) => [p.branch, p])), [data.csrPlans])
  const branches = data.branches
  const readAt = data.csrPlans.reduce<string | null>((m, p) => (!m || p.readAt > m ? p.readAt : m), null)

  if (!data.csrPlans.length)
    return (
      <Panel>
        <EmptyState title="لم تُقرأ خطط الفروع بعد" body="تظهر هنا خطة المسؤولية المجتمعية لكل فرع من ملف «المنصة الشاملة» بعد أول تحديث." />
      </Panel>
    )

  const selPlan = sel ? plans.get(sel) : null
  if (sel && selPlan) return <PlanDetail plan={selPlan} name={branches.find((b) => b.slug === sel)?.name ?? sel} onBack={() => setSel(null)} onOpen={onOpen} onCreate={onCreate} />

  const all = branches.map((b) => ({ b, p: plans.get(b.slug) ?? null }))
  const withPlan = all.filter((r) => r.p && projectsOf(r.p).length > 0).length
  const projects = all.flatMap((r) => (r.p ? projectsOf(r.p) : []))
  const approved = projects.filter((x) => x.approval === "معتمد").length
  const budget = all.reduce((a, r) => a + (r.p ? totalBudget(r.p) : 0), 0)

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="فروع عبّأت خطتها" value={fmt(withPlan)} of={fmt(branches.length)} />
        <Kpi label="مشاريع في الخطط" value={fmt(projects.length)} />
        <Kpi label="مشاريع معتمدة" value={fmt(approved)} of={fmt(projects.length)} />
        <Kpi label="الميزانية المخططة" value={fmt(budget)} hint="ريال، كما في خطوات العمل" />
      </div>

      <Panel>
        <PanelHeader title="خطة كل فرع" hint={`من ورقة المشاريع في ملف «المنصة الشاملة» لكل فرع، للاطلاع فقط.${readAt ? ` آخر قراءة ${formatDate(readAt)}.` : ""}`} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-[14px]">
            <thead>
              <tr className="border-b bg-muted/50 text-[13px] text-muted-foreground">
                {["الفرع", TRACKS.edu.label, TRACKS.val.label, "الميزانية", "الخطوة القادمة", ""].map((h, k) => (
                  <th key={k} scope="col" className="px-4 py-2.5 text-start font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {all.map(({ b, p }) => {
                const proj = (t: "edu" | "val") => p?.projects?.find((x) => x.track === t) ?? null
                const nx = p ? nextStep(p, today) : null
                const issues = p?.issues?.length ?? 0
                return (
                  <tr key={b.slug} className="cursor-pointer border-b last:border-0 hover:bg-accent/40" onClick={() => p && setSel(b.slug)}>
                    <th scope="row" className="px-4 py-3 text-start">
                      <button type="button" className="text-[15px] font-bold hover:underline" onClick={(e) => (e.stopPropagation(), p && setSel(b.slug))}>{b.name}</button>
                    </th>
                    {p?.status === "no-link" || !p ? (
                      <td colSpan={4} className="px-4 py-3 text-muted-foreground">لم يُضف رابط الخطة بعد</td>
                    ) : (
                      <>
                        {(["edu", "val"] as const).map((t) => {
                          const x = proj(t)
                          return (
                            <td key={t} className="max-w-[16rem] px-4 py-3 align-top">
                              {x && !x.empty && x.name ? (
                                <span className="flex flex-col items-start gap-1">
                                  <span className="line-clamp-2 font-medium">{x.name}</span>
                                  <Approval v={x.approval} />
                                </span>
                              ) : (
                                <span className="text-muted-foreground">لم يُعبّأ</span>
                              )}
                            </td>
                          )
                        })}
                        <td className="num px-4 py-3 align-top">{totalBudget(p) ? fmt(totalBudget(p)) : "—"}</td>
                        <td className="px-4 py-3 align-top text-[13px]">
                          {nx ? (
                            <span className="flex flex-col">
                              <span className="num font-medium">{formatDate(nx.dateIso!)}</span>
                              <span className="line-clamp-1 text-muted-foreground">{nx.action}</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">لا خطوات قادمة بتاريخ</span>
                          )}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3 align-top">
                      {issues > 0 && (
                        <span className="inline-flex items-center gap-1 text-[13px] text-warn" title={p?.issues?.join("\n")}>
                          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                          {issues === 1 ? "ملاحظة" : `${fmt(issues)} ملاحظات`}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}

function PlanDetail({ plan, name, onBack, onOpen, onCreate }: { plan: CsrPlan; name: string; onBack: () => void; onOpen: (i: CsrInitiative) => void; onCreate: (i: CsrInitiative) => void }) {
  const { data, canEdit } = useStore()
  const kpi = plan.kpi ?? []
  const val = (c: string) => kpi.find((k) => k.col === c)?.value ?? "—"
  const projects = (plan.projects ?? []).filter((x) => !x.empty)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-bold text-primary">
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
          كل الفروع
        </button>
        {plan.sourceUrl && (
          <a href={plan.sourceUrl} target="_blank" rel="noopener noreferrer" className={btn.small}>
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            فتح الورقة في Google Sheets
          </a>
        )}
      </div>
      <div>
        <h2 className="text-[24px] font-extrabold">{name}</h2>
        <p className="text-[14px] text-muted-foreground">
          من ورقة «{plan.sheetTitle ?? "المشاريع"}» · آخر قراءة {formatDate(plan.readAt)}
        </p>
      </div>

      {(plan.issues ?? []).length > 0 && (
        <div className="rounded-2xl border border-warn/40 bg-warn-soft px-4 py-3 text-[14px]">
          {plan.issues!.map((t) => (
            <p key={t} className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
              {t}
            </p>
          ))}
        </div>
      )}

      {plan.status === "no-link" ? (
        <Panel>
          <EmptyState title="لم يُضف رابط الخطة بعد" body="تظهر خطة الفرع هنا بعد إضافة رابطه في سجل روابط المسؤولية المجتمعية." />
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="مستهدف العام" value={val("S")} hint={`نتيجة العام السابق ${val("R")}`} />
            <Kpi label="الفصل الأول" value={val("U")} of={val("T")} />
            <Kpi label="الفصل الثاني" value={val("X")} of={val("W")} />
            <Kpi label="تحقق مستهدف العام" value={val("AC")} hint={plan.summary ? `${fmt(plan.summary.approved ?? 0)} معتمد من ${fmt(plan.summary.projects ?? 0)} حسب عدّاد الورقة` : undefined} />
          </div>
          {projects.length === 0 ? (
            <Panel>
              <EmptyState title="لم تُعبّأ الخطة بعد" body="الورقة موجودة، ولم يُكتب فيها مشروع حتى الآن." />
            </Panel>
          ) : (
            projects.map((x) => {
              const linked = data.csrInitiatives.find((i) => i.branch === plan.branch && (i.fromPlan === `${plan.branch}:${x.track}` || (x.name && i.name.trim() === x.name.trim())))
              return <ProjectCard key={x.row} x={x} linked={linked ?? null} onOpen={onOpen} onCreate={canEdit && x.track !== "other" && x.name ? () => onCreate(fromPlan(plan.branch, x)) : undefined} />
            })
          )}
        </>
      )}
    </div>
  )
}

/** A new initiative pre-filled from the plan; the editor reviews it before saving. */
function fromPlan(branch: string, x: CsrPlanProject): CsrInitiative {
  const i = blankInitiative(branch)
  // skip dates flagged as probably mistyped
  const first = x.steps.filter((s) => !s.dateFlag).map((s) => s.dateIso).filter(Boolean).sort()[0] ?? null
  return {
    ...i,
    track: x.track === "val" ? "val" : "edu",
    name: x.name,
    audience: [x.audience, x.target && `العدد المستهدف: ${x.target}`].filter(Boolean).join(" · "),
    plannedDate: first,
    notes: "أُنشئت من خطة الفرع في «المنصة الشاملة».",
    fromPlan: `${branch}:${x.track}`,
  }
}

function ProjectCard({ x, linked, onOpen, onCreate }: { x: CsrPlanProject; linked: CsrInitiative | null; onOpen: (i: CsrInitiative) => void; onCreate?: () => void }) {
  const flagged = x.steps.filter((s) => s.dateFlag).length
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-muted-foreground">{TRACK_LABEL[x.track]}</p>
          <h3 className="text-[19px] font-extrabold leading-snug">{x.name || "بلا اسم"}</h3>
          {x.trackNote && <p className="mt-0.5 text-[12px] text-muted-foreground">{x.trackNote}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Approval v={x.approval} />
          {linked ? (
            <button type="button" onClick={() => onOpen(linked)} className={btn.small}>
              مسجّلة في المبادرات
            </button>
          ) : (
            onCreate && (
              <button type="button" onClick={onCreate} className={btn.small}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                إنشاء مبادرة من الخطة
              </button>
            )
          )}
        </div>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 px-5 py-4 text-[14px] sm:grid-cols-2">
        <Field label="هدف المشروع" value={x.goal} wide />
        <Field label="وصف مختصر" value={x.description} wide />
        <Field label="الفئة المستهدفة" value={x.audience} />
        <Field label="العدد المستهدف" value={x.target} />
        <div className="sm:col-span-2">
          <dt className="text-[13px] text-muted-foreground">المؤشرات التي يخدمها</dt>
          <dd className="mt-1 flex flex-wrap gap-1.5">
            {x.indicators.length ? x.indicators.map((t) => <span key={t} className="rounded-full bg-secondary px-2.5 py-0.5 text-[13px] text-secondary-foreground">{t}</span>) : <span className="text-muted-foreground">—</span>}
          </dd>
        </div>
        <div>
          <dt className="text-[13px] text-muted-foreground">ملف المتابعة والتفاصيل</dt>
          <dd className="mt-0.5">
            {x.follow?.url ? (
              <a href={x.follow.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-primary hover:underline">
                فتح الملف
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            ) : (
              <span className="text-muted-foreground">{x.follow?.text ? `«${x.follow.text}» بلا رابط` : "لم يُضف"}</span>
            )}
          </dd>
        </div>
        {x.approvalNote && <Field label="ملاحظات الاعتماد" value={x.approvalNote} />}
      </dl>
      <div className="border-t">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-3">
          <h4 className="text-[15px] font-bold">خطة العمل</h4>
          <span className="text-[13px] text-muted-foreground">
            {fmt(x.steps.length)} خطوة{x.budget ? ` · الميزانية ${fmt(x.budget)} ريال` : ""}
            {flagged > 0 && ` · ${fmt(flagged)} بتاريخ قبل بداية العام الدراسي`}
          </span>
        </div>
        {x.steps.length === 0 ? (
          <p className="px-5 py-4 text-[14px] text-muted-foreground">لم تُكتب خطوات العمل بعد.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="mt-2 w-full min-w-[820px] border-collapse text-[13.5px]">
              <thead>
                <tr className="border-y bg-muted/50 text-[12.5px] text-muted-foreground">
                  {["الإجراء", "المكلف بالعمل", "تاريخ التنفيذ", "الميزانية", "البند", "ملاحظات الجهة الفنية", "رد المرحلة"].map((h) => (
                    <th key={h} scope="col" className="px-3 py-2 text-start font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {x.steps.map((s) => (
                  <tr key={s.row} className="border-b last:border-0 align-top">
                    <td className="px-3 py-2">{s.action || "—"}</td>
                    <td className="px-3 py-2">{s.owner || "—"}</td>
                    <td className="num whitespace-nowrap px-3 py-2">
                      {s.dateIso ? formatDate(s.dateIso) : s.date || "—"}
                      {s.dateFlag && (
                        <span className="mt-0.5 flex items-center gap-1 text-[12px] text-warn" title="التاريخ قبل بداية العام الدراسي، وقد يكون مكتوبًا بالخطأ">
                          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                          راجع التاريخ
                        </span>
                      )}
                    </td>
                    <td className="num px-3 py-2">{s.budget || "—"}</td>
                    <td className="px-3 py-2">{s.item || "—"}</td>
                    <td className="px-3 py-2">{s.tech || "—"}</td>
                    <td className="px-3 py-2">{s.reply || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Panel>
  )
}

function Field({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={cn(wide && "sm:col-span-2")}>
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line">{value || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  )
}
