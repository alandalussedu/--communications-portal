import { useMemo, useState } from "react"
import { ExternalLink, Search } from "lucide-react"
import type { PbxDirectory } from "@/data/types"
import { formatDate, formatNumber, matches } from "@/lib/format"
import { placeOf } from "@/lib/pbxBranches"

/** «دليل التحويلات»: the read-only copy of the sheet, a lookup, and what the sheet needs fixing. */
export function DirectoryPanel({ directory }: { directory: PbxDirectory | null }) {
  const [q, setQ] = useState("")
  const [allIssues, setAllIssues] = useState(false)
  const found = useMemo(() => {
    const s = q.trim()
    if (!directory || !s) return []
    return directory.entries.filter((e) => e.ext.startsWith(s) || matches(s, e.name, e.title, e.section)).slice(0, 40)
  }, [directory, q])

  if (!directory)
    return (
      <div className="mt-5 rounded-xl border bg-muted/30 p-5 text-[15px] leading-relaxed">
        لم يُنسخ دليل التحويلات بعد. يُنسخ من ملف «دليل تحويلات مدارس الأندلس - الاداري» من جلسة Claude مع «حدث المؤشرات»، والملف نفسه لا يُعدَّل.
      </div>
    )
  const named = directory.entries.filter((e) => e.name).length
  return (
    <div className="mt-5 flex flex-col gap-4">
      <div className="rounded-xl border px-4 py-3 text-[14px] leading-relaxed">
        <p>
          <b className="num">{formatNumber(directory.entries.length)}</b> تحويلة، منها <b className="num">{formatNumber(named)}</b> بأسماء أصحابها. نُسخ في {formatDate(directory.syncedAt)}.
        </p>
        <p className="text-muted-foreground">{directory.source}</p>
        {directory.sourceUrl && (
          <a href={directory.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1.5 font-bold text-primary hover:underline">
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            فتح الملف
          </a>
        )}
        <p className="mt-1 text-[13px] text-muted-foreground">يُحدَّث مع «حدث المؤشرات». الفرع والقسم في التقرير من رقم التحويلة، والاسم والمسمى من الدليل.</p>
      </div>

      <label className="relative block">
        <span className="sr-only">ابحث في الدليل</span>
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="رقم تحويلة أو اسم أو مسمى" className="h-11 w-full rounded-md border border-input bg-card pe-3 ps-9 text-[16px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30" />
      </label>
      {q.trim() && (
        <ul className="divide-y overflow-hidden rounded-xl border">
          {found.length === 0 && <li className="px-4 py-3 text-[14px] text-muted-foreground">لا نتيجة في الدليل.</li>}
          {found.map((e) => {
            const p = placeOf(e.ext, e)
            return (
              <li key={e.ext} className="flex items-start justify-between gap-3 px-4 py-2.5">
                <span className="min-w-0">
                  <span className="block font-bold leading-snug">{e.name ?? "بلا اسم"}</span>
                  <span className="block text-[13px] leading-snug text-muted-foreground">{[e.title, p ? `${p.branch} · ${p.section}` : e.section].filter(Boolean).join(" · ")}</span>
                  {e.others && e.others.length > 0 && <span className="block text-[12px] leading-snug text-warn">في الدليل أيضًا: {e.others.join("، ")}</span>}
                </span>
                <span className="num shrink-0 rounded-md bg-muted px-2 text-[14px] font-bold">{e.ext}</span>
              </li>
            )
          })}
        </ul>
      )}

      {directory.issues.length > 0 && (
        <div className="rounded-xl border border-s-4 border-s-warn">
          <div className="px-4 pt-3">
            <h3 className="text-[16px] font-bold">ملاحظات على ملف الدليل</h3>
            <p className="text-[13px] text-muted-foreground">تُصحَّح في الملف نفسه، ثم تُحدَّث المنصة. حتى ذلك الحين يظهر الاسم الأول.</p>
          </div>
          <ul className="mt-2 divide-y border-t text-[13.5px] leading-relaxed">
            {(allIssues ? directory.issues : directory.issues.slice(0, 8)).map((t) => (
              <li key={t} className="px-4 py-2">{t}</li>
            ))}
          </ul>
          {directory.issues.length > 8 && (
            <button type="button" onClick={() => setAllIssues((a) => !a)} className="w-full border-t px-4 py-2.5 text-start text-[13.5px] font-bold text-primary hover:bg-accent">
              {allIssues ? "عرض أقل" : `عرض الكل (${formatNumber(directory.issues.length)})`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
