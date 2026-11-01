import { useMemo, useState } from "react"
import { Check, ChevronDown, Download, FileText, FileType2, Folder, LayoutGrid, List, Pencil, Plus, Search, Settings2, SlidersHorizontal, Tags, X } from "lucide-react"
import { useStore } from "@/data/store"
import { FILE_STATUSES, LIBRARY_SECTIONS, type FileItem, type FileStatus, type LibrarySection } from "@/data/types"
import { useRouter } from "@/lib/router"
import { formatDate, formatNumber } from "@/lib/format"
import { FILE_KIND_LABEL, downloadUrl, searchFiles } from "@/lib/search"
import { usePersistent } from "@/lib/persist"
import { daysSince } from "@/data/insights"
import { cn } from "@/lib/utils"
import { Gate } from "@/components/Gate"
import { DataTable, type Column } from "@/components/DataTable"
import { ChipGroup, CopyButton, EmptyState, OpenLink, PageHeader, Panel, Pill, SelectField, type Tone } from "@/components/common"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { FileForm, SynonymsForm } from "@/components/admin"

type Kind = "all" | "folder" | "file" | "doc" | "waiting"
type StatusFilter = "all" | FileStatus | "none"
type DateFilter = "all" | "30" | "90" | "365" | "none"
type SortKey = "relevance" | "order" | "title" | "date"

const STATUS_TONE: Record<FileStatus, Tone> = { معتمد: "ok", مسودة: "warn", مؤرشف: "neutral" }

type SectionFilter = "all" | LibrarySection | "none"
const SECTION_LABEL: Record<LibrarySection, string> = Object.fromEntries(LIBRARY_SECTIONS.map((s) => [s.key, s.label])) as Record<LibrarySection, string>
const isSection = (v: string | undefined): v is LibrarySection => LIBRARY_SECTIONS.some((s) => s.key === v)

