/**
 * Reads a Word (.docx) complaint report into its blocks, in the file's own
 * order: paragraphs (with their heading level) and tables (cell text only).
 * Nothing is computed, summed or reworded; empty paragraphs are skipped.
 */
import JSZip from "jszip"
import type { ComplaintBlock } from "@/data/types"

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"

const kids = (el: Element, name: string) => Array.from(el.children).filter((c) => c.namespaceURI === W && c.localName === name)

/** Text of a paragraph as Word shows it: runs, tabs and line breaks; deleted text and field codes are skipped. */
function paragraphText(p: Element): string {
  let out = ""
  const walk = (n: Element) => {
    for (const c of Array.from(n.children)) {
      if (c.namespaceURI !== W) continue
      switch (c.localName) {
        case "t":
          out += c.textContent ?? ""
          break
        case "tab":
          out += "\t"
          break
        case "br":
        case "cr":
          out += "\n"
          break
        case "delText":
        case "instrText":
        case "pPr":
        case "rPr":
          break
        default:
          walk(c)
      }
    }
  }
  walk(p)
  return out
}

function cellText(tc: Element): string {
  const parts: string[] = []
  const walk = (n: Element) => {
    for (const c of Array.from(n.children)) {
      if (c.namespaceURI !== W) continue
      if (c.localName === "p") parts.push(paragraphText(c))
      else if (c.localName !== "tcPr") walk(c)
    }
  }
  walk(tc)
  return parts.join("\n").trim()
}

export async function readDocx(file: Blob): Promise<ComplaintBlock[]> {
  const zip = await JSZip.loadAsync(file)
  const docXml = await zip.file("word/document.xml")?.async("string")
  if (!docXml) throw new Error("not-docx")
  const stylesXml = (await zip.file("word/styles.xml")?.async("string")) ?? ""

  const parser = new DOMParser()
  // style id → style name (e.g. Heading1 → "heading 1"), so headings are found whatever the document language
  const names = new Map<string, string>()
  if (stylesXml) {
    const st = parser.parseFromString(stylesXml, "application/xml")
    for (const s of Array.from(st.getElementsByTagNameNS(W, "style"))) {
      const id = s.getAttributeNS(W, "styleId") ?? s.getAttribute("w:styleId")
      const name = s.getElementsByTagNameNS(W, "name")[0]
      if (id && name) names.set(id, (name.getAttributeNS(W, "val") ?? name.getAttribute("w:val") ?? "").toLowerCase())
    }
  }
  const styleOf = (p: Element): "title" | "h1" | "h2" | "p" => {
    const ps = p.getElementsByTagNameNS(W, "pStyle")[0]
    const id = ps ? ps.getAttributeNS(W, "val") ?? ps.getAttribute("w:val") ?? "" : ""
    const name = names.get(id) ?? id.toLowerCase()
    if (name === "title") return "title"
    if (name === "heading 1" || name === "heading1") return "h1"
    if (/^heading ?[2-9]$/.test(name)) return "h2"
    return "p"
  }

  const doc = parser.parseFromString(docXml, "application/xml")
  if (doc.getElementsByTagName("parsererror").length) throw new Error("bad-xml")
  const body = doc.getElementsByTagNameNS(W, "body")[0]
  if (!body) throw new Error("no-body")

  const blocks: ComplaintBlock[] = []
  const visit = (parent: Element) => {
    for (const el of Array.from(parent.children)) {
      if (el.namespaceURI !== W) continue
      if (el.localName === "p") {
        const text = paragraphText(el)
        if (text.trim()) blocks.push({ t: "p", style: styleOf(el), text })
      } else if (el.localName === "tbl") {
        const rows = kids(el, "tr").map((tr) => kids(tr, "tc").map(cellText))
        if (rows.length) blocks.push({ t: "table", rows })
      } else if (el.localName === "sdt") {
        const content = kids(el, "sdtContent")[0]
        if (content) visit(content)
      }
    }
  }
  visit(body)
  return blocks
}

/* ------------------------------------------------------------ branch and month from the report title */
const MONTHS: Record<string, number> = {
  يناير: 1, فبراير: 2, مارس: 3, ابريل: 4, أبريل: 4, إبريل: 4, مايو: 5, يونيو: 6, يوليو: 7,
  اغسطس: 8, أغسطس: 8, سبتمبر: 9, اكتوبر: 10, أكتوبر: 10, نوفمبر: 11, ديسمبر: 12,
}
const EN_MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]
export const MONTH_NAMES = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]

/** "2026-10" → "أكتوبر 2026" */
export const monthLabel = (m: string) => {
  const [y, mo] = m.split("-").map(Number)
  return y && mo ? `${MONTH_NAMES[mo - 1]} ${y}` : m
}

/** Month named in the report title («… — أكتوبر 2026»), else in the file name («october-2026»). */
export function monthFrom(title: string, fileName: string): string | null {
  for (const [name, n] of Object.entries(MONTHS)) {
    const m = new RegExp(`${name}\\s*(\\d{4})`).exec(title)
    if (m) return `${m[1]}-${String(n).padStart(2, "0")}`
  }
  const f = fileName.toLowerCase()
  for (let i = 0; i < 12; i++) {
    const m = new RegExp(`${EN_MONTHS[i]}[-_ ]?(\\d{4})`).exec(f)
    if (m) return `${m[1]}-${String(i + 1).padStart(2, "0")}`
  }
  return null
}

/** Branch name in the report title («تقرير شكاوى فرع الفيحاء — …»), else the first main heading. */
export function branchNameFrom(blocks: ComplaintBlock[]): string | null {
  const title = blocks.find((b) => b.t === "p" && b.style === "title")
  if (title && title.t === "p") {
    const m = /فرع\s+(.+?)\s*[—–-]/.exec(title.text)
    if (m) return m[1].trim()
  }
  const h1 = blocks.find((b) => b.t === "p" && b.style === "h1")
  return h1 && h1.t === "p" ? h1.text.trim() : null
}
