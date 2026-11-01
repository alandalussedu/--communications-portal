/**
 * PDF export. Each report page is rendered by the browser itself (so Arabic
 * shaping and the embedded Tajawal font are exactly what is on screen), then
 * placed as a high-resolution image on an A4 page. No external service.
 */
import { toCanvas } from "html-to-image"
import { FONT_CSS } from "@/assets/fonts"

const A4_W = 595.28
const A4_H = 841.89

function utf16Hex(s: string): string {
  let out = "FEFF"
  for (const ch of s) {
    const cp = ch.codePointAt(0)!
    if (cp > 0xffff) {
      const v = cp - 0x10000
      out += (0xd800 + (v >> 10)).toString(16).padStart(4, "0") + (0xdc00 + (v & 0x3ff)).toString(16).padStart(4, "0")
    } else out += cp.toString(16).padStart(4, "0")
  }
  return out.toUpperCase()
}

async function jpegBytes(canvas: HTMLCanvasElement, quality = 0.92): Promise<Uint8Array> {
  const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("تعذّر ترميز الصفحة"))), "image/jpeg", quality))
  return new Uint8Array(await blob.arrayBuffer())
}

/** Minimal PDF 1.4 writer: one full-page JPEG per page. */
export function buildPdf(pages: { jpeg: Uint8Array; w: number; h: number }[], title: string): Blob {
  const enc = new TextEncoder()
  const parts: Uint8Array[] = []
  const offsets: number[] = []
  let length = 0
  const push = (b: Uint8Array | string) => {
    const u = typeof b === "string" ? enc.encode(b) : b
    parts.push(u)
    length += u.length
  }
  const obj = (n: number, body: () => void) => {
    offsets[n] = length
    push(`${n} 0 obj\n`)
    body()
    push("\nendobj\n")
  }
  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n")
  const n = pages.length
  // 1 catalog, 2 pages, 3 info, then per page: page, contents, image
  const pageId = (i: number) => 4 + i * 3
  obj(1, () => push("<< /Type /Catalog /Pages 2 0 R >>"))
  obj(2, () => push(`<< /Type /Pages /Count ${n} /Kids [${pages.map((_, i) => `${pageId(i)} 0 R`).join(" ")}] >>`))
  obj(3, () => push(`<< /Title <${utf16Hex(title)}> /Producer (Corporate Communications Hub) >>`))
  pages.forEach((p, i) => {
    const id = pageId(i)
    obj(id, () =>
      push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_W} ${A4_H}] /Resources << /XObject << /Im${i} ${id + 2} 0 R >> >> /Contents ${id + 1} 0 R >>`),
    )
    const content = `q ${A4_W} 0 0 ${A4_H} 0 0 cm /Im${i} Do Q`
    obj(id + 1, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`))
    obj(id + 2, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`)
      push(p.jpeg)
      push("\nendstream")
    })
  })
  const xref = length
  const total = 4 + n * 3
  let x = `xref\n0 ${total}\n0000000000 65535 f \n`
  for (let i = 1; i < total; i++) x += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`
  push(x)
  push(`trailer\n<< /Size ${total} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  return new Blob(parts as BlobPart[], { type: "application/pdf" })
}

/** Renders every `[data-report-page]` inside `root` and returns the PDF. */
export async function exportPdf(root: HTMLElement, title: string, onProgress?: (done: number, total: number) => void): Promise<Blob> {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-report-page]"))
  if (!nodes.length) throw new Error("لا توجد صفحات لتصديرها")
  await document.fonts?.ready
  const pages: { jpeg: Uint8Array; w: number; h: number }[] = []
  for (const [i, node] of nodes.entries()) {
    const canvas = await toCanvas(node, {
      pixelRatio: 2.5,
      backgroundColor: "#ffffff",
      fontEmbedCSS: FONT_CSS,
      cacheBust: false,
      width: node.offsetWidth,
      height: node.offsetHeight,
      style: { transform: "none", margin: "0" },
    })
    pages.push({ jpeg: await jpegBytes(canvas), w: canvas.width, h: canvas.height })
    onProgress?.(i + 1, nodes.length)
  }
  return buildPdf(pages, title)
}
