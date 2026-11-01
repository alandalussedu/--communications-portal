import { useEffect, useRef, useState, type ReactNode } from "react"
import { Film, ImageOff, Loader2, Pause, Play, RefreshCw, Settings2, Upload } from "lucide-react"
import { toast } from "sonner"
import { useStore } from "@/data/store"
import type { HeroSettings } from "@/data/types"
import { cn } from "@/lib/utils"
import { Chevrons } from "./common"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"

export const HERO_TITLE = "عن ماذا تبحث اليوم؟"
export const HERO_SUBTITLE = "ملفات الهوية البصرية والأدلة والسياسات والنماذج في مكان واحد."
const MAX_VIDEO_BYTES = 2 * 1024 * 1024

const blobUrl = (id: string | null | undefined) => (id && /^[0-9a-f]{32}$/i.test(id) ? `/_blob/${id}` : null)

/* ------------------------------------------------------------ when to play */
type NetInfo = { saveData?: boolean; effectiveType?: string; addEventListener?: (t: string, f: () => void) => void; removeEventListener?: (t: string, f: () => void) => void }
function stillReason(): boolean {
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true
    if (window.matchMedia("(max-width: 767px)").matches) return true
    const c = (navigator as Navigator & { connection?: NetInfo }).connection
    if (c?.saveData) return true
    if (c?.effectiveType && /(^|-)2g$|^3g$/.test(c.effectiveType)) return true
  } catch {
    /* no media queries: keep the video */
  }
  return false
}
function usePreferStill() {
  const [still, setStill] = useState(stillReason)
  useEffect(() => {
    const update = () => setStill(stillReason())
    const qs = ["(prefers-reduced-motion: reduce)", "(max-width: 767px)"].map((q) => window.matchMedia?.(q)).filter(Boolean) as MediaQueryList[]
    qs.forEach((q) => q.addEventListener?.("change", update))
    const c = (navigator as Navigator & { connection?: NetInfo }).connection
    c?.addEventListener?.("change", update)
    return () => {
      qs.forEach((q) => q.removeEventListener?.("change", update))
      c?.removeEventListener?.("change", update)
    }
  }, [])
  return still
}

/* ------------------------------------------------------------ background */
function HeroMedia({ hero, paused, onLive }: { hero: HeroSettings | undefined; paused: boolean; onLive: (live: boolean) => void }) {
  const preferStill = usePreferStill()
  const video = blobUrl(hero?.videoId)
  const poster = blobUrl(hero?.posterId)
  const [videoFailed, setVideoFailed] = useState(false)
  const [videoShown, setVideoShown] = useState(false)
  const [posterShown, setPosterShown] = useState(false)
  const [posterFailed, setPosterFailed] = useState(false)
  const ref = useRef<HTMLVideoElement>(null)
  const playVideo = !!video && !hero?.videoOff && !preferStill && !videoFailed

  useEffect(() => {
    setVideoFailed(false)
    setVideoShown(false)
  }, [video])
  useEffect(() => {
    setPosterFailed(false)
    setPosterShown(false)
  }, [poster])

  useEffect(() => {
    const v = ref.current
    if (!v || !playVideo) return
    v.muted = true
    v.defaultMuted = true
    // autoplay can be refused (power saving): the still image stays, no message
    if (paused) v.pause()
    else v.play()?.catch(() => {})
  }, [playVideo, video, paused])
  // the pause button only shows while there is a video actually playing
  useEffect(() => onLive(playVideo && videoShown), [playVideo, videoShown, onLive])

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {poster && !posterFailed && (
        <img
          src={poster}
          alt=""
          decoding="async"
          onLoad={() => setPosterShown(true)}
          onError={() => setPosterFailed(true)}
          className={cn("absolute inset-0 h-full w-full object-cover transition-opacity duration-700", posterShown ? "opacity-100" : "opacity-0")}
        />
      )}
      {playVideo && (
        <video
          ref={ref}
          src={video}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          disablePictureInPicture
          onPlaying={() => setVideoShown(true)}
          onError={() => setVideoFailed(true)}
          className={cn("absolute inset-0 h-full w-full object-cover transition-opacity duration-700", videoShown ? "opacity-100" : "opacity-0")}
        />
      )}
      {/* dark gradient: strongest behind the text (the start side in RTL) */}
      <div className="hero-shade absolute inset-0" />
      {/* a slow drift of light */}
      <div className="hero-drift absolute inset-0" />
    </div>
  )
}

