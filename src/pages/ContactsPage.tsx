import { useMemo, useState } from "react"
import { ChevronDown, Copy, ExternalLink, MessageCircle, Phone, PhoneCall, Search, X } from "lucide-react"
import { toast } from "sonner"
import { useStore } from "@/data/store"
import type { ContactBranch, ContactItem } from "@/data/types"
import { formatDate, normalize } from "@/lib/format"
import { usePersistent } from "@/lib/persist"
import { cn } from "@/lib/utils"
import { Gate } from "@/components/Gate"
import { EmptyState, PageHeader, Panel } from "@/components/common"

/**
 * «دليل أرقام الفروع»: open to everyone, no sign-in. Copied from the sheet
 * «أرقام التواصل للفروع» at each update; numbers are cleaned for display only.
 * Each number sits at the scope its merged cell covers in the sheet.
 */

export const CONTACTS_Q = "contacts-q"
const DEPT_TONE: Record<string, string> = {
  admission: "bg-sky-soft text-sky-ink",
  comms: "bg-secondary text-secondary-foreground",
  finance: "bg-gold-soft text-gold-ink",
  transport: "bg-ok-soft text-ok",
  extra: "bg-muted text-muted-foreground",
  main: "bg-primary text-primary-foreground",
}

/** 05X XXX XXXX */
export const showNumber = (n: string) => (n.length === 10 ? `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}` : n)
const waLink = (n: string) => (n.startsWith("05") ? `https://wa.me/966${n.slice(1)}` : null)

type Entry = { branch: ContactBranch; where: string; stage: string; item: ContactItem; text: string }

function entriesOf(b: ContactBranch): Entry[] {
  const out: Entry[] = []
  const add = (where: string, stage: string, item: ContactItem) =>
    out.push({ branch: b, where, stage, item, text: normalize([b.short, b.name, where, stage, item.label].join(" ")) })
  if (b.main) add("", "", { dept: "main", label: "الرقم الموحد للفرع", numbers: [b.main] })
  b.general.forEach((i) => add("", "", i))
  for (const g of b.groups) {
    const where = [g.track, g.gender].filter(Boolean).join(" · ")
    g.shared.forEach((i) => add(where, "", i))
    for (const s of g.stages) s.items.forEach((i) => add(where, s.stage, i))
  }
  return out
}

/** every word of the query must appear somewhere in the entry (branch, track, stage or department) */
const SYN: Record<string, string> = { قبول: "القبول", تسجيل: "التسجيل", ماليه: "الماليه", نقل: "النقل", حركه: "الحركه", باص: "النقل", مواصلات: "النقل", روضه: "رياض", تواصل: "التواصل" }
function hit(e: Entry, words: string[]) {
  return words.every((w) => e.text.includes(w) || (SYN[w] && e.text.includes(normalize(SYN[w]))))
}

