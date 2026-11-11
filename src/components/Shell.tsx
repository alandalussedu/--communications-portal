import type { ReactNode } from "react"
import { type ReactNode as RN } from "react"
import { BarChart3, CalendarDays, FolderOpen, HandHeart, House, Loader2, Lock, LockOpen, Megaphone, PhoneCall, UserRound } from "lucide-react"
import { cn } from "@/lib/utils"
import { LOCKED_PAGES, useRouter, type Route } from "@/lib/router"
import { useStore } from "@/data/store"
import { formatDate, formatTime } from "@/lib/format"
import { LOGO_WHITE } from "@/assets/logo"
import { Chevrons, Dot, Octagram } from "./common"
import { LatticeCanvas, Pill, useSlidingPill } from "@/lib/motion"
import { EditorLogin } from "./EditorLogin"

// رابط دخول المشرف (اختياري). فارغ = لا تظهر الأيقونة. في نسخة GitHub لا يوجد تعديل حي.
const ADMIN_URL = ""

/** `short` is the label under the icon in the phone tab bar, where width is tight. */
const NAV: { page: Route["page"]; label: string; short: string; icon: typeof House; also?: Route["page"][]; locked?: boolean }[] = [
  { page: "overview", label: "الرئيسية", short: "الرئيسية", icon: House },
  { page: "library", label: "المكتبة", short: "المكتبة", icon: FolderOpen },
  { page: "calendar", label: "رحلة التواصل", short: "الرحلة", icon: CalendarDays },
  { page: "social", label: "التواصل الاجتماعي", short: "التواصل", icon: Megaphone },
  { page: "csr", label: "المسؤولية المجتمعية", short: "المسؤولية", icon: HandHeart },
  { page: "contacts", label: "دليل الأرقام", short: "الأرقام", icon: PhoneCall },
  { page: "indicators", label: "الأداء والتطوير", short: "الأداء", icon: BarChart3, also: LOCKED_PAGES, locked: true },
]

export function SyncStatus({ onBand = false }: { onBand?: boolean }) {
  const { connection, allLoaded, lastSync, snapshotAt } = useStore()
  let tone: "ok" | "bad" | "neutral" = "neutral"
  let text = ""
  let spin = false
  if (connection.kind === "connecting" || (connection.kind === "ready" && !allLoaded)) {
    spin = true
    text = "جارٍ تحميل البيانات"
  } else if (connection.kind === "ready" && snapshotAt) {
    tone = "ok"
    text = `آخر تحديث ${formatDate(snapshotAt)} · ${formatTime(new Date(snapshotAt))}`
  } else if (connection.kind === "ready") {
    tone = "ok"
    text = lastSync ? `متصل · آخر قراءة ${formatTime(lastSync)}` : "متصل"
  } else if (connection.kind === "unavailable") {
    text = "قاعدة البيانات غير متاحة"
  } else {
    tone = "bad"
    text = "فشل الاتصال"
  }
  const pill = (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[14px]",
        onBand ? "bg-white/10 text-white ring-1 ring-white/15" : "bg-muted text-foreground",
      )}
      role="status"
      aria-live="polite"
    >
      {spin ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <span className={cn("inline-flex rounded-full", tone === "ok" && "status-pulse")}><Dot tone={tone} /></span>}
      <span className="num">{text}</span>
    </span>
  )
  if (!snapshotAt || !ADMIN_URL) return pill
  return (
    <span className="inline-flex items-center gap-2">
      {pill}
      <a
        href={ADMIN_URL}
        target="_blank"
        rel="noopener noreferrer"
        title="دخول المشرف"
        aria-label="دخول المشرف"
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors",
          onBand ? "bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/20" : "bg-muted text-foreground hover:bg-muted/70",
        )}
      >
        <UserRound className="h-4 w-4" aria-hidden="true" />
      </a>
    </span>
  )
}