/* ------------------------------------------------------------ band */
export function HomeHero({ children }: { children: ReactNode }) {
  const { data, canEdit } = useStore()
  const hero = data.settings?.hero
  const [editing, setEditing] = useState(false)
  const [paused, setPaused] = useState(false)
  const [live, setLive] = useState(false)
  const ctl = "hero-ctl inline-flex h-10 w-10 items-center justify-center rounded-full text-white"
  return (
    <section className="hero-band rise relative mt-6 overflow-hidden rounded-2xl text-white">
      <HeroMedia hero={hero} paused={paused} onLive={setLive} />
      <div className="relative px-4 py-4 sm:px-8 sm:py-6">
        <div className="min-w-0 max-w-3xl">
          <p className="flex items-center gap-2 text-[14px] text-white/85">
            <Chevrons className="h-2.5 w-3 text-gold" />
            إدارة التواصل المؤسسي
          </p>
          <h1 className="hero-text mt-1 text-[24px] font-extrabold leading-tight sm:text-[34px]">{hero?.title?.trim() || HERO_TITLE}</h1>
          <p className="hero-text mt-1 text-[14px] text-white/90 sm:text-[16px]">{hero?.subtitle?.trim() || HERO_SUBTITLE}</p>
          {children}
        </div>
      </div>
      {(live || canEdit) && (
        <div className="absolute end-3 top-3 flex items-center gap-2">
          {live && (
            <button type="button" onClick={() => setPaused((p) => !p)} className={ctl} aria-label={paused ? "تشغيل الفيديو" : "إيقاف الفيديو مؤقتًا"} title={paused ? "تشغيل" : "إيقاف مؤقت"}>
              {paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
            </button>
          )}
          {canEdit && (
            <button type="button" onClick={() => setEditing(true)} className={ctl} aria-label="إعدادات شريط الترحيب" title="إعدادات الشريط">
              <Settings2 className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
      {canEdit && (
        <Sheet open={editing} onOpenChange={setEditing}>
          <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-lg" dir="rtl">
            <SheetHeader className="pe-8 text-start">
              <SheetTitle className="text-start text-[22px] font-bold">شريط الترحيب</SheetTitle>
              <SheetDescription className="text-start text-[15px]">النص والفيديو في أعلى الصفحة الرئيسية. يظهر التعديل لكل من يفتح المنصة.</SheetDescription>
            </SheetHeader>
            <HeroEditor hero={hero} onDone={() => setEditing(false)} />
          </SheetContent>
        </Sheet>
      )}
    </section>
  )
}

/* ------------------------------------------------------------ editor (editors only) */
type AssetsNs = { upload(b: Blob): Promise<{ id: string; url: string; sizeBytes: number }>; delete(id: string): Promise<void> }
async function getAssets(): Promise<AssetsNs | null> {
  try {
    return ((await window.claude?.use("assets")) as AssetsNs | null) ?? null
  } catch {
    return null
  }
}

/** Reads the clip's length and grabs a still frame for the poster. */
function inspectVideo(file: File): Promise<{ duration: number; poster: Blob | null }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const v = document.createElement("video")
    v.muted = true
    v.playsInline = true
    v.preload = "auto"
    v.src = url
    const done = (r: { duration: number; poster: Blob | null } | null, err?: string) => {
      URL.revokeObjectURL(url)
      if (r) resolve(r)
      else reject(new Error(err))
    }
    v.onerror = () => done(null, "unreadable")
    v.onloadedmetadata = () => {
      const duration = v.duration
      v.currentTime = Math.min(1, duration / 3)
      v.onseeked = () => {
        try {
          const w = Math.min(1280, v.videoWidth || 1280)
          const h = Math.round((w * (v.videoHeight || 720)) / (v.videoWidth || 1280))
          const c = document.createElement("canvas")
          c.width = w
          c.height = h
          c.getContext("2d")!.drawImage(v, 0, 0, w, h)
          c.toBlob((b) => done({ duration, poster: b }), "image/jpeg", 0.82)
        } catch {
          done({ duration, poster: null })
        }
      }
    }
  })
}

function HeroEditor({ hero, onDone }: { hero: HeroSettings | undefined; onDone: () => void }) {
  const { saveSettings } = useStore()
  const [title, setTitle] = useState(hero?.title ?? "")
  const [subtitle, setSubtitle] = useState(hero?.subtitle ?? "")
  const [busy, setBusy] = useState<"" | "text" | "video" | "toggle">("")
  const [note, setNote] = useState<{ tone: "bad" | "warn"; text: string } | null>(null)
  const [assets, setAssets] = useState<AssetsNs | null | undefined>(undefined)
  const fileRef = useRef<HTMLInputElement>(null)
  const poster = blobUrl(hero?.posterId)
  const inputCls = "h-10 w-full rounded-md border border-input bg-card px-3 text-[16px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"

  useEffect(() => {
    void getAssets().then(setAssets)
  }, [])

  const save = (patch: Partial<HeroSettings>) => saveSettings({ hero: { ...(hero ?? {}), ...patch } })

  const pick = async (file: File | undefined) => {
    if (!file || !assets) return
    setNote(null)
    if (file.type !== "video/mp4" && !/\.mp4$/i.test(file.name)) return setNote({ tone: "bad", text: "اختر ملف فيديو بصيغة mp4 (H.264)." })
    if (file.size > MAX_VIDEO_BYTES) return setNote({ tone: "bad", text: `حجم الملف ${(file.size / 1048576).toFixed(1)}MB، والحد 2MB حتى تبقى الرئيسية سريعة. قصّر المقطع أو اضغطه ثم أعد المحاولة.` })
    setBusy("video")
    try {
      const info = await inspectVideo(file).catch(() => null)
      if (!info) {
        setNote({ tone: "bad", text: "تعذّر تشغيل الملف في المتصفح. صدّره بصيغة mp4 بترميز H.264 ثم أعد المحاولة." })
        return
      }
      const v = await assets.upload(file)
      const p = info.poster ? await assets.upload(new File([info.poster], "hero-poster.jpg", { type: "image/jpeg" })).catch(() => null) : null
      const old = [hero?.videoId, hero?.posterId].filter(Boolean) as string[]
      const ok = await save({ videoId: v.id, posterId: p?.id ?? null, videoOff: false })
      if (ok) {
        // the replaced files are no longer used by any page
        for (const id of old) await assets.delete(id).catch(() => {})
        if (info.duration < 6 || info.duration > 10) setNote({ tone: "warn", text: `رُفع الفيديو. مدته ${Math.round(info.duration)} ثوانٍ، والأنسب بين 6 و10 ثوانٍ لتكرار سلس.` })
      } else {
        for (const id of [v.id, p?.id].filter(Boolean) as string[]) await assets.delete(id).catch(() => {})
      }
    } catch {
      toast.error("لم يُرفع الفيديو", { description: "تعذّر رفع الملف إلى المنصة. أعد المحاولة بعد قليل." })
    } finally {
      setBusy("")
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  return (
    <div className="mt-5 space-y-6">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy("text")
          await save({ title: title.trim() || null, subtitle: subtitle.trim() || null })
          setBusy("")
        }}
      >
        <div>
          <label htmlFor="hero-title" className="mb-1 block text-[15px] font-medium">العنوان</label>
          <input id="hero-title" value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder={HERO_TITLE} className={inputCls} />
        </div>
        <div>
          <label htmlFor="hero-sub" className="mb-1 block text-[15px] font-medium">السطر الفرعي</label>
          <input id="hero-sub" value={subtitle} maxLength={110} onChange={(e) => setSubtitle(e.target.value)} placeholder={HERO_SUBTITLE} className={inputCls} />
        </div>
        <p className="text-[13px] text-muted-foreground">اترك الحقل فارغًا ليظهر النص الافتراضي.</p>
        <button type="submit" disabled={!!busy} className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-[15px] font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
          {busy === "text" && <Loader2 className="h-4 w-4 animate-spin" />}
          حفظ النص
        </button>
      </form>

      <section className="space-y-3 border-t pt-5">
        <h3 className="flex items-center gap-2 text-[17px] font-bold">
          <Film className="h-4 w-4" aria-hidden="true" />
          فيديو الخلفية
        </h3>
        <div className="relative aspect-video overflow-hidden rounded-xl border hero-band">
          {poster ? <img src={poster} alt="الصورة الثابتة للفيديو الحالي" className="h-full w-full object-cover" /> : (
            <span className="flex h-full items-center justify-center gap-2 text-[14px] text-white/85">
              <ImageOff className="h-4 w-4" aria-hidden="true" />
              {hero?.videoId ? "لا توجد صورة ثابتة" : "لا يوجد فيديو: تظهر خلفية بألوان الهوية"}
            </span>
          )}
          {hero?.videoId && <span className="absolute bottom-2 start-2 rounded-full bg-card px-2.5 py-0.5 text-[13px] font-bold text-foreground">{hero.videoOff ? "متوقف" : "يعمل"}</span>}
        </div>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          mp4 بترميز H.264، من 6 إلى 10 ثوانٍ، وأقل من 2MB، ويُفضّل بلا صوت. تُؤخذ الصورة الثابتة تلقائيًا من الفيديو، وتظهر بدله على الجوال وعند الاتصال البطيء ولمن فعّل تقليل الحركة.
        </p>
        {assets === null && <p className="text-[14px] text-warn">رفع الملفات غير متاح في هذا العرض. افتح المنصة من حساب يملك صلاحية التعديل.</p>}
        {note && <p className={cn("text-[14px]", note.tone === "bad" ? "text-bad" : "text-warn")}>{note.text}</p>}
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept="video/mp4" className="sr-only" id="hero-file" onChange={(e) => void pick(e.target.files?.[0])} disabled={!assets || !!busy} />
          <label
            htmlFor="hero-file"
            className={cn("inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border px-4 text-[15px] hover:bg-accent", (!assets || busy) && "pointer-events-none opacity-50")}
          >
            {busy === "video" ? <Loader2 className="h-4 w-4 animate-spin" /> : hero?.videoId ? <RefreshCw className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
            {busy === "video" ? "جارٍ الرفع…" : hero?.videoId ? "تغيير الفيديو" : "رفع فيديو"}
          </label>
          {hero?.videoId && (
            <button
              type="button"
              disabled={!!busy}
              onClick={async () => {
                setBusy("toggle")
                await save({ videoOff: !hero.videoOff })
                setBusy("")
              }}
              className="inline-flex h-10 items-center gap-2 rounded-full border px-4 text-[15px] hover:bg-accent disabled:opacity-50"
            >
              {busy === "toggle" ? <Loader2 className="h-4 w-4 animate-spin" /> : hero.videoOff ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              {hero.videoOff ? "تشغيل الفيديو" : "إيقاف الفيديو"}
            </button>
          )}
        </div>
        {hero?.videoOff && <p className="text-[13px] text-muted-foreground">والفيديو متوقف، تظهر صورته الثابتة، أو خلفية بألوان الهوية إن لم توجد صورة.</p>}
      </section>
      <div className="border-t pt-4">
        <button type="button" onClick={onDone} className="h-10 rounded-full border px-5 text-[15px] hover:bg-accent">إغلاق</button>
      </div>
    </div>
  )
}
