import { useMemo, useState } from "react"
import { ArrowLeft, BookOpen, ClipboardList, FileSignature, Lock, Palette, Search, X } from "lucide-react"
import { useRouter } from "@/lib/router"
import { useStore } from "@/data/store"
import { LIBRARY_SECTIONS, type FileItem, type LibrarySection } from "@/data/types"
import { formatNumber } from "@/lib/format"
import { searchFiles } from "@/lib/search"
import { Gate } from "@/components/Gate"
import { SocialPulse } from "@/components/SocialPulse"
import { Panel, PanelHeader } from "@/components/common"
import { FileRow, openLibrary } from "./OverviewPage"
import { UpcomingStrip } from "./CalendarPage"
import { HomeHero } from "@/components/HomeHero"
import { QuickLinks, useQuickLinkItems } from "@/components/QuickLinks"

const SECTION_ICON: Record<LibrarySection, typeof Palette> = { identity: Palette, guides: BookOpen, forms: FileSignature }
const SECTION_TONE: Record<LibrarySection, string> = { identity: "bg-gold-soft text-gold-ink", guides: "bg-sky-soft text-sky-ink", forms: "bg-secondary text-secondary-foreground" }

/** Public items: drafts and archived copies stay out, as in the library's default view. */
const isCurrent = (f: FileItem) => f.status !== "مسودة" && f.status !== "مؤرشف"