export function Shell({ children }: { children: ReactNode }) {
  const { route, go } = useRouter()
  const { vault } = useStore()
  const open = vault.status === "unlocked"
  const activeKey = NAV.find((n) => route.page === n.page || n.also?.includes(route.page))?.page
  const dock = useSlidingPill<HTMLUListElement>(activeKey)
  const bar = useSlidingPill<HTMLUListElement>(activeKey)
  const badge: Partial<Record<Route["page"], RN>> = {}
  return (
    <div className="min-h-full">
      {/* «ضوء المشربية»: decorative lattice in the side margins only (wide screens) */}
      <div className="lattice-frame" aria-hidden="true" />
      <header className="relative overflow-hidden bg-band text-band-foreground" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <LatticeCanvas />
        <Octagram className="pointer-events-none absolute -end-20 -top-28 h-80 w-80 text-white/[0.08]" strokeWidth={0.8} />
        <div className="gutter relative mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 py-3">
          <button type="button" onClick={() => go({ page: "overview" })} className="flex items-center gap-4 text-start">
            <img src={LOGO_WHITE} alt="شركة الأندلس التعليمية" className="h-10 w-auto sm:h-11" />
            <span className="hidden h-9 w-px bg-white/25 sm:block" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block font-display text-[20px] font-bold leading-tight sm:text-[22px]">بوابة التواصل المؤسسي</span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[13px] text-band-soft">
                <Chevrons className="h-2.5 w-3 text-gold" />
                إدارة التواصل المؤسسي · 2026/2027
              </span>
            </span>
          </button>
          <span className="inline-flex items-center gap-2">
            <SyncStatus onBand />
            <EditorLogin onBand />
          </span>
        </div>
      </header>

      {/* tablets and up: the row of tabs under the header */}
      <nav className="nav-glint sticky top-0 z-30 hidden border-b bg-background/80 backdrop-blur-md md:block" style={{ top: "env(safe-area-inset-top, 0px)" }} aria-label="أقسام المنصة">
        <div className="gutter mx-auto max-w-[1200px]">
          <ul ref={dock.ref} className="relative flex gap-1 overflow-x-auto py-2 [scrollbar-width:none]">
            <Pill box={dock.box} ready={dock.ready} className="rounded-full bg-primary shadow-[0_6px_16px_-8px_hsl(var(--primary)/0.7)]" />
            {NAV.map((n) => {
              const active = route.page === n.page || n.also?.includes(route.page)
              const Icon = n.icon
              return (
                <li key={n.page} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => go({ page: n.page } as Route)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative z-10 inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-[15px] transition-colors duration-300",
                      active ? "font-bold text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                    {n.label}
                    {n.locked && (open ? <LockOpen className="h-3.5 w-3.5 opacity-70" aria-label="مفتوح" /> : <Lock className="h-3.5 w-3.5 opacity-70" aria-label="يتطلب كلمة مرور" />)}
                    {badge[n.page]}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </nav>

      {/* phones: a fixed tab bar at the bottom, as in a native app */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        aria-label="أقسام المنصة"
      >
        <ul ref={bar.ref} className="relative mx-auto grid max-w-[700px] grid-cols-7">
          <Pill box={bar.box && { ...bar.box, x: bar.box.x + (bar.box.w - 48) / 2, y: 8, w: 48, h: 32 }} ready={bar.ready} className="rounded-full bg-primary/10" />
          {NAV.map((n) => {
            const active = route.page === n.page || n.also?.includes(route.page)
            const Icon = n.icon
            return (
              <li key={n.page}>
                <button
                  type="button"
                  onClick={() => go({ page: n.page } as Route)}
                  aria-current={active ? "page" : undefined}
                  aria-label={n.label}
                  className={cn("relative z-10 flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] transition-colors min-[400px]:text-[12px]", active ? "font-bold text-primary" : "text-muted-foreground")}
                >
                  <span className="relative inline-flex h-8 w-12 items-center justify-center rounded-full">
                    <Icon className="h-[22px] w-[22px]" aria-hidden="true" />
                    {badge[n.page] && <span className="absolute -end-2 -top-1">{badge[n.page]}</span>}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    {n.short}
                    {n.locked && !open && <Lock className="h-3 w-3 opacity-70" aria-hidden="true" />}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <main className="gutter relative mx-auto max-w-[1200px] pb-16">
        <div key={route.page} className="page-enter">{children}</div>
      </main>

      <footer className="gutter relative mx-auto max-w-[1200px] pb-28 md:pb-10">
        <div className="flex items-center gap-3 text-primary">
          <span className="h-px flex-1 bg-primary/40" aria-hidden="true" />
          <Octagram className="h-7 w-7 text-sky" strokeWidth={4} />
          <Chevrons className="h-4 w-5 text-gold" />
        </div>
        <p className="mt-3 text-[14px] text-muted-foreground">
          إدارة التواصل المؤسسي · شركة الأندلس التعليمية. بيانات المؤشرات منقولة من ملفات Google Sheets المعتمدة ولا يطّلع عليها إلا المسجّلون، والمنصة لا تعدّل تلك الملفات.
        </p>
      </footer>
    </div>
  )
}
