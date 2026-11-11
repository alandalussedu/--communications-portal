/** A campus's approved districts as A4 pages (captured by pdf.ts) — also the print layout. */
import type { ReactNode } from "react"
import { LOGO_NAVY } from "@/assets/logo"
import { formatDate, formatNumber } from "@/lib/format"
import { PAGE_H, PAGE_W } from "./ReportPages"

const PER_PAGE = 60 // three columns of twenty

export function campusPages({ campus, city, year, districts, publishedAt, qr }: { campus: string; city: string; year: string; districts: string[]; publishedAt: string | null; qr?: string }): ReactNode[] {
  const chunks: string[][] = []
  for (let i = 0; i < Math.max(1, districts.length); i += PER_PAGE) chunks.push(districts.slice(i, i + PER_PAGE))
  return chunks.map((part, p) => (
    <div key={p} className="report-page relative flex flex-col overflow-hidden bg-white font-sans text-foreground" style={{ width: PAGE_W, height: PAGE_H }} dir="rtl" data-report-page>
      <div className="flex items-center justify-between gap-6 bg-band px-12 py-7 text-band-foreground">
        <div className="min-w-0">
          <div className="text-[13px] text-band-soft">النقل المدرسي · العام الدراسي {year}</div>
          <h1 className="mt-1 text-[22px] font-extrabold leading-snug">الأحياء المعتمدة لخدمة النقل المدرسي</h1>
        </div>
        <span className="shrink-0 rounded-lg bg-white px-3 py-2">
          <img src={LOGO_NAVY} alt="شركة الأندلس التعليمية" style={{ height: 46, width: "auto" }} />
        </span>
      </div>
      <div className="flex h-1">
        <span className="flex-1" style={{ background: "#c4c4cc" }} />
        <span className="flex-1" style={{ background: "#b8962e" }} />
        <span className="flex-1" style={{ background: "#2a9fd6" }} />
      </div>
      <div className="flex flex-1 flex-col px-12 pt-7">
        <div className="mb-5 flex items-end justify-between gap-4 border-b-2 border-primary pb-3">
          <div>
            <h2 className="text-[20px] font-extrabold text-primary">{campus}</h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{city} · <span className="num">{formatNumber(districts.length)}</span> حيًّا معتمدًا{chunks.length > 1 ? ` · الجزء ${formatNumber(p + 1)} من ${formatNumber(chunks.length)}` : ""}</p>
          </div>
          {qr && p === 0 && <img src={qr} alt="" style={{ width: 74, height: 74 }} />}
        </div>
        <ol className="grid grid-cols-3 gap-x-6" style={{ gridAutoFlow: "column", gridTemplateRows: `repeat(${Math.min(20, Math.ceil(part.length / 3) || 1)}, auto)` }}>
          {part.map((d, i) => (
            <li key={i} className="flex items-baseline gap-2 border-b border-dashed border-border/80 py-[7px] text-[13.5px]">
              <span className="num w-6 shrink-0 text-[11px] text-muted-foreground">{formatNumber(p * PER_PAGE + i + 1)}</span>
              <span className="min-w-0">{d}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="flex items-center justify-between border-t px-12 py-3 text-[11px] text-muted-foreground">
        <span><b className="text-foreground">شركة الأندلس التعليمية</b> · إدارة التواصل المؤسسي</span>
        <span className="num">{publishedAt ? `نُشرت القائمة ${formatDate(publishedAt)}` : ""}</span>
        <span className="num font-bold text-primary">صفحة {formatNumber(p + 1)} من {formatNumber(chunks.length)}</span>
      </div>
    </div>
  ))
}
