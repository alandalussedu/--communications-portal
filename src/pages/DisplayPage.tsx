import { useCallback, useEffect, useRef, useState } from "react"
import { Copy, Expand, Lock } from "lucide-react"
import { toast } from "sonner"
import { useStore } from "@/data/store"
import { supabase } from "@/lib/backend"
import { PageHeader, Panel } from "@/components/common"
import { cn } from "@/lib/utils"

/**
 * «شاشة العرض»: the manager's big-screen views, for the platform owner only.
 * The views themselves live in public/screen/ (one page for this tab and for the
 * TV in the manager's room). Here it runs in a frame with ?embed=1 and borrows
 * this page's own Supabase session through window.__andalusScreen; it never
 * refreshes the session itself, so it cannot sign the owner out.
 */

const VIEWS = [
  { n: 1, title: "الطلاب والانسحاب", hint: "الإشغال والانسحاب والمستهدف" },
  { n: 2, title: "رضا العملاء", hint: "وجودة التواصل لكل فرع" },
  { n: 3, title: "المسؤولية المجتمعية", hint: "خطط الفروع والاعتماد" },
  { n: 4, title: "التواصل الاجتماعي", hint: "حسب المدارس والشركة" },
  { n: 5, title: "قنوات الواتساب", hint: "المشتركون لكل قناة" },
]
const COUNT = VIEWS.length
const VIEW_KEY = "andalus-display-view"
type Bridge = { __andalusScreen?: { token(): Promise<string | null> } }

function storedView(): number {
  try {
    const v = Number(localStorage.getItem(VIEW_KEY))
    return v >= 1 && v <= COUNT ? v : 1
  } catch {
    return 1
  }
}

export function DisplayPage() {
  const { vault } = useStore()
  const frame = useRef<HTMLIFrameElement>(null)
  const [view, setView] = useState(storedView)
  const [src] = useState(() => `./screen/?embed=1&view=${storedView()}`)

  useEffect(() => {
    const w = window as unknown as Bridge
    w.__andalusScreen = {
      token: async () => {
        const sb = supabase()
        if (!sb) return null
        const { data } = await sb.auth.getSession()
        return data.session?.access_token ?? null
      },
    }
    const onMessage = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data?.type === "andalus-screen-view" && typeof e.data.view === "number") setView(e.data.view)
    }
    window.addEventListener("message", onMessage)
    return () => {
      delete w.__andalusScreen
      window.removeEventListener("message", onMessage)
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, String(view))
    } catch {
      /* the choice is only remembered when storage is allowed */
    }
  }, [view])

  const pick = useCallback((n: number) => {
    const v = ((n - 1 + COUNT) % COUNT) + 1
    setView(v)
    frame.current?.contentWindow?.postMessage({ type: "andalus-screen", view: v }, window.location.origin)
  }, [])
  const full = useCallback(() => {
    const el = frame.current as (HTMLIFrameElement & { webkitRequestFullscreen?: () => void }) | null
    if (!el) return
    if (el.requestFullscreen) void el.requestFullscreen().then(() => el.focus()).catch(() => {})
    else el.webkitRequestFullscreen?.()
  }, [])

  // the same keys as on the TV while the page (not the frame) has focus
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      if (e.altKey || e.ctrlKey || e.metaKey) return
      if (/^[1-5]$/.test(e.key)) pick(Number(e.key))
      else if (e.key === "ArrowLeft") pick(view + 1)
      else if (e.key === "ArrowRight") pick(view - 1)
      else if (e.key === "f" || e.key === "F") full()
      else return
      e.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [view, pick, full])

  if (!vault.isOwner)
    return (
      <Panel className="mx-auto mt-8 max-w-lg p-8 text-center">
        <Lock className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-3 text-[22px] font-bold">شاشة العرض لمدير المنصة فقط</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">هذه الصفحة متاحة لحسابات مدير المنصة وحدها.</p>
      </Panel>
    )

  const tvLink = new URL("./screen/", window.location.href.split("#")[0]).href
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(tvLink)
      toast.success("نُسخ رابط التلفزيون", { description: "افتحه في متصفح التلفزيون وادخل بحساب «شاشة عرض»." })
    } catch {
      toast.message("رابط التلفزيون", { description: tvLink })
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-primary px-2.5 py-0.5 text-[12px] font-bold text-primary-foreground">
              <Lock className="h-3 w-3" aria-hidden="true" />
              مدير المنصة فقط
            </span>
            الأداء والتطوير
          </span>
        }
        title="شاشة العرض"
        description="خمسة عروض مختصرة للشاشة الكبيرة. اختر العرض بنفسك، ولا ينتقل وحده."
        actions={
          <>
            <button type="button" onClick={copyLink} title={tvLink} className="inline-flex h-11 items-center gap-2 rounded-full border bg-card px-4 text-[15px] font-bold text-primary hover:bg-accent">
              <Copy className="h-4 w-4" aria-hidden="true" />
              رابط التلفزيون
            </button>
            <button type="button" onClick={full} className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-[15px] font-bold text-primary-foreground hover:bg-primary/90">
              <Expand className="h-4 w-4" aria-hidden="true" />
              ملء الشاشة
            </button>
          </>
        }
      />
      <div role="radiogroup" aria-label="العرض" className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {VIEWS.map((v) => {
          const on = v.n === view
          return (
            <button
              key={v.n}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => pick(v.n)}
              className={cn(
                "flex min-w-0 items-center gap-3 rounded-2xl border bg-card px-4 py-3.5 text-start transition-colors hover:bg-accent",
                on && "border-gold bg-gold-soft ring-2 ring-gold/35 hover:bg-gold-soft",
              )}
            >
              <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-[16px] font-bold", on ? "bg-gold text-[#12122a]" : "bg-muted")}>{v.n}</span>
              <span className="min-w-0">
                <span className="block truncate text-[16px] font-bold">{v.title}</span>
                <span className="block truncate text-[12.5px] text-muted-foreground">{v.hint}</span>
              </span>
            </button>
          )
        })}
      </div>
      <div className="overflow-hidden rounded-2xl border bg-[#05050f] shadow-[0_20px_40px_-20px_rgb(20_20_80/0.45)]" style={{ aspectRatio: "16 / 9" }}>
        <iframe ref={frame} src={src} title="شاشة العرض" className="block h-full w-full border-0" allow="fullscreen; screen-wake-lock" allowFullScreen />
      </div>
      <p className="mt-3 flex flex-wrap justify-between gap-2 text-[13.5px] text-muted-foreground">
        <span>
          بلوحة المفاتيح: <kbd className="rounded border bg-card px-1.5 font-bold">1</kbd>–<kbd className="rounded border bg-card px-1.5 font-bold">5</kbd> أو الأسهم · <kbd className="rounded border bg-card px-1.5 font-bold">F</kbd> ملء الشاشة
        </span>
        <span>على التلفزيون: افتح الرابط وادخل بحساب «شاشة عرض» من صفحة الأعضاء، والتحكم بأرقام الريموت أو أسهمه.</span>
      </p>
    </>
  )
}