export function ContactsPage() {
  const { data, canEdit } = useStore()
  const c = data.contacts
  const [q, setQ] = usePersistent(CONTACTS_Q, "")
  const [dept, setDept] = useState<string>("all")
  const [open, setOpen] = useState<string | null>(null)

  const branches = useMemo(() => [...(c?.branches ?? [])].sort((a, b) => a.order - b.order), [c])
  const all = useMemo(() => branches.flatMap(entriesOf), [branches])
  const words = normalize(q).split(" ").filter(Boolean)
  const searching = words.length > 0 || dept !== "all"
  const found = all.filter((e) => (dept === "all" || e.item.dept === dept || e.item.dept === "main") && (!words.length || hit(e, words)))
  const byBranch = new Map<ContactBranch, Entry[]>()
  for (const e of found) byBranch.set(e.branch, [...(byBranch.get(e.branch) ?? []), e])

  return (
    <>
      <PageHeader eyebrow="أرقام التواصل" title="دليل أرقام الفروع" description="أرقام القبول والتسجيل والتواصل المؤسسي والمالية والنقل لكل فرع ومرحلة. اضغط الرقم للاتصال مباشرة." />
      <Gate needs={["settings"]} emptyWhen={!c} emptyTitle="لم يُضف الدليل بعد" emptyBody="يظهر هنا دليل أرقام الفروع بعد أول تحديث.">
        <div className="rise sticky top-0 z-20 -mx-4 mb-5 bg-background/95 px-4 pb-3 pt-1 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:p-0">
          <div className="rounded-2xl border bg-card p-3 sm:p-4">
            <label htmlFor="contacts-q" className="sr-only">ابحث عن رقم</label>
            <div className="relative">
              <Search className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                id="contacts-q"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="مثال: مكة مالية، الزهراء قبول متوسط"
                className="h-12 w-full rounded-xl border bg-background pe-11 ps-12 text-[17px] outline-none focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/20"
              />
              {q && (
                <button type="button" onClick={() => setQ("")} className="absolute end-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-accent" aria-label="مسح البحث">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="mt-3 flex gap-1.5 overflow-x-auto [scrollbar-width:none]" role="group" aria-label="القسم">
              {[{ key: "all", label: "كل الأقسام" }, ...(c?.depts ?? [])].map((d) => (
                <button
                  key={d.key}
                  type="button"
                  aria-pressed={dept === d.key}
                  onClick={() => setDept(d.key)}
                  className={cn("inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-[14px]", dept === d.key ? "border-primary bg-primary font-bold text-primary-foreground" : "bg-card hover:bg-accent")}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {searching ? (
          found.length === 0 ? (
            <Panel>
              <EmptyState title="لا رقم يطابق البحث" body="جرّب اسم الفرع وحده، أو اختر «كل الأقسام»." action={<button type="button" onClick={() => (setQ(""), setDept("all"))} className="h-9 rounded-full border px-4 text-[14px] font-bold hover:bg-accent">عرض كل الفروع</button>} />
            </Panel>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-[14px] text-muted-foreground" role="status">{found.length} رقمًا في {byBranch.size} {byBranch.size > 2 && byBranch.size < 11 ? "فروع" : "فرع"}</p>
              {[...byBranch.entries()].map(([b, list]) => (
                <Panel key={b.name} className="rise">
                  <h2 className="border-b px-4 py-3 text-[18px] font-extrabold">{b.name}</h2>
                  <ul className="divide-y">
                    {list.map((e, k) => (
                      <li key={k} className="px-4 py-3">
                        <NumberRow item={e.item} context={[e.where, e.stage].filter(Boolean).join(" · ") || "الفرع كاملًا"} />
                      </li>
                    ))}
                  </ul>
                </Panel>
              ))}
            </div>
          )
        ) : (
          <>
            <nav aria-label="الفروع" className="mb-4 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
              {branches.map((b) => (
                <a key={b.name} href={`#contacts`} onClick={(ev) => (ev.preventDefault(), setOpen(b.name), document.getElementById(`br-${b.order}`)?.scrollIntoView({ behavior: "smooth", block: "start" }))} className="inline-flex h-9 shrink-0 items-center rounded-full bg-secondary px-3.5 text-[14px] text-secondary-foreground hover:bg-secondary/80">
                  {b.short}
                </a>
              ))}
            </nav>
            <ul className="flex flex-col gap-3">
              {branches.map((b) => (
                <li key={b.name} id={`br-${b.order}`} className="scroll-mt-24">
                  <BranchCard b={b} open={open === b.name} onToggle={() => setOpen(open === b.name ? null : b.name)} />
                </li>
              ))}
            </ul>
          </>
        )}

        {c && (
          <p className="mt-6 flex flex-wrap items-center gap-x-2 text-[13px] text-muted-foreground">
            آخر تحديث للدليل {formatDate(c.readAt)}. الأرقام من سجل «أرقام التواصل للفروع» لدى إدارة التواصل المؤسسي.
            {canEdit && c.source && (
              <a href={c.source} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-primary hover:underline">
                المصدر
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            )}
          </p>
        )}
      </Gate>
    </>
  )
}

function BranchCard({ b, open, onToggle }: { b: ContactBranch; open: boolean; onToggle: () => void }) {
  const count = entriesOf(b).length
  return (
    <Panel className={cn("rise overflow-hidden", b.empty && "opacity-70")}>
      <button type="button" onClick={onToggle} aria-expanded={open} disabled={b.empty} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-start hover:bg-accent/40 disabled:cursor-default disabled:hover:bg-transparent">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
          <PhoneCall className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[18px] font-extrabold">{b.name}</span>
          <span className="block text-[13px] text-muted-foreground">{b.empty ? "لم تُضف الأرقام بعد" : `${count} رقمًا`}</span>
        </span>
        {!b.empty && <ChevronDown className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden="true" />}
      </button>
      {open && !b.empty && (
        <div className="border-t">
          {(b.main || b.general.length > 0) && (
            <section className="px-4 py-3">
              <h3 className="mb-2 text-[13px] font-bold text-muted-foreground">للفرع كاملًا</h3>
              <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {b.main && (
                  <li className="rounded-xl border p-3">
                    <NumberRow item={{ dept: "main", label: "الرقم الموحد للفرع", numbers: [b.main] }} />
                  </li>
                )}
                {b.general.map((i) => (
                  <li key={i.dept} className="rounded-xl border p-3">
                    <NumberRow item={i} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {b.groups.map((g) => (
            <section key={g.track + g.gender} className="border-t px-4 py-3">
              <h3 className="mb-2 text-[15px] font-extrabold">{[g.track, g.gender].filter(Boolean).join(" · ")}</h3>
              {g.shared.length > 0 && (
                <ul className="mb-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {g.shared.map((i) => (
                    <li key={i.dept} className="rounded-xl border p-3">
                      <NumberRow item={i} context={g.stages.length ? "كل المراحل" : undefined} />
                    </li>
                  ))}
                </ul>
              )}
              {g.stages.length > 0 && (
                <ul className="divide-y rounded-xl border">
                  {g.stages.map((s) => (
                    <li key={s.stage} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:gap-4">
                      <span className="w-36 shrink-0 text-[15px] font-bold">{s.stage}</span>
                      <ul className="flex min-w-0 flex-1 flex-col gap-2">
                        {s.items.map((i) => (
                          <li key={i.dept}>
                            <NumberRow item={i} />
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </Panel>
  )
}

function NumberRow({ item, context }: { item: ContactItem; context?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <span className="flex min-w-0 flex-col items-start gap-0.5">
        <span className={cn("rounded-full px-2.5 py-0.5 text-[12.5px] font-bold", DEPT_TONE[item.dept] ?? DEPT_TONE.extra)}>{item.label}</span>
        {context && <span className="text-[12.5px] text-muted-foreground">{context}</span>}
      </span>
      <span className="flex flex-col items-end gap-1.5">
        {item.numbers.map((n) => (
          <span key={n} className="flex items-center gap-1">
            <a href={`tel:${n}`} className="num inline-flex h-10 items-center gap-2 rounded-full border bg-card px-3.5 text-[16px] font-bold hover:bg-accent" dir="ltr" aria-label={`اتصال ${item.label} ${showNumber(n)}`}>
              <Phone className="h-4 w-4 text-primary" aria-hidden="true" />
              {showNumber(n)}
            </a>
            {waLink(n) && (
              <a href={waLink(n)!} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ok hover:bg-ok-soft" aria-label={`واتساب ${showNumber(n)}`}>
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
              </a>
            )}
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(n).then(() => toast.success("نُسخ الرقم"), () => toast.error("لم يُنسخ الرقم"))}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
              aria-label={`نسخ ${showNumber(n)}`}
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
            </button>
          </span>
        ))}
      </span>
    </div>
  )
}