/** The open front page: find a file, jump to a library section, see the social pulse. No indicator numbers here. */
export function HomePage() {
  const { data } = useStore()
  const { go } = useRouter()
  const [q, setQ] = useState("")
  const files = useMemo(() => data.files.filter(isCurrent), [data.files])
  const synonyms = data.settings?.synonyms ?? []
  const hits = useMemo(() => (q.trim() ? searchFiles(files, q, synonyms) : []), [files, q, synonyms])
  const latest = useMemo(
    () => [...files].filter((f) => f.url).sort((a, b) => (b.updatedAt ?? b.capturedAt ?? "").localeCompare(a.updatedAt ?? a.capturedAt ?? "")).slice(0, 6),
    [files],
  )
  const countOf = (s: LibrarySection) => files.filter((f) => f.section === s).length
  const suggestions = useQuickLinkItems().slice(0, 4)

  return (
    <>
      {/* 1 · welcome band with the search */}
      <HomeHero>
          <form
            className="mt-3 sm:mt-4"
            onSubmit={(e) => {
              e.preventDefault()
              openLibrary(go, q.trim())
            }}
          >
            <label htmlFor="home-search" className="sr-only">ابحث في الملفات</label>
            <div className="relative">
              <Search className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                id="home-search"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="مثال: شعار، دليل الهوية، نموذج طلب"
                className="h-12 w-full rounded-xl border-0 bg-card/85 pe-11 ps-12 text-[17px] sm:h-14 sm:text-[18px] text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-4 focus-visible:ring-gold/50"
              />
              {q && (
                <button type="button" onClick={() => setQ("")} className="absolute end-3 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:bg-accent" aria-label="مسح البحث">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </form>
        {!q.trim() && suggestions.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="عمليات بحث سريعة">
            {suggestions.map((f) => (
              <li key={f.id}>
                <button type="button" onClick={() => openLibrary(go, f.title)} className="inline-flex h-9 items-center rounded-full bg-white/[0.12] px-3.5 text-[14px] text-white ring-1 ring-white/25 backdrop-blur-sm transition-colors hover:bg-white/[0.22]">
                  {f.title}
                </button>
              </li>
            ))}
          </ul>
        )}
        {q.trim() && (
          <div className="relative mt-3 max-w-3xl rounded-xl bg-card p-2 text-foreground shadow-sm">
            {hits.length === 0 ? (
              <p className="px-3 py-3 text-[15px] text-muted-foreground">لا نتائج لـ«{q}». جرّب كلمة أخرى، أو افتح المكتبة وتصفّح أقسامها.</p>
            ) : (
              <ul className="divide-y">
                {hits.slice(0, 6).map(({ f }) => (
                  <FileRow key={f.id} f={f} />
                ))}
              </ul>
            )}
            <button type="button" onClick={() => openLibrary(go, q.trim())} className="mt-1 inline-flex min-h-11 items-center gap-1.5 px-3 py-2 text-[15px] font-bold text-primary hover:underline">
              {hits.length ? `كل النتائج في المكتبة (${formatNumber(hits.length)})` : "فتح المكتبة"}
              <ArrowLeft className="h-4 w-4" />
            </button>
          </div>
        )}
      </HomeHero>

      {/* 1b · quick links beside the coming events */}
      <div className="mt-5 grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="order-2 lg:order-1">
          <UpcomingStrip className="" />
        </div>
        <div className="order-1 lg:order-2">
          <QuickLinks />
        </div>
      </div>

      <Gate needs={["files", "settings"]}>
        {/* 2 · library sections */}
        <h2 className="sr-only">أقسام المكتبة</h2>
        <ul className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-3">
          {LIBRARY_SECTIONS.map((s, i) => {
            const Icon = SECTION_ICON[s.key]
            const n = countOf(s.key)
            return (
              <li key={s.key} className="rise" style={{ animationDelay: `${i * 60}ms` }}>
                <button type="button" onClick={() => openLibrary(go, "", "all", s.key)} className="lift flex h-full w-full items-center gap-4 rounded-2xl border bg-card p-5 text-start">
                  <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${SECTION_TONE[s.key]}`}>
                    <Icon className="h-7 w-7" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[19px] font-bold">{s.label}</span>
                    <span className="block text-[14px] text-muted-foreground">{s.hint}</span>
                    <span className="num mt-1 block text-[14px] font-bold text-primary">{n ? `${formatNumber(n)} عنصرًا` : "لم تُصنّف عناصر بعد"}</span>
                  </span>
                  <ArrowLeft className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>

        {/* 3 · social pulse */}
        <SocialPulse />

        {/* 4 · latest files + protected area */}
        <div className="mt-5 grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Panel className="rise">
            <PanelHeader title="أُضيف أو حُدّث مؤخرًا" hint={`${formatNumber(files.length)} عنصرًا في المكتبة`} />
            <div className="px-3 pb-2 pt-1">
              {latest.length === 0 ? (
                <p className="px-2 py-4 text-[15px] text-muted-foreground">لا توجد ملفات بروابط بعد.</p>
              ) : (
                <ul className="divide-y">
                  {latest.map((f) => (
                    <FileRow key={f.id} f={f} />
                  ))}
                </ul>
              )}
            </div>
            <div className="border-t px-5 py-3">
              <button type="button" onClick={() => openLibrary(go, "")} className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-bold text-primary hover:underline">
                فتح المكتبة
                <ArrowLeft className="h-4 w-4" />
              </button>
            </div>
          </Panel>
          <button type="button" onClick={() => go({ page: "indicators" })} className="lift rise flex flex-col gap-3 rounded-2xl border bg-card p-5 text-start">
            <span className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                <ClipboardList className="h-6 w-6" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-[18px] font-bold">الأداء والتطوير</span>
                <span className="flex items-center gap-1 text-[14px] text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  تتطلب كلمة مرور
                </span>
              </span>
            </span>
            <span className="text-[15px] leading-relaxed text-muted-foreground">لفريق التواصل المؤسسي ومسؤولي التواصل في الفروع: نتائج المؤشرات، والخطط العلاجية، ودراسة المنافسين، والتنبيهات والتقارير.</span>
            <span className="inline-flex items-center gap-1.5 text-[15px] font-bold text-primary">
              الدخول إلى القسم
              <ArrowLeft className="h-4 w-4" />
            </span>
          </button>
        </div>
      </Gate>
    </>
  )
}
