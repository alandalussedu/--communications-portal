import { useEffect, useState } from "react"

type DownloadsNs = { save(req: { filename: string; data: Blob | string | ArrayBuffer }): Promise<{ status: "saved" | "delivered" }> }

let cached: Promise<DownloadsNs | null> | null = null

function load(): Promise<DownloadsNs | null> {
  if (!cached) {
    cached = (async () => {
      const start = Date.now()
      while (Date.now() - start < 4000) {
        if (window.claude?.use) return ((await window.claude.use("downloads").catch(() => null)) as DownloadsNs | null) ?? null
        await new Promise((r) => setTimeout(r, 150))
      }
      return null
    })()
  }
  return cached
}

/** The viewer's save capability. `null` once known to be unavailable; `undefined` while checking. */
export function useDownloads(): DownloadsNs | null | undefined {
  const [ns, setNs] = useState<DownloadsNs | null | undefined>(undefined)
  useEffect(() => {
    let live = true
    load().then((v) => live && setNs(v))
    return () => {
      live = false
    }
  }, [])
  return ns
}

export const SAVE_ERROR: Record<string, string> = {
  declined: "أُلغي الحفظ.",
  rate_limited: "توجد نافذة حفظ مفتوحة بالفعل. أكملها أو انتظر قليلًا ثم أعد المحاولة.",
  too_large: "الملف أكبر من المسموح في هذا العرض.",
  rejected_extension: "صيغة الملف غير مسموحة في هذا العرض.",
  extension_not_enabled: "هذه الصيغة غير متاحة للتنزيل في هذا العرض.",
}
