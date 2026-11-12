/**
 * «الهوية البصرية» in the library: four brand doors (الأهلية، العالمية، الأندلس
 * الصغيرة، الشركة), then a brand's files grouped by use. الأوائل sits inside
 * الأهلية. Brands come from each item's category («الهوية · …»); the use groups
 * are matched from the file title, and anything unmatched shows under «أخرى».
 */
import { ArrowRight, BookOpen, Download, FileText, FileType2, Folder, Pencil } from "lucide-react"
import type { FileItem } from "@/data/types"
import { formatNumber, normalize } from "@/lib/format"
import { downloadUrl } from "@/lib/search"
import { cn } from "@/lib/utils"
import { CopyButton, OpenLink, Panel, Pill } from "@/components/common"
import { ShareButton } from "@/components/ShareButton"

const LOGO = (f: string) => `${import.meta.env.BASE_URL}brands/${f}.webp`

export type Brand = { key: string; name: string; logo: string; match: string; tone: string; desc: string; subs?: { key: string; name: string; match: string }[] }
export const BRANDS: Brand[] = [
  { key: "ahlia", name: "مدارس الأندلس الأهلية", logo: LOGO("ahlia"), match: "الاهليه", tone: "#1e3a8a", desc: "الشعار والقرطاسية والعروض واللوحات، ومعها مدارس الأوائل.", subs: [{ key: "awael", name: "مدارس الأوائل", match: "الاوائل" }] },
  { key: "alamia", name: "مدارس الأندلس العالمية", logo: LOGO("alamia"), match: "العالميه", tone: "#2e2a7a", desc: "الهوية الدولية: الشعار والقوالب والمطبوعات." },
  { key: "little", name: "الأندلس الصغيرة", logo: LOGO("little"), match: "الصغيره", tone: "#5aa0d8", desc: "رياض الأطفال: الشعار والحركة واللوحات والمرافق." },
  { key: "company", name: "شركة الأندلس التعليمية", logo: LOGO("company"), match: "الشركه", tone: "#212178", desc: "هوية الشركة والإدارات المركزية." },
]

/** the brand (and sub-brand) an identity item belongs to, from its category */
export function brandOf(f: FileItem): { brand: string; sub: string | null } | null {
  const g = normalize(f.group)
  for (const b of BRANDS) {
    for (const s of b.subs ?? []) if (g.includes(s.match)) return { brand: b.key, sub: s.key }
    if (g.includes(b.match)) return { brand: b.key, sub: null }
  }
  return null
}

const USE_GROUPS: [string, RegExp][] = [
  ["الشعار والحركة والخط", /شعار|logo|تحريك|animation|الخط|font/i],
  ["الورق والمطبوعات", /الورق|الظروف|envelope|المفكرة|notepad|الملفات|folder|الشهادات|certificate|bc_template|بطاقة عمل|id template/i],
  ["العروض والتواصل الاجتماعي", /بوربوينت|ppt|قالب الصور|التهنئة|مواقع التواصل|الفيديو/i],
  ["اللوحات والمرافق والنقل", /لوحات|اللوحات|لوحة|المرافق|الباص/i],
]
const isGuide = (f: FileItem) => /دليل الهوية/.test(f.title)

