import { useMemo, useState } from "react"
import { Check, Download, FileText, FileType2, Folder, LayoutGrid, List, Pencil, Plus, Search, Settings2, Tags, X } from "lucide-react"
import { useStore } from "@/data/store"
import { LIBRARY_SECTIONS, type FileItem, type FileStatus, type LibrarySection } from "@/data/types"
import { useRouter } from "@/lib/router"
import { formatDate, formatNumber } from "@/lib/format"
import { FILE_KIND_LABEL, downloadUrl, searchFiles } from "@/lib/search"
import { usePersistent } from "@/lib/persist"
import { cn } from "@/lib/utils"
import { Gate } from "@/components/Gate"
import { DataTable, type Column } from "@/components/DataTable"
import { CopyButton, EmptyState, OpenLink, PageHeader, Panel, Pill, type Tone } from "@/components/common"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { FileForm, SynonymsForm } from "@/components/admin"
import { ShareButton } from "@/components/ShareButton"
import { Pill as SlidePill, useSlidingPill } from "@/lib/motion"


const STATUS_TONE: Record<FileStatus, Tone> = { معتمد: "ok", مسودة: "warn", مؤرشف: "neutral" }

type SectionFilter = "all" | LibrarySection | "none"
const SECTION_LABEL: Record<LibrarySection, string> = Object.fromEntries(LIBRARY_SECTIONS.map((s) => [s.key, s.label])) as Record<LibrarySection, string>
const isSection = (v: string | undefined): v is LibrarySection => LIBRARY_SECTIONS.some((s) => s.key === v)

