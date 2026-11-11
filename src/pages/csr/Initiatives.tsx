import { useMemo, useState, type ReactNode } from "react"
import { AlertTriangle, ArrowRight, CalendarDays, FolderOpen, Loader2, Pencil, Plus, Trash2, Users } from "lucide-react"
import { useStore } from "@/data/store"
import type { CsrInitiative, CsrTrack } from "@/data/types"
import {
  CHARITY_RULE, CONDITIONS, CSR_YEAR, STAGES, TRACKS, blankInitiative, blankPartner, blockers, canCount, charityConflict, conditions,
  evCount, evidenceItems, hasPartner, isCounted, lateness, scoreOne, stageOf, todayIso,
} from "@/data/csr"
import { matches, normalize } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Banner, ChipGroup, EmptyState, OpenLink, Panel, PanelHeader, SearchField, SelectField } from "@/components/common"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { StageChip, Stepper, Tick, btn, fmt, fmtDate } from "./ui"

/* ------------------------------------------------------------ list */
export function InitiativesTab({ branch, setBranch, onOpen, onNew }: { branch: string; setBranch: (s: string) => void; onOpen: (i: CsrInitiative) => void; onNew: () => void }) {
  const { data, canEdit } = useStore()
  const [track, setTrack] = useState<"all" | CsrTrack>("all")
  const [stage, setStage] = useState("all")
  const [q, setQ] = useState("")
  const all = useMemo(() => data.csrInitiatives.filter((i) => i.year === CSR_YEAR), [data.csrInitiatives])
  const nameOf = (s: string) => data.branches.find((b) => b.slug === s)?.name ?? s
  const order = new Map(data.branches.map((b, k) => [b.slug, k]))
  const list = all
    .filter((i) => !branch || i.branch === branch)
    .filter((i) => track === "all" || i.track === track)
    .filter((i) => stage === "all" || (stage === "rejected" ? i.decision === "rejected" : i.decision !== "rejected" && String(stageOf(i)) === stage))
    .filter((i) => !q || matches(q, i.name, i.audience, i.partnerName, nameOf(i.branch)))
    .sort((a, b) => (order.get(a.branch) ?? 99) - (order.get(b.branch) ?? 99) || a.track.localeCompare(b.track) || b.updatedAt.localeCompare(a.updatedAt))
  const filtered = !!(branch || track !== "all" || stage !== "all" || q)

  return (
    <div className="space-y-4">
      <Panel className="flex flex-wrap items-end gap-3 p-3">
        <SearchField id="csr-q" value={q} onChange={setQ} placeholder="ابحث باسم المبادرة أو الجهة" className="min-w-[220px] flex-1" />
        <SelectField id="csr-b" label="الفرع" value={branch} onChange={setBranch} options={[{ value: "", label: "كل الفروع" }, ...data.branches.map((b) => ({ value: b.slug, label: b.name }))]} />
        <SelectField
          id="csr-s"
          label="المرحلة"
          value={stage}
          onChange={setStage}
          options={[{ value: "all", label: "كل المراحل" }, ...STAGES.map((s, k) => ({ value: String(k), label: s })), { value: "rejected", label: "غير محتسبة" }]}
        />
        <div className="w-full">
          <ChipGroup label="المسار" value={track} onChange={setTrack} options={[{ value: "all", label: "الكل" }, { value: "edu", label: TRACKS.edu.label }, { value: "val", label: TRACKS.val.label }]} />
        </div>
      </Panel>

      {list.length === 0 ? (
        <Panel>
          <EmptyState
            title={filtered ? "لا توجد مبادرات بهذه التصفية" : "لا توجد مبادرات مسجّلة بعد"}
            body={filtered ? "غيّر التصفية أو امسحها." : canEdit ? "سجّل أول مبادرة من خطة أحد الفروع." : "يسجّل فريق إدارة التواصل المؤسسي مبادرات الفروع هنا."}
            action={
              filtered ? (
                <button type="button" className={btn.outline} onClick={() => (setBranch(""), setTrack("all"), setStage("all"), setQ(""))}>مسح التصفية</button>
              ) : canEdit ? (
                <button type="button" className={btn.primary} onClick={onNew}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  مبادرة جديدة
                </button>
              ) : undefined
            }
          />
        </Panel>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {list.map((i) => {
            const s = scoreOne(i), lt = lateness(i)
            return (
              <li key={i.id}>
                <button type="button" onClick={() => onOpen(i)} className="flex h-full w-full flex-col gap-2 rounded-2xl border bg-card p-4 text-start transition-colors hover:border-primary/40 hover:bg-accent/30">
                  <div className="flex w-full items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] text-muted-foreground">{nameOf(i.branch)} · {TRACKS[i.track].label}</p>
                      <p className="text-[17px] font-bold leading-snug">{i.name || "بلا اسم"}</p>
                    </div>
                    <StageChip i={i} className="shrink-0" />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                      {i.status === "done" ? `نُفذت ${fmtDate(i.executedDate)}` : i.plannedDate ? `مخطط ${fmtDate(i.plannedDate)}` : "بلا تاريخ"}
                    </span>
                    {i.status === "done" && (
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="num">{fmt(i.beneficiaries ?? 0)}</span> مستفيد
                      </span>
                    )}
                    {i.status === "done" && <span className="num">الشواهد {fmt(evCount(i))}/5</span>}
                  </div>
                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                    {s.counted && <span className="num rounded-full bg-ok-soft px-2.5 py-0.5 text-[13px] font-bold text-ok">{fmt(s.total)} / 50</span>}
                    {lt.late && i.decision === null && <span className="rounded-full bg-bad-soft px-2.5 py-0.5 text-[12px] font-bold text-bad">تجاوزت أسبوعين</span>}
                    {i.charity && <span className="rounded-full bg-gold-soft px-2.5 py-0.5 text-[12px] font-medium text-gold-ink">عمل خيري مدمج</span>}
                    {hasPartner(i) && <span className="rounded-full bg-muted px-2.5 py-0.5 text-[12px] text-muted-foreground">شراكة: {i.partnerName}</span>}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/* ------------------------------------------------------------ detail */
export function InitiativeDetail({ id, onBack, onEdit }: { id: string; onBack: () => void; onEdit: (i: CsrInitiative) => void }) {
  const { data, canEdit, member, saveCsrInitiative, deleteCsrInitiative } = useStore()
  const i = data.csrInitiatives.find((x) => x.id === id)
  const [busy, setBusy] = useState("")
  const [deciding, setDeciding] = useState(false)
  if (!i)
    return (
      <Panel>
        <EmptyState title="المبادرة غير موجودة" body="ربما حُذفت." action={<button type="button" className={btn.outline} onClick={onBack}>كل المبادرات</button>} />
      </Panel>
    )
  const branchName = data.branches.find((b) => b.slug === i.branch)?.name ?? i.branch
  const c = conditions(i), s = scoreOne(i), lt = lateness(i), block = blockers(i)
  const conflict = charityConflict(i, data.csrInitiatives)
  const who = member.name ?? "فريق الإدارة"
  const now = () => new Date().toISOString()
  const run = async (key: string, next: CsrInitiative, ok: string) => {
    setBusy(key)
    await saveCsrInitiative(next, ok)
    setBusy("")
    setDeciding(false)
  }
  const ev = evidenceItems(i)

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-bold text-primary">
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
        كل المبادرات
      </button>

      <Panel className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[14px] text-muted-foreground">{branchName} · {TRACKS[i.track].label}</p>
            <h2 className="text-[24px] font-extrabold leading-snug">{i.name || "بلا اسم"}</h2>
            {i.audience && <p className="mt-0.5 text-[15px] text-muted-foreground">الفئة المستهدفة: {i.audience}</p>}
          </div>
          <div className="text-end">
            <p className="num text-[32px] font-extrabold leading-none">
              {fmt(s.total)}
              <span className="text-[15px] font-medium text-muted-foreground"> / 50</span>
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">{s.counted ? "درجة المبادرة" : "تُحسب بعد الاحتساب"}</p>
          </div>
        </div>
        <div className="mt-5">
          <Stepper i={i} />
        </div>
      </Panel>

      {canEdit && (
        <Panel className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            {!i.planApproved ? (
              <button type="button" disabled={!!busy} className={btn.primary} onClick={() => run("plan", { ...i, planApproved: true, planApprovedAt: now(), planApprovedBy: who }, "اعتُمدت الخطة")}>
                {busy === "plan" && <Loader2 className="h-4 w-4 animate-spin" />}
                اعتماد الخطة
              </button>
            ) : i.decision === null ? (
              <button type="button" disabled={!!busy || !canCount(i)} className={btn.primary} onClick={() => setDeciding(true)} title={canCount(i) ? undefined : block.join(" ")}>
                قرار الاحتساب
              </button>
            ) : (
              <button type="button" disabled={!!busy} className={btn.outline} onClick={() => run("undo", { ...i, decision: null, decidedAt: null, decidedBy: null, decidedLate: false }, "أُلغي القرار")}>
                {busy === "undo" && <Loader2 className="h-4 w-4 animate-spin" />}
                إلغاء قرار الإدارة
              </button>
            )}
            <button type="button" className={btn.outline} onClick={() => onEdit(i)}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
              تعديل
            </button>
            {i.planApproved && i.decision === null && (
              <button type="button" disabled={!!busy} className={btn.outline} onClick={() => run("unplan", { ...i, planApproved: false, planApprovedAt: null, planApprovedBy: null }, "أُلغي اعتماد الخطة")}>
                إلغاء اعتماد الخطة
              </button>
            )}
            <button
              type="button"
              disabled={!!busy}
              className={cn(btn.danger, "ms-auto")}
              onClick={async () => {
                if (!window.confirm(`حذف مبادرة «${i.name}» نهائيًا؟`)) return
                setBusy("del")
                if (await deleteCsrInitiative(i.id)) onBack()
                setBusy("")
              }}
            >
              {busy === "del" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
              حذف
            </button>
          </div>
          {i.planApproved && i.decision === null && block.length > 0 && (
            <ul className="mt-3 list-inside list-disc space-y-0.5 text-[14px] text-muted-foreground">
              {block.map((b) => <li key={b}>{b}</li>)}
            </ul>
          )}
          {deciding && (
            <div className="mt-4 space-y-3 rounded-xl border bg-muted/40 p-4">
              <p className="text-[16px] font-bold">قرار احتساب «{i.name}»</p>
              {lt.late && (
                <Banner tone="bad" title="الشواهد تجاوزت أسبوعين من التنفيذ">
                  {i.evidenceDate ? `نُفذت ${fmtDate(i.executedDate)} ورُفعت الشواهد ${fmtDate(i.evidenceDate)}.` : `نُفذت ${fmtDate(i.executedDate)} ولم يُسجّل تاريخ رفع الشواهد.`} الشرط الخامس في الدليل: الشواهد مرفوعة خلال أسبوعين.
                </Banner>
              )}
              {evCount(i) < 5 && (
                <Banner title={`الشواهد المكتملة ${fmt(evCount(i))} من 5`}>درجة التوثيق تُحسب بنسبة المكتمل: {fmt(scoreDocsIf(i))} من 17.5.</Banner>
              )}
              {conflict && <Banner title="العمل الخيري المدمج احتُسب لهذا الفرع من قبل هذا العام">{CHARITY_RULE}</Banner>}
              {!lt.late && evCount(i) === 5 && !conflict && <p className="text-[15px] text-ok">الشروط الخمسة متحققة.</p>}
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={!!busy} className={btn.primary} onClick={() => run("count", { ...i, decision: "counted", decidedAt: now(), decidedBy: who, decidedLate: lt.late }, "احتُسبت المبادرة")}>
                  {busy === "count" && <Loader2 className="h-4 w-4 animate-spin" />}
                  {lt.late ? "احتسابها رغم التأخر" : "احتسابها"}
                </button>
                <button type="button" disabled={!!busy} className={btn.danger} onClick={() => run("reject", { ...i, decision: "rejected", decidedAt: now(), decidedBy: who, decidedLate: lt.late }, "سُجّل عدم الاحتساب")}>
                  {busy === "reject" && <Loader2 className="h-4 w-4 animate-spin" />}
                  عدم احتسابها
                </button>
                <button type="button" className={btn.outline} onClick={() => setDeciding(false)}>إلغاء</button>
              </div>
            </div>
          )}
        </Panel>
      )}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="البيانات" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-5 py-4 text-[15px]">
            <Fact label="التاريخ المخطط">{fmtDate(i.plannedDate)}</Fact>
            <Fact label="تاريخ التنفيذ">{i.status === "done" ? fmtDate(i.executedDate) : "لم تُنفّذ"}</Fact>
            <Fact label="المستفيدون">{i.beneficiaries === null ? "—" : fmt(i.beneficiaries)}</Fact>
            <Fact label="طريقة الحصر">{i.countMethod || "—"}</Fact>
            <Fact label="الطلاب المتطوعون">{i.students === null ? "—" : fmt(i.students)}</Fact>
            <Fact label="المنسوبون المتطوعون">{i.staff === null ? "—" : fmt(i.staff)}</Fact>
            <Fact label="الساعات التطوعية">{i.hours === null ? "—" : fmt(i.hours)}</Fact>
            <Fact label="التكلفة">{i.cost === null ? "—" : `${fmt(i.cost)} ريال`}</Fact>
            <Fact label="تاريخ رفع الشواهد">{fmtDate(i.evidenceDate)}</Fact>
            <Fact label="الجهة الشريكة">{i.partnerName || "لا توجد"}</Fact>
            {i.charity && <Fact label="العمل الخيري">مدمج مع مكوّن {TRACKS[i.track].short}</Fact>}
          </dl>
          {(i.planApprovedBy || i.decidedBy) && (
            <div className="space-y-1 border-t px-5 py-3 text-[13px] text-muted-foreground">
              {i.planApprovedBy && <p>اعتمد الخطة: {i.planApprovedBy} · {fmtDate(i.planApprovedAt?.slice(0, 10))}</p>}
              {i.decidedBy && (
                <p>
                  {i.decision === "counted" ? "احتسبها" : "قرر عدم احتسابها"}: {i.decidedBy} · {fmtDate(i.decidedAt?.slice(0, 10))}
                  {i.decidedLate ? " · والشواهد متأخرة عن أسبوعين" : ""}
                </p>
              )}
            </div>
          )}
          {i.notes && <p className="whitespace-pre-line border-t px-5 py-3 text-[14px]">{i.notes}</p>}
        </Panel>

        <div className="space-y-4">
          <Panel>
            <PanelHeader title="الشروط الخمسة" />
            <ul className="px-5 py-2">
              {CONDITIONS.map((k) => (
                <Tick key={k.key} ok={c[k.key]} sub={k.key === "documented" && lt.late ? "تجاوزت أسبوعين — القرار للإدارة" : k.key === "planned" && i.inPlan && !i.planApproved ? "بانتظار اعتماد الإدارة" : k.detail}>
                  {k.label}
                </Tick>
              ))}
            </ul>
          </Panel>
          <Panel>
            <PanelHeader
              title="الشواهد الخمسة"
              hint={i.status === "done" ? `${fmt(evCount(i))} من 5 مكتملة` : "تُستكمل بعد التنفيذ"}
              actions={<OpenLink href={/^https?:\/\//.test(i.evidenceLink) ? i.evidenceLink : null} size="sm"><FolderOpen className="h-4 w-4" aria-hidden="true" />مجلد الشواهد</OpenLink>}
            />
            <ul className="px-5 py-2">
              {ev.map((e) => (
                <Tick key={e.key} ok={i.status !== "done" ? false : e.key === "partner" && !hasPartner(i) ? null : e.done} sub={e.key === "partner" && !hasPartner(i) ? "لا توجد شراكة، فيُعدّ مكتملًا" : e.detail}>
                  {e.label}
                </Tick>
              ))}
            </ul>
          </Panel>
          <Panel>
            <PanelHeader title="الدرجة من 50" hint={s.counted ? undefined : "تُحسب الدرجة عندما تحتسبها الإدارة."} />
            <dl className="grid grid-cols-3 gap-2 px-5 py-4 text-center">
              {[
                ["الالتزام", s.compliance, 20],
                ["التوثيق", s.docs, 17.5],
                ["الوصول", s.access, 12.5],
              ].map(([l, v, of]) => (
                <div key={l as string} className="rounded-xl bg-muted/50 py-2.5">
                  <dd className="num text-[20px] font-extrabold">{fmt(v as number)}<span className="text-[13px] font-medium text-muted-foreground">/{of}</span></dd>
                  <dt className="text-[13px] text-muted-foreground">{l}</dt>
                </div>
              ))}
            </dl>
            <p className="border-t px-5 py-2.5 text-[12px] leading-relaxed text-muted-foreground">التوثيق = 17.5 × (الشواهد المكتملة ÷ 5). الوصول = 12.5 × (المستفيدون ÷ 200) بحد أقصى 12.5.</p>
          </Panel>
        </div>
      </div>
    </div>
  )
}

const scoreDocsIf = (i: CsrInitiative) => Math.round(17.5 * (evCount(i) / 5) * 100) / 100

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="num mt-0.5 break-words font-medium">{children}</dd>
    </div>
  )
}

/* ------------------------------------------------------------ form */
const inputCls = "h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-[16px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 aria-[invalid=true]:border-bad"

function L({ id, label, hint, children, className }: { id: string; label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={id} className="mb-1 block text-[14px] font-bold">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[12px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

function Check({ id, checked, onChange, children, sub, disabled }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: ReactNode; sub?: string; disabled?: boolean }) {
  return (
    <label htmlFor={id} className={cn("flex min-h-11 cursor-pointer items-start gap-3 rounded-lg px-1 py-2 hover:bg-accent/40", disabled && "cursor-not-allowed opacity-60")}>
      <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[hsl(var(--primary))]" />
      <span className="text-[15px]">
        {children}
        {sub && <span className="block text-[12px] text-muted-foreground">{sub}</span>}
      </span>
    </label>
  )
}

const numOrNull = (v: string): number | null => {
  if (v.trim() === "") return null
  const n = Number(v.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))))
  return Number.isFinite(n) && n >= 0 ? n : null
}

export function InitiativeSheet({ initial, prefill, defaultBranch, onClose, onSaved }: { initial: CsrInitiative | null; prefill?: CsrInitiative | null; defaultBranch: string; onClose: () => void; onSaved: (i: CsrInitiative) => void }) {
  const { data, saveCsrInitiative, saveCsrPartner } = useStore()
  const [f, setF] = useState<CsrInitiative>(() => initial ?? prefill ?? blankInitiative(defaultBranch || ""))
  const [nums, setNums] = useState(() => ({
    beneficiaries: f.beneficiaries?.toString() ?? "", students: f.students?.toString() ?? "", staff: f.staff?.toString() ?? "", hours: f.hours?.toString() ?? "", cost: f.cost?.toString() ?? "",
  }))
  const [saving, setSaving] = useState(false)
  const [tried, setTried] = useState(false)
  const set = <K extends keyof CsrInitiative>(k: K, v: CsrInitiative[K]) => setF((x) => ({ ...x, [k]: v }))
  const setEv = (k: keyof CsrInitiative["ev"], v: boolean) => setF((x) => ({ ...x, ev: { ...x.ev, [k]: v } }))

  const draft: CsrInitiative = {
    ...f,
    name: f.name.trim(), audience: f.audience.trim(), partnerName: f.partnerName.trim(), countMethod: f.countMethod.trim(), evidenceLink: f.evidenceLink.trim(), notes: f.notes.trim(),
    beneficiaries: numOrNull(nums.beneficiaries), students: numOrNull(nums.students), staff: numOrNull(nums.staff), hours: numOrNull(nums.hours), cost: numOrNull(nums.cost),
    ...(f.status === "planned" ? { executedDate: null, evidenceDate: null } : {}),
  }
  const errors: Partial<Record<string, string>> = {}
  if (!draft.branch) errors.branch = "اختر الفرع."
  if (!draft.name) errors.name = "اكتب اسم المبادرة."
  if (draft.status === "done") {
    if (!draft.executedDate) errors.executedDate = "أدخل تاريخ التنفيذ الفعلي."
    else if (draft.executedDate > todayIso()) errors.executedDate = "تاريخ التنفيذ في المستقبل."
    if (draft.evidenceDate && draft.executedDate && draft.evidenceDate < draft.executedDate) errors.evidenceDate = "تاريخ الشواهد قبل تاريخ التنفيذ."
    if (draft.evidenceLink && !/^https?:\/\//.test(draft.evidenceLink)) errors.evidenceLink = "الرابط يبدأ بـ https://"
  }
  for (const k of Object.keys(nums) as (keyof typeof nums)[]) if (nums[k].trim() && numOrNull(nums[k]) === null) errors[k] = "رقم صحيح أو عشري غير سالب."
  const ok = Object.keys(errors).length === 0
  const err = (k: string) => (tried && errors[k] ? <p className="mt-1 text-[12px] font-bold text-bad" role="alert">{errors[k]}</p> : null)

  // live «هل تُحتسب؟»
  const block = blockers(draft), lt = lateness(draft)
  const conflict = draft.charity && data.csrInitiatives.some((x) => x.id !== draft.id && x.branch === draft.branch && x.year === draft.year && x.charity && isCounted(x))
  const preview = scoreOne({ ...draft, decision: "counted" })

  const save = async () => {
    setTried(true)
    if (!ok) return
    setSaving(true)
    let next = draft
    // a counted initiative that no longer meets conditions 1–4 goes back to the management's decision
    if (next.decision === "counted" && !canCount(next)) next = { ...next, decision: null, decidedAt: null, decidedBy: null, decidedLate: false }
    const done = await saveCsrInitiative(next, initial ? "حُفظت التعديلات" : "سُجّلت المبادرة")
    if (done && next.partnerName && !data.csrPartners.some((p) => normalize(p.name) === normalize(next.partnerName))) {
      await saveCsrPartner({ ...blankPartner(), name: next.partnerName, branch: next.branch, track: next.track, note: `مقترحة في مبادرة «${next.name}»` }, "أُضيفت الجهة إلى الشراكات كفرصة شراكة")
    }
    setSaving(false)
    if (done) onSaved(next)
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-2xl" dir="rtl">
        <SheetHeader className="pe-8 text-start">
          <SheetTitle className="text-start text-[22px] font-bold">{initial ? "تعديل المبادرة" : "مبادرة جديدة"}</SheetTitle>
          <SheetDescription className="text-start text-[15px]">الخطة أولًا، ثم بيانات التنفيذ والشواهد بعد تنفيذها.</SheetDescription>
        </SheetHeader>

        <form className="mt-5 space-y-6" onSubmit={(e) => (e.preventDefault(), void save())} noValidate>
          <section className="space-y-3">
            <h3 className="text-[17px] font-extrabold text-primary">١. الخطة</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <L id="f-branch" label="الفرع">
                <select id="f-branch" value={f.branch} onChange={(e) => set("branch", e.target.value)} className={inputCls} aria-invalid={tried && !!errors.branch}>
                  <option value="">اختر الفرع</option>
                  {data.branches.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}
                </select>
                {err("branch")}
              </L>
              <div className="min-w-0">
                <span className="mb-1 block text-[14px] font-bold">المسار</span>
                <div className="grid grid-cols-2 gap-1 rounded-lg border p-1" role="radiogroup" aria-label="المسار">
                  {(["edu", "val"] as const).map((t) => (
                    <button key={t} type="button" role="radio" aria-checked={f.track === t} onClick={() => set("track", t)} className={cn("h-9 rounded-md text-[14px]", f.track === t ? "bg-primary font-bold text-primary-foreground" : "hover:bg-accent")}>
                      {TRACKS[t].short}
                    </button>
                  ))}
                </div>
              </div>
              <L id="f-name" label="اسم المبادرة" className="sm:col-span-2">
                <input id="f-name" value={f.name} onChange={(e) => set("name", e.target.value)} className={inputCls} aria-invalid={tried && !!errors.name} />
                {err("name")}
              </L>
              <L id="f-aud" label="الفئة المستهدفة" hint="من خارج طلاب المدرسة ومنسوبيها">
                <input id="f-aud" value={f.audience} onChange={(e) => set("audience", e.target.value)} className={inputCls} />
              </L>
              <L id="f-pdate" label="التاريخ المخطط">
                <input id="f-pdate" type="date" value={f.plannedDate ?? ""} onChange={(e) => set("plannedDate", e.target.value || null)} className={inputCls} dir="ltr" />
              </L>
              <L id="f-partner" label="الجهة الشريكة المقترحة" hint="اتركها فارغة إن لم توجد. الجهة الجديدة تظهر في «الشراكات» كفرصة شراكة." className="sm:col-span-2">
                <input id="f-partner" value={f.partnerName} onChange={(e) => set("partnerName", e.target.value)} className={inputCls} list="csr-partners" />
                <datalist id="csr-partners">{data.csrPartners.map((p) => <option key={p.id} value={p.name} />)}</datalist>
              </L>
            </div>
            <div className="rounded-xl border px-3 py-1">
              <Check id="f-inplan" checked={f.inPlan} onChange={(v) => set("inPlan", v)} sub="الشرط الأول">ضمن الخطة السنوية المعتمدة للفرع</Check>
              <Check id="f-ext" checked={f.external} onChange={(v) => set("external", v)} sub="الشرط الثاني">تستهدف المجتمع الخارجي</Check>
              <Check id="f-free" checked={f.free} onChange={(v) => set("free", v)} sub="الشرط الرابع">مجانية، لا رسوم على المستفيد إطلاقًا</Check>
              <Check id="f-charity" checked={f.charity} onChange={(v) => set("charity", v)} sub="عمل خيري أُضيف إليه مكوّن من المسار المختار">عمل خيري مدمج</Check>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-[17px] font-extrabold text-primary">٢. التنفيذ والشواهد</h3>
            <div className="grid grid-cols-2 gap-1 rounded-lg border p-1" role="radiogroup" aria-label="حالة التنفيذ">
              {(["planned", "done"] as const).map((st) => (
                <button key={st} type="button" role="radio" aria-checked={f.status === st} onClick={() => set("status", st)} className={cn("h-10 rounded-md text-[15px]", f.status === st ? "bg-primary font-bold text-primary-foreground" : "hover:bg-accent")}>
                  {st === "planned" ? "لم تُنفّذ بعد" : "نُفذت"}
                </button>
              ))}
            </div>
            {f.status === "done" && (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <L id="f-xdate" label="تاريخ التنفيذ الفعلي">
                    <input id="f-xdate" type="date" value={f.executedDate ?? ""} max={todayIso()} onChange={(e) => set("executedDate", e.target.value || null)} className={inputCls} dir="ltr" aria-invalid={tried && !!errors.executedDate} />
                    {err("executedDate")}
                  </L>
                  <L id="f-edate" label="تاريخ رفع الشواهد" hint={lt.due ? `المهلة حتى ${fmtDate(lt.due)}` : undefined}>
                    <input id="f-edate" type="date" value={f.evidenceDate ?? ""} onChange={(e) => set("evidenceDate", e.target.value || null)} className={inputCls} dir="ltr" aria-invalid={tried && !!errors.evidenceDate} />
                    {err("evidenceDate")}
                  </L>
                  <L id="f-ben" label="عدد المستفيدين">
                    <input id="f-ben" inputMode="numeric" value={nums.beneficiaries} onChange={(e) => setNums((n) => ({ ...n, beneficiaries: e.target.value }))} className={inputCls} dir="ltr" aria-invalid={tried && !!errors.beneficiaries} />
                    {err("beneficiaries")}
                  </L>
                  <L id="f-method" label="كيف حُصر العدد">
                    <input id="f-method" value={f.countMethod} onChange={(e) => set("countMethod", e.target.value)} className={inputCls} placeholder="كشف حضور، تسجيل إلكتروني…" />
                  </L>
                  <L id="f-stu" label="الطلاب المتطوعون">
                    <input id="f-stu" inputMode="numeric" value={nums.students} onChange={(e) => setNums((n) => ({ ...n, students: e.target.value }))} className={inputCls} dir="ltr" aria-invalid={tried && !!errors.students} />
                    {err("students")}
                  </L>
                  <L id="f-staff" label="المنسوبون المتطوعون">
                    <input id="f-staff" inputMode="numeric" value={nums.staff} onChange={(e) => setNums((n) => ({ ...n, staff: e.target.value }))} className={inputCls} dir="ltr" aria-invalid={tried && !!errors.staff} />
                    {err("staff")}
                  </L>
                  <L id="f-hours" label="الساعات التطوعية">
                    <input id="f-hours" inputMode="decimal" value={nums.hours} onChange={(e) => setNums((n) => ({ ...n, hours: e.target.value }))} className={inputCls} dir="ltr" aria-invalid={tried && !!errors.hours} />
                    {err("hours")}
                  </L>
                  <L id="f-cost" label="التكلفة (ريال)">
                    <input id="f-cost" inputMode="decimal" value={nums.cost} onChange={(e) => setNums((n) => ({ ...n, cost: e.target.value }))} className={inputCls} dir="ltr" aria-invalid={tried && !!errors.cost} />
                    {err("cost")}
                  </L>
                  <L id="f-link" label="رابط مجلد الشواهد في Drive" className="sm:col-span-2">
                    <input id="f-link" type="url" value={f.evidenceLink} onChange={(e) => set("evidenceLink", e.target.value)} className={inputCls} dir="ltr" placeholder="https://drive.google.com/…" aria-invalid={tried && !!errors.evidenceLink} />
                    {err("evidenceLink")}
                  </L>
                </div>
                <div className="rounded-xl border px-3 py-1">
                  <p className="px-1 pt-2 text-[14px] font-bold">الشواهد المكتملة في المجلد</p>
                  {evidenceItems(draft).map((e) => {
                    const noPartner = e.key === "partner" && !hasPartner(draft)
                    return (
                      <Check key={e.key} id={`f-ev-${e.key}`} checked={noPartner ? true : f.ev[e.key]} disabled={noPartner} onChange={(v) => setEv(e.key, v)} sub={noPartner ? "لا توجد شراكة، فيُعدّ مكتملًا" : e.detail}>
                        {e.label}
                      </Check>
                    )
                  })}
                </div>
              </>
            )}
            <L id="f-notes" label="ملاحظات">
              <textarea id="f-notes" value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={3} className="w-full rounded-lg border border-input bg-card px-3 py-2 text-[16px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30" />
            </L>
          </section>

          <section className="rounded-xl bg-muted/50 p-4" aria-live="polite">
            <p className="flex items-center gap-2 text-[16px] font-extrabold">هل تُحتسب؟</p>
            {block.length ? (
              <ul className="mt-2 list-inside list-disc space-y-0.5 text-[14px] text-muted-foreground">
                {block.map((b) => <li key={b}>{b}</li>)}
              </ul>
            ) : (
              <p className="mt-1 text-[14px] text-ok">الشروط تسمح باحتسابها، والقرار لفريق الإدارة.</p>
            )}
            {lt.late && (
              <p className="mt-2 flex items-start gap-1.5 text-[14px] text-bad">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                الشواهد تجاوزت أسبوعين من التنفيذ. تنبيه فقط، والقرار للإدارة.
              </p>
            )}
            {conflict && (
              <p className="mt-2 flex items-start gap-1.5 text-[14px] text-warn">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                احتُسب عمل خيري مدمج لهذا الفرع من قبل هذا العام، والمسموح مرة واحدة.
              </p>
            )}
            {draft.status === "done" && (
              <p className="num mt-2 text-[14px]">
                الدرجة إن احتُسبت: <b>{fmt(preview.total)}</b> من 50 (الالتزام {fmt(preview.compliance)} · التوثيق {fmt(preview.docs)} · الوصول {fmt(preview.access)})
              </p>
            )}
          </section>

          {tried && !ok && <p className="text-[14px] font-bold text-bad" role="alert">صحّح الحقول المعلَّمة ثم احفظ.</p>}
          <div className="sticky bottom-0 -mx-6 flex justify-end gap-2 border-t bg-background px-6 py-3">
            <button type="button" onClick={onClose} className={btn.outline}>إلغاء</button>
            <button type="submit" disabled={saving} className={btn.primary}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {initial ? "حفظ التعديلات" : "تسجيل المبادرة"}
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