export function BrandGrid({ items, onOpen }: { items: FileItem[]; onOpen: (key: string) => void }) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {BRANDS.map((b, i) => {
        const mine = items.filter((f) => brandOf(f)?.brand === b.key)
        const subCount = mine.filter((f) => brandOf(f)?.sub).length
        return (
          <li key={b.key} className="rise" style={{ animationDelay: `${i * 60}ms` }}>
            <button type="button" onClick={() => onOpen(b.key)} className="lift group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-card text-start">
              <span className="absolute inset-x-0 top-0 h-1.5" style={{ background: b.tone }} aria-hidden="true" />
              {/* the logos are drawn for white, so they sit on a white plate in both themes */}
              <span className="m-3 mb-0 flex h-32 items-center justify-center rounded-xl bg-white px-6">
                <img src={b.logo} alt={b.name} className="max-h-20 w-auto max-w-full object-contain" loading="lazy" />
              </span>
              <span className="flex flex-1 flex-col gap-1.5 p-4">
                <span className="text-[18px] font-extrabold leading-snug">{b.name}</span>
                <span className="text-[14px] leading-relaxed text-muted-foreground">{b.desc}</span>
                {b.subs && subCount > 0 && <span className="mt-1 self-start rounded-full bg-gold-soft px-2.5 py-0.5 text-[12px] font-bold text-gold-ink">تشمل {b.subs.map((s) => s.name).join("، ")}</span>}
                <span className="mt-auto flex items-center justify-between border-t pt-3 text-[14px]">
                  <span className="text-muted-foreground"><span className="num text-[20px] font-extrabold text-primary">{formatNumber(mine.length)}</span> عنصرًا</span>
                  <span className="font-bold text-primary">فتح ←</span>
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export function BrandView({ brand, sub, items, canEdit, onBack, onSub, onEdit }: { brand: Brand; sub: string | null; items: FileItem[]; canEdit: boolean; onBack: () => void; onSub: (k: string | null) => void; onEdit: (f: FileItem) => void }) {
  const mine = items.filter((f) => brandOf(f)?.brand === brand.key)
  const list = mine.filter((f) => (brandOf(f)?.sub ?? null) === sub)
  const subMeta = brand.subs?.find((s) => s.key === sub)
  const guide = list.find(isGuide)
  const rest = list.filter((f) => f !== guide)
  const used = new Set<FileItem>()
  const groups = USE_GROUPS.map(([name, re]) => {
    const l = rest.filter((f) => !used.has(f) && re.test(f.title))
    l.forEach((f) => used.add(f))
    return [name, l] as const
  })
  const other = rest.filter((f) => !used.has(f))
  if (other.length) groups.push(["أخرى", other])

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-1.5 self-start text-[15px] font-bold text-primary">
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
        كل الجهات
      </button>
      <Panel className="overflow-hidden">
        <div className="h-1.5" style={{ background: brand.tone }} aria-hidden="true" />
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex h-24 w-44 shrink-0 items-center justify-center rounded-xl border bg-white px-4 sm:w-64">
              <img src={brand.logo} alt="" className="max-h-16 w-auto max-w-full object-contain" />
            </span>
            <div className="min-w-0">
              <h2 className="text-[22px] font-extrabold leading-snug">{subMeta ? subMeta.name : brand.name}</h2>
              <p className="text-[14px] text-muted-foreground">
                <span className="num">{formatNumber(list.length)}</span> عنصرًا{subMeta ? ` · ضمن ${brand.name}` : ""}
              </p>
            </div>
          </div>
          {guide?.url && (
            <OpenLink href={guide.url} variant="solid">
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              دليل الهوية البصرية
            </OpenLink>
          )}
        </div>
      </Panel>

      {brand.subs && (
        <div className="inline-flex flex-wrap gap-1 self-start rounded-full bg-muted p-1" role="group" aria-label="الجهة">
          {[{ key: null as string | null, name: brand.name.replace("مدارس الأندلس ", "") }, ...brand.subs.map((s) => ({ key: s.key as string | null, name: s.name.replace("مدارس ", "") }))].map((s) => {
            const n = mine.filter((f) => (brandOf(f)?.sub ?? null) === s.key).length
            return (
              <button key={s.key ?? "main"} type="button" aria-pressed={sub === s.key} onClick={() => onSub(s.key)} className={cn("h-9 rounded-full px-4 text-[15px]", sub === s.key ? "bg-card font-bold shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                {s.name} <span className="num text-[13px] text-muted-foreground">· {formatNumber(n)}</span>
              </button>
            )
          })}
        </div>
      )}

      {list.length === 0 ? (
        <Panel><p className="p-6 text-center text-muted-foreground">لا عناصر هنا بعد.</p></Panel>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          {guide && !guide.url && (
            <Panel className="lg:col-span-2"><ul className="p-1.5"><FileRow f={guide} canEdit={canEdit} onEdit={onEdit} /></ul></Panel>
          )}
          {groups.filter(([, l]) => l.length).map(([name, l]) => (
            <Panel key={name} className="rise">
              <h3 className="flex items-center justify-between border-b px-4 py-3 text-[16px] font-extrabold">
                {name}
                <span className="num text-[13px] font-medium text-muted-foreground">{formatNumber(l.length)}</span>
              </h3>
              <ul className="p-1.5">
                {l.map((f) => <FileRow key={f.id} f={f} canEdit={canEdit} onEdit={onEdit} />)}
              </ul>
            </Panel>
          ))}
        </div>
      )}
    </div>
  )
}

export function FileRow({ f, canEdit, onEdit }: { f: FileItem; canEdit: boolean; onEdit: (f: FileItem) => void }) {
  const Icon = f.kind === "folder" ? Folder : f.kind === "file" ? FileText : FileType2
  const dl = downloadUrl(f.url)
  return (
    <li className="flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-accent/50">
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", !f.url ? "bg-muted text-muted-foreground" : f.kind === "folder" ? "bg-gold-soft text-gold-ink" : "bg-sky-soft text-sky-ink")}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium leading-snug">{f.title}</span>
        {f.status && f.status !== "معتمد" && <Pill tone="warn">{f.status}</Pill>}
      </span>
      <span className="flex shrink-0 items-center gap-0.5">
        {f.url ? (
          <>
            <span className="hidden sm:inline-flex"><CopyButton text={f.url} /></span>
            <ShareButton title={f.title} url={f.url} className="w-8 justify-center px-0 [&>span]:sr-only" />
            {dl && (
              <a href={dl.href} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent" aria-label={`${dl.label}: ${f.title}`} title={dl.label}>
                <Download className="h-4 w-4" />
              </a>
            )}
            <OpenLink href={f.url} variant="solid" size="sm">فتح</OpenLink>
          </>
        ) : (
          <Pill tone="warn">بانتظار الرابط</Pill>
        )}
        {canEdit && (
          <button type="button" onClick={() => onEdit(f)} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent" aria-label={`تعديل ${f.title}`}>
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </span>
    </li>
  )
}

/** A library section shown as compact rows, one panel per category (used in «كل الأقسام»). */
export function SectionRows({ title, hint, items, canEdit, onEdit, onMore }: { title: string; hint?: string; items: FileItem[]; canEdit: boolean; onEdit: (f: FileItem) => void; onMore?: () => void }) {
  const byGroup = new Map<string, FileItem[]>()
  for (const f of items) byGroup.set(f.group || "عام", [...(byGroup.get(f.group || "عام") ?? []), f])
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[22px] font-extrabold">{title} <span className="num text-[15px] font-medium text-muted-foreground">· {formatNumber(items.length)}</span></h2>
        {onMore && <button type="button" onClick={onMore} className="text-[15px] font-bold text-primary hover:underline">فتح القسم ←</button>}
      </div>
      {hint && <p className="-mt-2 text-[14px] text-muted-foreground">{hint}</p>}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        {[...byGroup].map(([g, l]) => (
          <Panel key={g} className="rise">
            <h3 className="flex items-center justify-between border-b px-4 py-3 text-[16px] font-extrabold">
              {g}
              <span className="num text-[13px] font-medium text-muted-foreground">{formatNumber(l.length)}</span>
            </h3>
            <ul className="p-1.5">{l.map((f) => <FileRow key={f.id} f={f} canEdit={canEdit} onEdit={onEdit} />)}</ul>
          </Panel>
        ))}
      </div>
    </section>
  )
}
