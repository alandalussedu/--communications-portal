import { useState } from "react"
import { ChevronLeft, ChevronRight, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { useStore } from "@/data/store"
import type { CsrPartner } from "@/data/types"
import { PARTNER_ORGS, PARTNER_STAGES, TRACKS, blankPartner } from "@/data/csr"
import { normalize } from "@/lib/format"
import { cn } from "@/lib/utils"
import { EmptyState, Panel } from "@/components/common"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Stars, btn, fmt } from "./ui"

/** the four-stage partnership pipeline; partners proposed inside an initiative arrive as «فرصة شراكة» */
export function PartnersTab() {
  const { data, canEdit, saveCsrPartner } = useStore()
  const [editing, setEditing] = useState<CsrPartner | "new" | null>(null)
  const [busy, setBusy] = useState("")
  const nameOf = (s: string | null) => (s ? data.branches.find((b) => b.slug === s)?.name ?? s : "شراكة عامة")
  const usedIn = (p: CsrPartner) => data.csrInitiatives.filter((i) => normalize(i.partnerName) === normalize(p.name)).length
  const move = async (p: CsrPartner, dir: 1 | -1) => {
    const k = PARTNER_STAGES.findIndex((s) => s.key === p.stage) + dir
    if (k < 0 || k >= PARTNER_STAGES.length) return
    setBusy(p.id)
    await saveCsrPartner({ ...p, stage: PARTNER_STAGES[k].key }, `نُقلت إلى «${PARTNER_STAGES[k].label}»`)
    setBusy("")
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-[14px] text-muted-foreground">لا يرتبط الفرع بأي جهة ولا يستخدم شعار الشركة في مادة مشتركة قبل اعتماد الشراكة من إدارة التواصل المؤسسي.</p>
        {canEdit && (
          <button type="button" className={btn.outline} onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            شراكة جديدة
          </button>
        )}
      </div>
      {data.csrPartners.length === 0 ? (
        <Panel>
          <EmptyState title="لا توجد شراكات بعد" body="الجهات المقترحة في بطاقات المبادرات تظهر هنا تلقائيًا كفرص شراكة." />
        </Panel>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {PARTNER_STAGES.map((st, k) => {
            const list = data.csrPartners.filter((p) => p.stage === st.key).sort((a, b) => a.name.localeCompare(b.name, "ar"))
            return (
              <section key={st.key} className="rounded-2xl border bg-muted/30 p-2" aria-label={st.label}>
                <h3 className="flex items-center justify-between px-2 py-1.5 text-[15px] font-bold">
                  <span>
                    <span className="num me-1.5 text-muted-foreground">{fmt(k + 1)}.</span>
                    {st.label}
                  </span>
                  <span className="num rounded-full bg-card px-2 text-[13px] text-muted-foreground">{fmt(list.length)}</span>
                </h3>
                <ul className="space-y-2">
                  {list.map((p) => (
                    <li key={p.id} className="rounded-xl border bg-card p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[15px] font-bold leading-snug">{p.name}</p>
                          <p className="text-[12px] text-muted-foreground">{p.org} · {nameOf(p.branch)}{p.track ? ` · ${TRACKS[p.track].short}` : ""}</p>
                        </div>
                        {p.approved ? (
                          <span className="shrink-0 rounded-full bg-ok-soft px-2 py-0.5 text-[12px] font-bold text-ok">معتمدة</span>
                        ) : (
                          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[12px] text-muted-foreground">غير معتمدة</span>
                        )}
                      </div>
                      <div className="mt-2">
                        {canEdit ? <Stars value={p.quality} size="sm" onChange={(n) => void saveCsrPartner({ ...p, quality: n }, "حُفظ التقييم")} /> : <Stars value={p.quality} size="sm" />}
                      </div>
                      {p.contact && <p className="mt-1 text-[13px]">{p.contact}</p>}
                      {p.note && <p className="mt-1 whitespace-pre-line text-[13px] text-muted-foreground">{p.note}</p>}
                      {usedIn(p) > 0 && <p className="mt-1 text-[12px] text-muted-foreground">في {usedIn(p) === 1 ? "مبادرة واحدة" : `${fmt(usedIn(p))} مبادرات`}</p>}
                      {canEdit && (
                        <div className="mt-2 flex flex-wrap items-center gap-1 border-t pt-2">
                          <button type="button" disabled={k === 0 || busy === p.id} onClick={() => move(p, -1)} className="rounded-md p-2 text-muted-foreground hover:bg-accent disabled:opacity-30" aria-label="المرحلة السابقة" title="المرحلة السابقة">
                            <ChevronRight className="h-4 w-4" />
                          </button>
                          <button type="button" disabled={k === PARTNER_STAGES.length - 1 || busy === p.id} onClick={() => move(p, 1)} className="rounded-md p-2 text-muted-foreground hover:bg-accent disabled:opacity-30" aria-label="المرحلة التالية" title="المرحلة التالية">
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          {busy === p.id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                          <button
                            type="button"
                            onClick={() => void saveCsrPartner({ ...p, approved: !p.approved }, p.approved ? "أُلغي الاعتماد" : "اعتُمدت الشراكة")}
                            className={cn("ms-auto rounded-full px-3 py-1.5 text-[13px] font-bold", p.approved ? "text-muted-foreground hover:bg-accent" : "bg-primary text-primary-foreground hover:bg-primary/90")}
                          >
                            {p.approved ? "إلغاء الاعتماد" : "اعتماد"}
                          </button>
                          <button type="button" onClick={() => setEditing(p)} className="rounded-md p-2 text-muted-foreground hover:bg-accent" aria-label={`تعديل ${p.name}`} title="تعديل">
                            <Pencil className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                  {list.length === 0 && <li className="px-2 py-4 text-center text-[13px] text-muted-foreground">لا يوجد</li>}
                </ul>
              </section>
            )
          })}
        </div>
      )}
      {canEdit && editing && <PartnerSheet initial={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

const inputCls = "h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-[16px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"

function PartnerSheet({ initial, onClose }: { initial: CsrPartner | null; onClose: () => void }) {
  const { data, saveCsrPartner, deleteCsrPartner } = useStore()
  const [p, setP] = useState<CsrPartner>(() => initial ?? blankPartner())
  const [saving, setSaving] = useState(false)
  const [tried, setTried] = useState(false)
  const set = <K extends keyof CsrPartner>(k: K, v: CsrPartner[K]) => setP((x) => ({ ...x, [k]: v }))
  const dup = data.csrPartners.some((x) => x.id !== p.id && normalize(x.name) === normalize(p.name))
  const nameErr = !p.name.trim() ? "اكتب اسم الجهة." : dup ? "توجد جهة بهذا الاسم." : ""

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-lg" dir="rtl">
        <SheetHeader className="pe-8 text-start">
          <SheetTitle className="text-start text-[22px] font-bold">{initial ? "تعديل الشراكة" : "شراكة جديدة"}</SheetTitle>
          <SheetDescription className="text-start text-[15px]">بيانات الجهة ومرحلتها وتقييم الإدارة لها.</SheetDescription>
        </SheetHeader>
        <form
          className="mt-5 space-y-3"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault()
            setTried(true)
            if (nameErr) return
            setSaving(true)
            const ok = await saveCsrPartner({ ...p, name: p.name.trim(), contact: p.contact.trim(), note: p.note.trim() }, initial ? "حُفظت التعديلات" : "أُضيفت الشراكة")
            setSaving(false)
            if (ok) onClose()
          }}
        >
          <div>
            <label htmlFor="p-name" className="mb-1 block text-[14px] font-bold">اسم الجهة</label>
            <input id="p-name" value={p.name} onChange={(e) => set("name", e.target.value)} className={inputCls} aria-invalid={tried && !!nameErr} />
            {tried && nameErr && <p className="mt-1 text-[12px] font-bold text-bad" role="alert">{nameErr}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="p-org" className="mb-1 block text-[14px] font-bold">نوع الجهة</label>
              <select id="p-org" value={p.org} onChange={(e) => set("org", e.target.value)} className={inputCls}>
                {PARTNER_ORGS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="p-stage" className="mb-1 block text-[14px] font-bold">المرحلة</label>
              <select id="p-stage" value={p.stage} onChange={(e) => set("stage", e.target.value as CsrPartner["stage"])} className={inputCls}>
                {PARTNER_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="p-branch" className="mb-1 block text-[14px] font-bold">الفرع</label>
              <select id="p-branch" value={p.branch ?? ""} onChange={(e) => set("branch", e.target.value || null)} className={inputCls}>
                <option value="">شراكة عامة</option>
                {data.branches.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="p-track" className="mb-1 block text-[14px] font-bold">المسار</label>
              <select id="p-track" value={p.track ?? ""} onChange={(e) => set("track", (e.target.value || null) as CsrPartner["track"])} className={inputCls}>
                <option value="">غير محدد</option>
                <option value="edu">{TRACKS.edu.label}</option>
                <option value="val">{TRACKS.val.label}</option>
              </select>
            </div>
          </div>
          <div>
            <span className="mb-1 block text-[14px] font-bold">تقييم الإدارة</span>
            <Stars value={p.quality} onChange={(n) => set("quality", n)} />
          </div>
          <label htmlFor="p-ok" className="flex min-h-11 cursor-pointer items-center gap-3">
            <input id="p-ok" type="checkbox" checked={p.approved} onChange={(e) => set("approved", e.target.checked)} className="h-5 w-5 accent-[hsl(var(--primary))]" />
            <span className="text-[15px]">معتمدة من إدارة التواصل المؤسسي</span>
          </label>
          <div>
            <label htmlFor="p-contact" className="mb-1 block text-[14px] font-bold">جهة التواصل</label>
            <input id="p-contact" value={p.contact} onChange={(e) => set("contact", e.target.value)} className={inputCls} placeholder="الاسم أو الإدارة المعنية" />
          </div>
          <div>
            <label htmlFor="p-note" className="mb-1 block text-[14px] font-bold">ملاحظات</label>
            <textarea id="p-note" value={p.note} onChange={(e) => set("note", e.target.value)} rows={3} className="w-full rounded-lg border border-input bg-card px-3 py-2 text-[16px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30" />
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
            {initial && (
              <button
                type="button"
                className={cn(btn.danger, "me-auto")}
                onClick={async () => {
                  if (!window.confirm(`حذف شراكة «${initial.name}»؟`)) return
                  if (await deleteCsrPartner(initial.id)) onClose()
                }}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                حذف
              </button>
            )}
            <button type="button" onClick={onClose} className={btn.outline}>إلغاء</button>
            <button type="submit" disabled={saving} className={btn.primary}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {initial ? "حفظ التعديلات" : "إضافة الشراكة"}
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
