/**
 * Library search over the catalogue fields that actually exist on each item.
 * It does not look inside PDF or Word files: their contents are not indexed.
 */
import type { FileItem } from "@/data/types"

/** Folds common Arabic spelling variants so «إدارة» finds «ادارة», «هويه» finds «هوية» and «مسؤولية» finds «مسئولية». */
export function foldArabic(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "") // harakat, superscript alef, tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ؤئ]/g, "ء") // «مسؤولية» and «مسئولية» meet here
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Drops a leading definite article and common attached prefixes for a looser match. */
function stem(t: string): string {
  let w = t
  for (const p of ["وال", "بال", "كال", "فال", "لل", "ال"]) {
    if (w.startsWith(p) && w.length - p.length >= 2) {
      w = w.slice(p.length)
      break
    }
  }
  return w
}

export const FILE_KIND_LABEL: Record<FileItem["kind"], string> = { folder: "مجلد", file: "ملف", doc: "مستند" }

function haystack(f: FileItem) {
  return {
    title: foldArabic(`${f.title} ${f.fileLabel ?? ""}`),
    rest: foldArabic([f.description, f.group, FILE_KIND_LABEL[f.kind], f.owner, f.status, f.version, ...(f.keywords ?? [])].filter(Boolean).join(" ")),
  }
}

/** Expands a query word into itself plus every word registered as its synonym. */
function variants(token: string, groups: string[][]): string[] {
  const out = new Set([token, stem(token)])
  for (const g of groups) {
    const folded = g.map(foldArabic).filter(Boolean)
    if (folded.some((w) => w === token || stem(w) === stem(token) || (token.length >= 3 && w.includes(token)))) folded.forEach((w) => out.add(w))
  }
  return [...out].filter((x) => x.length >= 1)
}

export type Hit = { f: FileItem; score: number; viaSynonym: boolean }

/**
 * Every query word must match the item (directly or through a synonym).
 * Title matches rank above matches in other fields.
 */
export function searchFiles(files: FileItem[], query: string, groups: string[][]): Hit[] {
  const q = foldArabic(query)
  if (!q) return files.map((f) => ({ f, score: 0, viaSynonym: false }))
  // A registered multi-word synonym is matched as a phrase first.
  const tokens = q.split(" ")
  const out: Hit[] = []
  for (const f of files) {
    const h = haystack(f)
    let score = 0
    let viaSynonym = false
    let ok = true
    for (const t of tokens) {
      const vs = variants(t, groups)
      const inTitle = vs.some((v) => h.title.includes(v))
      const inRest = !inTitle && vs.some((v) => h.rest.includes(v))
      if (!inTitle && !inRest) {
        ok = false
        break
      }
      const direct = h.title.includes(t) || h.rest.includes(t) || h.title.includes(stem(t)) || h.rest.includes(stem(t))
      if (!direct) viaSynonym = true
      score += inTitle ? 3 : 1
    }
    if (ok) out.push({ f, score: score + (h.title.startsWith(tokens[0]) ? 1 : 0), viaSynonym })
  }
  return out.sort((a, b) => b.score - a.score || a.f.order - b.f.order)
}

/** Download links Google offers for a file; folders have none. */
export function downloadUrl(url: string | null): { href: string; label: string } | null {
  if (!url) return null
  const file = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/)
  if (file) return { href: `https://drive.google.com/uc?export=download&id=${file[1]}`, label: "تنزيل" }
  const doc = url.match(/docs\.google\.com\/document\/d\/([\w-]+)/)
  if (doc) return { href: `https://docs.google.com/document/d/${doc[1]}/export?format=pdf`, label: "تنزيل PDF" }
  const sheet = url.match(/docs\.google\.com\/spreadsheets\/d\/([\w-]+)/)
  if (sheet) return { href: `https://docs.google.com/spreadsheets/d/${sheet[1]}/export?format=xlsx`, label: "تنزيل Excel" }
  const slides = url.match(/docs\.google\.com\/presentation\/d\/([\w-]+)/)
  if (slides) return { href: `https://docs.google.com/presentation/d/${slides[1]}/export/pdf`, label: "تنزيل PDF" }
  return null
}
