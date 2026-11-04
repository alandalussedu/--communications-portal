import { useMemo, useState } from "react"
import { ArrowDown, ArrowLeft, ArrowUp, Check, Pencil, Search, X } from "lucide-react"
import { toast } from "sonner"
import { useStore } from "@/data/store"
import type { FileItem } from "@/data/types"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"

/** Shown until an editor picks their own: the four identity items the team asked for first. */
const DEFAULT_IDS = ["f014", "f010", "f013", "f002"]
const MAX = 6
const usable = (f: FileItem) => !!f.url && f.status !== "مسودة" && f.status !== "مؤرشف"

/** The chosen quick links, in order (also offered as search suggestions in the hero). */
export function useQuickLinkItems() {
  const { data } = useStore()
  const ids = data.settings?.quickLinks ?? DEFAULT_IDS
  return useMemo(() => ids.map((id) => data.files.find((f) => f.id === id)).filter((f): f is FileItem => !!f && usable(f)), [ids, data.files])
}

export function QuickLinks() {
  const { canEdit, loaded } = useStore()
  const [editing, setEditing] = useState(false)
  const items = useQuickLinkItems()
  if (!loaded.files || !loaded.settings) return null
  if (!items.length && !canEdit) return null
  return (
    <section className="rise rounded-2xl border bg-card" aria-labelledby="quick-title">
      <div className="flex items-center justify-between gap-2 px-5 pb-1 pt-4">
        <h2 id="quick-title" className="text-[19px] font-bold">روابط سريعة</h2>
        {canEdit && (
          <button type="button" onClick={() => setEditing(true)} className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[14px] text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="تعديل الروابط السريعة">
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            تعديل
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="px-5 pb-4 pt-1 text-[15px] text-muted-foreground">لم تُختر روابط بعد.</p>
      ) : (
        <ul className="divide-y px-2 pb-2">
          {items.map((f) => (
            <li key={f.id}>
              <a href={f.url!} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 rounded-lg px-3 py-3 hover:bg-accent/60">
                <span className="h-2 w-2 shrink-0 rotate-45 bg-gold" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-[16px] font-medium">{f.title}</span>
                <ArrowLeft className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <Sheet open={editing} onOpenChange={setEditing}>
          <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-lg" dir="rtl">
            <SheetHeader className="pe-8 text-start">
              <SheetTitle className="text-start text-[22px] font-bold">الروابط السريعة</SheetTitle>
              <SheetDescription className="text-start text-[15px]">اختر حتى {MAX} عناصر من المكتبة، ورتّبها. يظهر التعديل لكل من يفتح الصفحة الرئيسية.</SheetDescription>
            </SheetHeader>
            <Editor initial={items.map((f) => f.id)} onDone={() => setEditing(false)} />
          </SheetContent>
        </Sheet>
      )}
    </section>
  )
}

function Editor({ initial, onDone }: { initial: string[]; onDone: () => void }) {
  const { data, saveSettings } = useStore()
  const [sel, setSel] = useState<string[]>(initial)
  const [q, setQ] = useState("")
  const [saving, setSaving] = useState(false)
  const files = useMemo(() => data.files.filter(usable), [data.files])
  const byId = (id: string) => files.find((f) => f.id === id)
  const shown = useMemo(() => {
    const t = q.trim()
    return files.filter((f) => !sel.includes(f.id) && (!t || f.title.includes(t) || f.group.includes(t)))
  }, [files, q, sel])
  const move = (i: number, d: -1 | 1) => setSel((s) => {
    const n = [...s]
    const j = i + d
    if (j < 0 || j >= n.length) return s
    ;[n[i], n[j]] = [n[j], n[i]]
    return n
  })
  const save = async () => {
    setSaving(true)
    const ok = await saveSettings({ quickLinks: sel })
    setSaving(false)
    if (ok) {
      toast.success("حُفظت الروابط السريعة")
      onDone()
    }
  }
  return (
    <div className="mt-5 space-y-5">
      <div>
        <p className="mb-2 text-[15px] font-bold">المختارة ({sel.length} من {MAX})</p>
        {sel.length === 0 ? (
          <p className="rounded-lg bg-muted px-3 py-3 text-[15px] text-muted-foreground">لا روابط مختارة. أضف من القائمة أدناه.</p>
        ) : (
          <ol className="divide-y rounded-xl border">
            {sel.map((id, i) => (
              <li key={id} className="flex items-center gap-2 px-3 py-2">
                <span className="num w-5 text-[14px] text-muted-foreground">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-[15px]">{byId(id)?.title ?? "عنصر غير متاح"}</span>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1.5 hover:bg-accent disabled:opacity-30" aria-label="أعلى">
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === sel.length - 1} className="rounded p-1.5 hover:bg-accent disabled:opacity-30" aria-label="أسفل">
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setSel((s) => s.filter((x) => x !== id))} className="rounded p-1.5 text-bad hover:bg-bad-soft" aria-label="إزالة">
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div>
        <label htmlFor="ql-search" className="mb-2 block text-[15px] font-bold">أضف من المكتبة</label>
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input id="ql-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم العنصر" className="h-10 w-full rounded-lg border border-input bg-card pe-3 ps-9 text-[16px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30" />
        </div>
        <ul className="mt-2 max-h-72 divide-y overflow-y-auto rounded-xl border">
          {shown.slice(0, 60).map((f) => (
            <li key={f.id}>
              <button
                type="button"
                disabled={sel.length >= MAX}
                onClick={() => setSel((s) => [...s, f.id])}
                className={cn("flex w-full items-center gap-2 px-3 py-2 text-start hover:bg-accent disabled:opacity-40")}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px]">{f.title}</span>
                  <span className="block truncate text-[13px] text-muted-foreground">{f.group}</span>
                </span>
                <Check className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </button>
            </li>
          ))}
          {shown.length === 0 && <li className="px-3 py-3 text-[15px] text-muted-foreground">لا نتائج.</li>}
        </ul>
      </div>
      <div className="flex gap-2 border-t pt-4">
        <button type="button" onClick={save} disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-[15px] font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
          حفظ الروابط
        </button>
        <button type="button" onClick={onDone} className="inline-flex h-11 items-center rounded-full border px-5 text-[15px] hover:bg-accent">
          إلغاء
        </button>
      </div>
    </div>
  )
}