export function LibraryPage({ section: routeSection }: { section?: string }) {
  const { data, canEdit, saveFileSections } = useStore()
  const { go } = useRouter()
  const sec: SectionFilter = isSection(routeSection) ? routeSection : routeSection === "none" ? "none" : "all"
  const setSec = (v: SectionFilter) => go({ page: "library", section: v === "all" ? undefined : v })
  const secPill = useSlidingPill<HTMLDivElement>(sec)
  const [classifying, setClassifying] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [savingSec, setSavingSec] = useState(false)
  const [q, setQ] = usePersistent("lib-q", "")
  const [view, setView] = usePersistent<"cards" | "table">("lib-view", "cards")
  const [editing, setEditing] = useState<FileItem | "new" | "synonyms" | null>(null)

  const files = data.files
  const synonyms = data.settings?.synonyms ?? []
  const groups = useMemo(() => Array.from(new Set(files.map((f) => f.group))), [files])

  const hits = useMemo(() => searchFiles(files, q, synonyms), [files, q, synonyms])
  // Sections are the only filter; drafts and archived copies show to editors only.
  const pass = (f: FileItem, skip?: string) =>
    (skip === "section" || sec === "all" || (sec === "none" ? !f.section : f.section === sec)) && (canEdit || !(f.status === "مسودة" || f.status === "مؤرشف"))

  const visible = useMemo(() => {
    const list = hits.filter((h) => pass(h.f))
    return q ? list : [...list].sort((a, b) => a.f.order - b.f.order)
  }, [hits, sec, q, canEdit]) // eslint-disable-line react-hooks/exhaustive-deps

  const countFor = (skip: string, test: (f: FileItem) => boolean) => hits.filter((h) => pass(h.f, skip) && test(h.f)).length

  const togglePick = (id: string) =>
    setPicked((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const applySection = async (v: LibrarySection | null) => {
    if (!picked.size) return
    setSavingSec(true)
    const ok = await saveFileSections([...picked], v)
    setSavingSec(false)
    if (ok) setPicked(new Set())
  }
  const sectionMeta = sec !== "all" && sec !== "none" ? LIBRARY_SECTIONS.find((s) => s.key === sec) : null

  return (
    <>
      <PageHeader
        eyebrow="المكتبة"
        title={sectionMeta ? sectionMeta.label : sec === "none" ? "عناصر غير مصنّفة" : "الهوية البصرية والأدلة والنماذج"}
        description={
          sectionMeta
            ? `${sectionMeta.hint}. يفتح كل ملف في Google Drive بصلاحياتك هناك.`
            : "ابحث بالاسم أو الوصف أو الكلمات المفتاحية، والبحث يتجاوز اختلاف الهمزات والتاء المربوطة. يفتح كل ملف في Google Drive بصلاحياتك هناك."
        }
        actions={
          canEdit && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setClassifying((c) => !c)
                  setPicked(new Set())
                }}
                aria-pressed={classifying}
                className={cn("inline-flex h-11 items-center gap-2 rounded-full border px-4 text-[16px]", classifying ? "border-primary bg-secondary font-bold text-secondary-foreground" : "bg-card hover:bg-accent")}
              >
                <Tags className="h-5 w-5" aria-hidden="true" />
                {classifying ? "إنهاء التصنيف" : "تصنيف العناصر"}
              </button>
              <button type="button" onClick={() => setEditing("synonyms")} className="inline-flex h-11 items-center gap-2 rounded-full border bg-card px-4 text-[16px] hover:bg-accent">
                <Settings2 className="h-5 w-5" aria-hidden="true" />
                المرادفات
              </button>
              <button type="button" onClick={() => setEditing("new")} className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-[16px] font-bold text-primary-foreground hover:bg-primary/90">
                <Plus className="h-5 w-5" aria-hidden="true" />
                إضافة ملف
              </button>
            </div>
          )
        }
      />
      <Gate needs={["files", "settings"]} emptyWhen={files.length === 0} emptyTitle="المكتبة فارغة" emptyBody={canEdit ? "أضف أول ملف من زر «إضافة ملف»." : "لم تُضف ملفات إلى المكتبة بعد."}>
        {classifying && (
          <div className="sticky z-20 mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-primary/40 bg-card p-3 shadow-sm" style={{ top: "4rem" }}>
            <span className="text-[15px]">
              <span className="num font-bold">{formatNumber(picked.size)}</span> محدد
            </span>
            <button type="button" onClick={() => setPicked(new Set(visible.map((h) => h.f.id)))} className="h-9 rounded-full border px-3 text-[14px] hover:bg-accent">
              تحديد الظاهر ({formatNumber(visible.length)})
            </button>
            {picked.size > 0 && (
              <button type="button" onClick={() => setPicked(new Set())} className="h-9 rounded-full px-3 text-[14px] text-muted-foreground hover:bg-accent">
                إلغاء التحديد
              </button>
            )}
            <span className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden="true" />
            <span className="text-[14px] text-muted-foreground">صنّف المحدد كـ</span>
            {LIBRARY_SECTIONS.map((s) => (
              <button key={s.key} type="button" disabled={!picked.size || savingSec} onClick={() => applySection(s.key)} className="h-9 rounded-full bg-secondary px-3 text-[14px] font-bold text-secondary-foreground hover:bg-secondary/80 disabled:opacity-40">
                {s.label}
              </button>
            ))}
            <button type="button" disabled={!picked.size || savingSec} onClick={() => applySection(null)} className="h-9 rounded-full border px-3 text-[14px] hover:bg-accent disabled:opacity-40">
              بلا تصنيف
            </button>
          </div>
        )}
        <div className="rise mb-4 overflow-hidden rounded-2xl border bg-card">
          <div className="pattern-stars bg-band px-5 py-6 sm:px-8">
            <label htmlFor="lib-search" className="mb-2 block text-[16px] font-bold text-band-foreground">
              عن ماذا تبحث؟
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                id="lib-search"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="مثال: شعار العالمية، دليل الهوية، سوشال"
                className="h-14 w-full rounded-xl border-0 bg-card pe-11 ps-12 text-[18px] text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-4 focus-visible:ring-gold/50"
              />
              {q && (
                <button type="button" onClick={() => setQ("")} className="absolute end-3 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:bg-accent" aria-label="مسح البحث">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

        </div>

        <div ref={secPill.ref} className="relative mb-4 flex gap-1.5 overflow-x-auto rounded-2xl border bg-card p-1.5 [scrollbar-width:none]" role="tablist" aria-label="أقسام المكتبة">
          <SlidePill box={secPill.box} ready={secPill.ready} className="rounded-xl bg-primary" />
          {(
            [
              { value: "all", label: "كل الأقسام" },
              ...LIBRARY_SECTIONS.map((s) => ({ value: s.key, label: s.label })),
              ...(canEdit ? [{ value: "none", label: "غير مصنّف" }] : []),
            ] as { value: SectionFilter; label: string }[]
          ).map((o) => {
            const n = countFor("section", (f) => (o.value === "all" ? true : o.value === "none" ? !f.section : f.section === o.value))
            return (
              <button
                key={o.value}
                type="button"
                role="tab"
                aria-selected={sec === o.value}
                onClick={() => setSec(o.value)}
                className={cn("relative z-10 inline-flex h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-[16px] transition-colors duration-300", sec === o.value ? "font-bold text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground")}
              >
                {o.label}
                <span className={cn("num rounded-full px-1.5 text-[13px]", sec === o.value ? "bg-white/20" : "bg-muted")}>{formatNumber(n)}</span>
              </button>
            )
          })}
        </div>
        {visible.length === 0 ? (
          <Panel>
            <EmptyState
              title="لا ملفات تطابق البحث"
              body={q ? "جرّب كلمة أقصر أو اسمًا آخر للملف." : "لا ملفات في هذا القسم بعد."}
              action={
                q || sec !== "all" ? (
                  <button type="button" onClick={() => (setQ(""), setSec("all"))} className="h-9 rounded-full border px-4 text-[14px] font-bold hover:bg-accent">
                    عرض كل المكتبة
                  </button>
                ) : undefined
              }
            />
          </Panel>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[15px] text-muted-foreground" role="status">
                عرض <span className="num font-bold text-foreground">{formatNumber(visible.length)}</span> من {formatNumber(files.length)} عنصرًا
                {visible.some((h) => h.viaSynonym) && " · بعض النتائج ظهرت عبر المرادفات المسجلة"}
              </p>
              <div className="inline-flex rounded-full border p-1" role="tablist" aria-label="طريقة العرض">
                {(
                  [
                    ["cards", "بطاقات", LayoutGrid],
                    ["table", "جدول", List],
                  ] as const
                ).map(([k, label, Icon]) => (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={view === k}
                    onClick={() => setView(k)}
                    className={cn("inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[15px]", view === k ? "bg-secondary font-bold text-secondary-foreground" : "text-muted-foreground hover:text-foreground")}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {view === "cards" || classifying ? (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visible.map(({ f }, i) => (
                  <li key={f.id} className="rise relative" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                    {classifying && (
                      <button
                        type="button"
                        onClick={() => togglePick(f.id)}
                        aria-pressed={picked.has(f.id)}
                        aria-label={`تحديد ${f.title}`}
                        className={cn("absolute inset-0 z-10 flex items-start justify-end rounded-2xl p-3 ring-2", picked.has(f.id) ? "bg-primary/10 ring-primary" : "ring-transparent hover:bg-accent/40")}
                      >
                        <span className={cn("flex h-7 w-7 items-center justify-center rounded-md border-2", picked.has(f.id) ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40 bg-card")}>
                          {picked.has(f.id) && <Check className="h-4 w-4" aria-hidden="true" />}
                        </span>
                      </button>
                    )}
                    <FileCard f={f} canEdit={canEdit && !classifying} onEdit={() => setEditing(f)} />
                  </li>
                ))}
              </ul>
            ) : (
              <Panel>
                <FileTable rows={visible.map((h) => h.f)} canEdit={canEdit} onEdit={setEditing} />
              </Panel>
            )}
          </>
        )}
        {files.some((f) => f.url && !f.named) && (
          <p className="mt-4 text-[14px] text-muted-foreground">
            أسماء {formatNumber(files.filter((f) => f.url && !f.named).length)} مجلدًا غير مسجّلة في سجل الروابط، فظهرت باسم تصنيفها ورقمها، ولذلك لا يجدها البحث بأسمائها الحقيقية.
            {canEdit ? " عدّل الاسم والوصف والكلمات المفتاحية من زر التعديل في البطاقة." : ""}
          </p>
        )}
      </Gate>

      <Sheet open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-lg" dir="rtl">
          <SheetHeader className="pe-8 text-start">
            <SheetTitle className="text-start text-[22px] font-bold">
              {editing === "new" ? "إضافة ملف إلى المكتبة" : editing === "synonyms" ? "مرادفات البحث" : "تعديل الملف"}
            </SheetTitle>
            <SheetDescription className="text-start text-[15px]">
              {editing === "synonyms"
                ? "كل سطر مجموعة كلمات متكافئة مفصولة بفواصل. البحث عن أي كلمة منها يجد الملفات التي تحتوي أيًّا منها."
                : "تُحفظ التعديلات في المنصة فقط، والملف نفسه يبقى في Google Drive كما هو."}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-5">
            {editing === "synonyms" ? (
              <SynonymsForm onDone={() => setEditing(null)} />
            ) : (
              editing && <FileForm item={editing === "new" ? undefined : editing} groups={groups} onDone={() => setEditing(null)} />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

function StatusPill({ f }: { f: FileItem }) {
  return f.status ? <Pill tone={STATUS_TONE[f.status]}>{f.status}</Pill> : <Pill>الاعتماد غير مسجّل</Pill>
}

function FileCard({ f, canEdit, onEdit }: { f: FileItem; canEdit: boolean; onEdit: () => void }) {
  const Icon = f.kind === "folder" ? Folder : f.kind === "file" ? FileText : FileType2
  const ready = !!f.url
  const dl = downloadUrl(f.url)
  return (
    <div className={cn("lift flex h-full flex-col gap-3 rounded-2xl border bg-card p-4", !ready && "border-dashed")}>
      <div className="flex items-start gap-3">
        <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", !ready ? "bg-muted text-muted-foreground" : f.kind === "folder" ? "bg-gold-soft text-gold-ink" : "bg-sky-soft text-sky-ink")}>
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("break-words text-[17px] font-bold leading-snug", !f.named && "text-foreground/80")}>{f.title}</p>
          <p className="mt-0.5 text-[14px] text-muted-foreground">
            {FILE_KIND_LABEL[f.kind]} · {f.group}
            {f.version ? ` · الإصدار ${f.version}` : ""}
          </p>
        </div>
        {canEdit && (
          <button type="button" onClick={onEdit} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={`تعديل ${f.title}`}>
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </div>
      {f.description && <p className="text-[15px] leading-relaxed text-muted-foreground">{f.description}</p>}
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusPill f={f} />
        <span className="num text-[14px] text-muted-foreground">{f.docDate ? `حُدّث ${formatDate(f.docDate)}` : "تاريخ التحديث غير مسجّل"}</span>
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        {ready ? (
          <>
            <span className="flex items-center">
              <CopyButton text={f.url!} />
              <ShareButton title={f.title} url={f.url!} />
            </span>
            <div className="flex gap-1.5">
              {dl && (
                <a href={dl.href} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-[15px] hover:bg-accent">
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  {dl.label}
                </a>
              )}
              <OpenLink href={f.url} variant="solid" size="sm">فتح</OpenLink>
            </div>
          </>
        ) : (
          <>
            <span className="min-w-0 truncate text-[14px] text-muted-foreground" title={f.fileLabel ?? undefined}>{f.fileLabel ?? "بلا اسم ملف"}</span>
            <Pill tone="warn">بانتظار الرابط</Pill>
          </>
        )}
      </div>
    </div>
  )
}

function FileTable({ rows, canEdit, onEdit }: { rows: FileItem[]; canEdit: boolean; onEdit: (f: FileItem) => void }) {
  const columns: Column<FileItem>[] = [
    {
      key: "title",
      header: "الملف",
      sort: (f) => f.title,
      render: (f) => (
        <div className="min-w-[220px]">
          <div className="font-bold">{f.title}</div>
          {f.description && <div className="text-[14px] text-muted-foreground">{f.description}</div>}
        </div>
      ),
    },
    { key: "section", header: "القسم", sort: (f) => f.section ?? null, render: (f) => (f.section ? <span className="whitespace-nowrap">{SECTION_LABEL[f.section]}</span> : <span className="text-muted-foreground">—</span>) },
    { key: "group", header: "التصنيف", sort: (f) => f.group, render: (f) => <span className="whitespace-nowrap">{f.group}</span> },
    { key: "kind", header: "النوع", sort: (f) => f.kind, render: (f) => FILE_KIND_LABEL[f.kind] },
    { key: "status", header: "حالة الاعتماد", sort: (f) => f.status ?? null, render: (f) => <StatusPill f={f} /> },
    { key: "date", header: "تاريخ التحديث", sort: (f) => f.docDate ?? null, render: (f) => (f.docDate ? <span className="num whitespace-nowrap">{formatDate(f.docDate)}</span> : <span className="text-muted-foreground">—</span>) },
    {
      key: "open",
      header: "",
      render: (f) => {
        const dl = downloadUrl(f.url)
        return (
          <div className="flex justify-end gap-1.5">
            {canEdit && (
              <button type="button" onClick={() => onEdit(f)} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent" aria-label={`تعديل ${f.title}`}>
                <Pencil className="h-4 w-4" />
              </button>
            )}
            {dl && (
              <a href={dl.href} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-[15px] hover:bg-accent">
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                {dl.label}
              </a>
            )}
            {f.url && <ShareButton title={f.title} url={f.url} className="w-8 justify-center px-0 [&>span]:sr-only" />}
            {f.url ? <OpenLink href={f.url} size="sm" variant="solid">فتح</OpenLink> : <Pill tone="warn">بانتظار الرابط</Pill>}
          </div>
        )
      },
    },
  ]
  return <DataTable caption="ملفات المكتبة" rows={rows} columns={columns} rowKey={(f) => f.id} />
}