export function LibraryPage({ section: routeSection }: { section?: string }) {
  const { data, canEdit, saveFileSections } = useStore()
  const { go } = useRouter()
  const sec: SectionFilter = isSection(routeSection) ? routeSection : routeSection === "none" ? "none" : "all"
  const setSec = (v: SectionFilter) => go({ page: "library", section: v === "all" ? undefined : v })
  const [classifying, setClassifying] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [savingSec, setSavingSec] = useState(false)
  const [q, setQ] = usePersistent("lib-q", "")
  const [group, setGroup] = usePersistent("lib-group", "all")
  const [kind, setKind] = usePersistent<Kind>("lib-kind", "all")
  const [status, setStatus] = usePersistent<StatusFilter>("lib-status", "all")
  const [owner, setOwner] = usePersistent("lib-owner", "all")
  const [date, setDate] = usePersistent<DateFilter>("lib-date", "all")
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [showInactive, setShowInactive] = usePersistent("lib-inactive", false)
  const [sort, setSort] = usePersistent<SortKey>("lib-sort", "relevance")
  const [view, setView] = usePersistent<"cards" | "table">("lib-view", "cards")
  const [editing, setEditing] = useState<FileItem | "new" | "synonyms" | null>(null)

  const files = data.files
  const synonyms = data.settings?.synonyms ?? []
  const groups = useMemo(() => Array.from(new Set(files.map((f) => f.group))), [files])
  const owners = useMemo(() => Array.from(new Set(files.map((f) => f.owner).filter(Boolean))) as string[], [files])
  const inactiveCount = files.filter((f) => f.status === "مسودة" || f.status === "مؤرشف").length

  const hits = useMemo(() => searchFiles(files, q, synonyms), [files, q, synonyms])
  const pass = (f: FileItem, skip?: string) =>
    (skip === "section" || sec === "all" || (sec === "none" ? !f.section : f.section === sec)) &&
    (skip === "group" || group === "all" || f.group === group) &&
    (skip === "kind" || kind === "all" || (kind === "waiting" ? !f.url : !!f.url && f.kind === kind) || (kind === "doc" && f.kind === "doc")) &&
    (skip === "status" || status === "all" || (status === "none" ? !f.status : f.status === status)) &&
    (skip === "owner" || owner === "all" || f.owner === owner) &&
    (skip === "date" ||
      date === "all" ||
      (date === "none" ? !f.docDate : !!f.docDate && daysSince(f.docDate) <= Number(date))) &&
    // The latest approved copy is the default view: recorded drafts and archived copies stay hidden until asked for.
    (showInactive || status === "مسودة" || status === "مؤرشف" || !(f.status === "مسودة" || f.status === "مؤرشف"))

  const visible = useMemo(() => {
    const list = hits.filter((h) => pass(h.f))
    const by = sort === "relevance" && !q ? "order" : sort
    if (by === "title") return [...list].sort((a, b) => a.f.title.localeCompare(b.f.title, "ar"))
    if (by === "order") return [...list].sort((a, b) => a.f.order - b.f.order)
    if (by === "date") return [...list].sort((a, b) => (b.f.docDate ?? "").localeCompare(a.f.docDate ?? ""))
    return list
  }, [hits, sec, group, kind, status, owner, date, showInactive, sort, q]) // eslint-disable-line react-hooks/exhaustive-deps

  const countFor = (skip: string, test: (f: FileItem) => boolean) => hits.filter((h) => pass(h.f, skip) && test(h.f)).length

  const active = [
    q && { label: `«${q}»`, clear: () => setQ("") },
    group !== "all" && { label: group, clear: () => setGroup("all") },
    kind !== "all" && { label: kind === "waiting" ? "بانتظار الرابط" : FILE_KIND_LABEL[kind as FileItem["kind"]], clear: () => setKind("all") },
    status !== "all" && { label: status === "none" ? "اعتماد غير مسجّل" : status, clear: () => setStatus("all") },
    owner !== "all" && { label: owner, clear: () => setOwner("all") },
    date !== "all" && { label: date === "none" ? "تاريخ غير مسجّل" : `آخر ${date} يومًا`, clear: () => setDate("all") },
    showInactive && { label: "يشمل المسودات والمؤرشف", clear: () => setShowInactive(false) },
  ].filter(Boolean) as { label: string; clear: () => void }[]

  const clearAll = () => {
    setQ("")
    setGroup("all")
    setKind("all")
    setStatus("all")
    setOwner("all")
    setDate("all")
    setShowInactive(false)
  }

  // When nothing matches, say which filter is in the way.
  const blockers = active.filter((a) => a.label !== `«${q}»`)
  const qOnly = q ? searchFiles(files, q, synonyms).length : files.length

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
        <div className="mb-4 flex gap-1.5 overflow-x-auto rounded-2xl border bg-card p-1.5 [scrollbar-width:none]" role="tablist" aria-label="أقسام المكتبة">
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
                className={cn("inline-flex h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-[16px]", sec === o.value ? "bg-primary font-bold text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground")}
              >
                {o.label}
                <span className={cn("num rounded-full px-1.5 text-[13px]", sec === o.value ? "bg-white/20" : "bg-muted")}>{formatNumber(n)}</span>
              </button>
            )
          })}
        </div>
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
        <div className="rise mb-6 overflow-hidden rounded-2xl border bg-card">
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
            <p className="mt-2 text-[14px] text-band-soft">
              يبحث في: اسم الملف، الوصف، التصنيف، الكلمات المفتاحية، المرادفات المسجلة، ونوع الملف. لا يبحث داخل محتوى ملفات PDF أو Word لأنها غير مفهرسة.
            </p>
          </div>

          <div className="flex flex-col gap-3 px-5 py-4">
            {/* phones: the filters fold behind one button so the results come first */}
            <button
              type="button"
              onClick={() => setFiltersOpen((o) => !o)}
              aria-expanded={filtersOpen}
              aria-controls="lib-filters"
              className="inline-flex h-11 items-center justify-between gap-2 rounded-xl border px-4 text-[15px] font-bold md:hidden"
            >
              <span className="inline-flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                تصفية النتائج
                {active.length > 0 && <span className="num rounded-full bg-primary px-2 text-[13px] leading-6 text-primary-foreground">{formatNumber(active.length)}</span>}
              </span>
              <ChevronDown className={cn("h-4 w-4 transition-transform", filtersOpen && "rotate-180")} aria-hidden="true" />
            </button>
            <div id="lib-filters" className={cn("flex-col gap-3", filtersOpen ? "flex" : "hidden md:flex")}>
            <ChipGroup
              label="التصنيف"
              value={group}
              onChange={setGroup}
              options={[{ value: "all", label: "الكل" }, ...groups.map((g) => ({ value: g, label: g, count: countFor("group", (f) => f.group === g) }))]}
            />
            <ChipGroup<Kind>
              label="النوع"
              value={kind}
              onChange={setKind}
              options={[
                { value: "all", label: "الكل" },
                { value: "folder", label: "مجلدات", count: countFor("kind", (f) => !!f.url && f.kind === "folder") },
                { value: "file", label: "ملفات", count: countFor("kind", (f) => !!f.url && f.kind === "file") },
                { value: "waiting", label: "بانتظار الرابط", count: countFor("kind", (f) => !f.url) },
              ]}
            />
            <ChipGroup<StatusFilter>
              label="حالة الاعتماد"
              value={status}
              onChange={setStatus}
              options={[
                { value: "all", label: "الكل" },
                ...FILE_STATUSES.map((s) => ({ value: s, label: s, count: countFor("status", (f) => f.status === s) })),
                { value: "none", label: "غير مسجّلة", count: countFor("status", (f) => !f.status) },
              ]}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SelectField
                id="lib-date"
                label="تاريخ التحديث"
                value={date}
                onChange={(v) => setDate(v as DateFilter)}
                options={[
                  { value: "all", label: "أي تاريخ" },
                  { value: "30", label: "آخر 30 يومًا" },
                  { value: "90", label: "آخر 90 يومًا" },
                  { value: "365", label: "آخر سنة" },
                  { value: "none", label: `غير مسجّل (${formatNumber(countFor("date", (f) => !f.docDate))})` },
                ]}
              />
              {owners.length > 0 ? (
                <SelectField id="lib-owner" label="الجهة المالكة" value={owner} onChange={setOwner} options={[{ value: "all", label: "كل الجهات" }, ...owners.map((o) => ({ value: o, label: o }))]} />
              ) : (
                <div className="flex flex-col gap-1">
                  <span className="text-[14px] text-muted-foreground">الجهة المالكة</span>
                  <span className="flex h-9 items-center rounded-md border border-dashed px-2.5 text-[14px] text-muted-foreground">لم تُسجّل جهات مالكة بعد</span>
                </div>
              )}
              <SelectField
                id="lib-sort"
                label="الترتيب"
                value={sort}
                onChange={(v) => setSort(v as SortKey)}
                options={[
                  { value: "relevance", label: "الأقرب للبحث" },
                  { value: "order", label: "كما في السجل" },
                  { value: "title", label: "الاسم" },
                  { value: "date", label: "الأحدث تحديثًا" },
                ]}
              />
              <label className="flex min-h-11 items-end gap-2 pb-1.5 text-[15px]">
                <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="h-5 w-5 accent-[hsl(var(--primary))]" />
                <span>
                  إظهار المسودات والمؤرشف
                  <span className="num ms-1 text-muted-foreground">({formatNumber(inactiveCount)})</span>
                </span>
              </label>
            </div>
            </div>
            {active.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                <span className="text-[14px] text-muted-foreground">المفعّل</span>
                {active.map((a) => (
                  <button key={a.label} type="button" onClick={a.clear} className="inline-flex h-8 items-center gap-1 rounded-full bg-secondary px-3 text-[14px] text-secondary-foreground hover:bg-secondary/80">
                    {a.label}
                    <X className="h-3.5 w-3.5" aria-label="إزالة" />
                  </button>
                ))}
                <button type="button" onClick={clearAll} className="text-[14px] font-bold text-primary hover:underline">
                  مسح الكل
                </button>
              </div>
            )}
          </div>
        </div>

        {visible.length === 0 ? (
          <Panel>
            <EmptyState
              title="لا ملفات تطابق البحث"
              body={
                q && qOnly > 0 && blockers.length
                  ? `توجد ${formatNumber(qOnly)} نتيجة لكلمة «${q}» لكن المرشحات تخفيها. أزل مرشحًا أو أكثر.`
                  : q
                    ? "جرّب كلمة أقصر، أو اسمًا آخر للملف، أو اكتب التصنيف (مثل: الهوية، العالمية، الشركة)."
                    : "أزل بعض المرشحات لعرض ملفات أكثر."
              }
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  {blockers.map((b) => (
                    <button key={b.label} type="button" onClick={b.clear} className="inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[14px] hover:bg-accent">
                      إزالة: {b.label}
                    </button>
                  ))}
                  <button type="button" onClick={clearAll} className="h-8 rounded-full px-3 text-[14px] font-bold text-primary underline underline-offset-4">
                    مسح الكل
                  </button>
                </div>
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
          {f.section && <span className="mt-1 inline-block rounded-full bg-secondary px-2 py-0.5 text-[13px] font-bold text-secondary-foreground">{SECTION_LABEL[f.section]}</span>}
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
      {f.keywords && f.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {f.keywords.map((k) => (
            <span key={k} className="rounded-full bg-muted px-2 py-0.5 text-[13px] text-muted-foreground">
              {k}
            </span>
          ))}
        </div>
      )}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        {ready ? (
          <>
            <CopyButton text={f.url!} />
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
            {f.url ? <OpenLink href={f.url} size="sm" variant="solid">فتح</OpenLink> : <Pill tone="warn">بانتظار الرابط</Pill>}
          </div>
        )
      },
    },
  ]
  return <DataTable caption="ملفات المكتبة" rows={rows} columns={columns} rowKey={(f) => f.id} />
}
