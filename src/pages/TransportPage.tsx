import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ArrowLeft, Building2, BusFront, Check, Copy, FileDown, FileSpreadsheet, Link2, Loader2, MapPin, MapPinned, PhoneCall, Printer, QrCode, Search, Share2, ShieldCheck, X } from "lucide-react"
import QRCode from "qrcode"
import * as XLSX from "xlsx"
import { toast } from "sonner"
import { useRouter } from "@/lib/router"
import { formatDate, formatNumber } from "@/lib/format"
import { CountUp } from "@/lib/motion"
import { canShare, shareLink } from "@/lib/native"
import { useDownloads } from "@/lib/downloads"
import { loadTransport, publicStats, tnorm, type TCampus, type TransportData } from "@/lib/transport"
import { cn } from "@/lib/utils"
import { EmptyState, LoadingBlock, Panel } from "@/components/common"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { exportPdf } from "@/report/pdf"
import { campusPages } from "@/report/transport"
import { BUS_IMAGE } from "./transport/busImage"
import type { MapCity, MapPin as Pin } from "./transport/CityMap"

const Bus3D = lazy(() => import("./transport/Bus3D"))
const CityMap = lazy(() => import("./transport/CityMap"))
const TransportAdmin = lazy(() => import("./transport/Admin"))

/** the public address of a view of this page (the site, never the app's internal address) */
const SITE = "https://alandalussedu.github.io/--communications-portal/"
export const transportUrl = (view?: string) => `${/^https?:/.test(location.origin) && !/localhost|127\.0\.0\.1|capacitor/.test(location.origin) ? location.origin + location.pathname : SITE}#transport${view ? `-${encodeURIComponent(view)}` : ""}`

const copy = (text: string, ok: string) => navigator.clipboard?.writeText(text).then(() => toast.success(ok), () => toast.error("لم يُنسخ"))

function lev(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length]
}

/** one district of one city, with every campus that serves it */
type Hit = { key: string; names: string[]; norm: string; cityId: string; campuses: TCampus[]; lat: number | null; lng: number | null }

function indexDistricts(d: TransportData): Hit[] {
  const by = new Map<string, Hit>()
  for (const c of d.campuses)
    for (const x of c.districts) {
      const key = `${c.cityId}|${x.norm}`
      const h = by.get(key) ?? { key, names: [], norm: x.norm, cityId: c.cityId, campuses: [], lat: x.lat, lng: x.lng }
      if (!h.names.includes(x.name)) h.names.push(x.name)
      h.campuses.push(c)
      by.set(key, h)
    }
  return [...by.values()].sort((a, b) => a.names[0].localeCompare(b.names[0], "ar"))
}

export function TransportPage({ view }: { view?: string }) {
  const { go } = useRouter()
  const [state, setState] = useState<{ data: TransportData | null; error?: string; loading: boolean }>({ data: null, loading: true })
  const reload = useCallback(() => loadTransport().then((r) => setState({ ...r, loading: false })), [])
  useEffect(() => void reload(), [reload])

  if (view === "admin")
    return (
      <Suspense fallback={<Panel className="mt-8"><LoadingBlock rows={4} label="جارٍ فتح لوحة الإدارة…" /></Panel>}>
        <TransportAdmin live={state.data} onChanged={reload} />
      </Suspense>
    )
  return <PublicView data={state.data} loading={state.loading} error={state.error} view={view} go={(v) => go({ page: "transport", view: v })} />
}

function PublicView({ data, loading, error, view, go }: { data: TransportData | null; loading: boolean; error?: string; view?: string; go: (view?: string) => void }) {
  const { go: route } = useRouter()
  const campusId = view?.startsWith("c-") ? view.slice(2) : null
  const [q, setQ] = useState(view?.startsWith("q-") ? view.slice(2) : "")
  const [city, setCity] = useState("all")
  const [campus, setCampus] = useState("all")
  const [picked, setPicked] = useState<string | null>(null)
  const [mapCity, setMapCity] = useState<string | null>(null)
  const [mapOn, setMapOn] = useState(false)
  const mapRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  const index = useMemo(() => (data ? indexDistricts(data) : []), [data])
  const stats = data ? publicStats(data) : null
  const cityName = (id: string) => data?.cities.find((c) => c.id === id)?.name ?? ""
  const words = tnorm(q).split(" ").filter(Boolean)
  const filtering = words.length > 0 || city !== "all" || campus !== "all"
  const hits = index.filter((h) => (city === "all" || h.cityId === city) && (campus === "all" || h.campuses.some((c) => c.id === campus)) && words.every((w) => h.norm.includes(w)))
  const suggestions = words.length && !picked ? hits.slice(0, 7) : []
  const similar = useMemo(() => {
    if (!words.length || hits.length) return []
    const n = tnorm(q)
    return index.map((h) => ({ h, d: lev(n, h.norm) })).filter((x) => x.d <= Math.max(2, Math.ceil(n.length / 3))).sort((a, b) => a.d - b.d).slice(0, 5).map((x) => x.h)
  }, [q, hits.length, index]) // eslint-disable-line react-hooks/exhaustive-deps
  const shown = picked ? hits.filter((h) => h.key === picked) : hits

  // the map only loads when its section comes into view
  useEffect(() => {
    const el = mapRef.current
    if (!el || mapOn) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setMapOn(true), { rootMargin: "300px" })
    io.observe(el)
    return () => io.disconnect()
  }, [mapOn, data])

  const mapCities: MapCity[] = useMemo(
    () => (data?.cities ?? []).map((c) => ({ id: c.id, name: c.name, campuses: data!.campuses.filter((x) => x.cityId === c.id).length, districts: index.filter((h) => h.cityId === c.id).length })),
    [data, index],
  )
  const pins: Pin[] = index.filter((h) => h.lat !== null && h.lng !== null).map((h) => ({ id: h.key, name: h.names[0], lat: h.lat!, lng: h.lng!, note: cityName(h.cityId) }))
  const focus = picked ? pins.find((p) => p.id === picked) ?? null : null
  const pick = (h: Hit) => {
    setPicked(h.key)
    setQ(h.names[0])
    setMapCity(h.cityId)
  }
  const clear = () => (setQ(""), setCity("all"), setCampus("all"), setPicked(null))
  const exportHits = () => {
    const rows = shown.flatMap((h) => h.campuses.map((c) => ({ الحي: c.districts.find((x) => x.norm === h.norm)?.name ?? h.names[0], المدينة: cityName(h.cityId), المجمع: c.name, "العام الدراسي": data!.year, الحالة: "معتمد" })))
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    ws["!cols"] = [{ wch: 30 }, { wch: 16 }, { wch: 48 }, { wch: 14 }, { wch: 10 }]
    XLSX.utils.book_append_sheet(wb, ws, "نتائج البحث")
    if (!wb.Workbook) wb.Workbook = {}
    wb.Workbook.Views = [{ RTL: true }]
    XLSX.writeFile(wb, `transport-districts-${data!.year.replace("/", "-")}.xlsx`)
  }
  const selCampus = campusId ? data?.campuses.find((c) => c.id === campusId) ?? null : null

  return (
    <>
      {/* 1 · hero */}
      <section className="rise relative mt-5 overflow-hidden rounded-3xl border bg-gradient-to-bl from-card via-card to-sky-soft/60">
        <div className="grid grid-cols-1 items-center gap-2 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="relative z-10 px-6 pb-2 pt-8 sm:px-10 lg:py-12">
            {data && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1 text-[13px] font-bold text-primary-foreground">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                العام الدراسي <span className="num">{data.year}</span>م
              </span>
            )}
            <h1 className="mt-4 text-[40px] font-extrabold leading-tight text-primary sm:text-[52px]">النقل المدرسي</h1>
            <p className="mt-1 text-[20px] font-bold sm:text-[22px]">الأحياء المعتمدة لخدمة النقل المدرسي</p>
            <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-muted-foreground">
              استكشف نطاق تغطية خدمة النقل المدرسي في مجمعات مدارس الأندلس التعليمية، وتعرّف على الأحياء المعتمدة{data ? <> للعام الدراسي <span className="num">{data.year}</span>م</> : ""}.
            </p>
            <button type="button" onClick={() => searchRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} className="mt-5 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-[16px] font-bold text-primary-foreground shadow-sm hover:bg-primary/90">
              <Search className="h-5 w-5" aria-hidden="true" />
              ابحث عن حيّك
            </button>
          </div>
          <Suspense fallback={<img src={BUS_IMAGE} alt="حافلة النقل المدرسي لشركة الأندلس التعليمية" className="h-[260px] w-full object-cover sm:h-[380px]" />}>
            <Bus3D className="h-[280px] w-full sm:h-[400px] lg:h-[440px]" />
          </Suspense>
        </div>
      </section>

      {loading ? (
        <Panel className="mt-5"><LoadingBlock rows={4} label="جارٍ تحميل بيانات النقل…" /></Panel>
      ) : !data ? (
        <Panel className="mt-5">
          <EmptyState title={error ? "تعذّر عرض بيانات النقل" : "لم تُنشر خطة النقل بعد"} body={error ?? "تظهر هنا الأحياء المعتمدة بعد أن يعتمد مدير المنصة نشر ملف الخطة."} />
        </Panel>
      ) : (
        <>
          {/* 2 · figures, all counted from the published data */}
          <ul className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="إحصائيات الخدمة">
            {[
              { label: "مدينة", value: stats!.cities, icon: MapPinned },
              { label: "مجمعًا تعليميًا", value: stats!.campuses, icon: Building2 },
              { label: "إدخال حي معتمد", value: stats!.entries, icon: MapPin },
              { label: "حيًّا فريدًا", value: stats!.unique, icon: Check, hint: "بعد توحيد الحي المتكرر في أكثر من مجمع بالمدينة نفسها" },
            ].map((s, i) => (
              <li key={s.label} className="rise rounded-2xl border bg-card p-4 sm:p-5" style={{ animationDelay: `${i * 60}ms` }} title={s.hint}>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"><s.icon className="h-5 w-5" aria-hidden="true" /></span>
                <CountUp value={s.value} className="mt-3 block text-[34px] font-extrabold leading-none text-primary" />
                <span className="mt-1 block text-[15px] text-muted-foreground">{s.label}</span>
              </li>
            ))}
          </ul>

          {/* 3 · search */}
          <section ref={searchRef} className="mt-8 scroll-mt-24" aria-labelledby="tp-search">
            <h2 id="tp-search" className="text-[24px] font-extrabold">ابحث عن حيّ</h2>
            <p className="text-[15px] text-muted-foreground">اكتب اسم الحي، أو اختر المدينة والمجمع. البحث يتجاوز اختلاف الهمزات والمسافات.</p>
            <div className="mt-3 rounded-2xl border bg-card p-3 sm:p-4">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto]">
                <div className="relative">
                  <label htmlFor="tp-q" className="sr-only">اسم الحي</label>
                  <Search className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <input id="tp-q" type="search" autoComplete="off" value={q} onChange={(e) => (setQ(e.target.value), setPicked(null))} placeholder="اسم الحي" role="combobox" aria-expanded={suggestions.length > 0} aria-controls="tp-suggest" className="h-12 w-full rounded-xl border bg-background pe-3 ps-12 text-[17px] outline-none focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/20" />
                  {suggestions.length > 0 && (
                    <ul id="tp-suggest" role="listbox" className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl border bg-card shadow-lg">
                      {suggestions.map((h) => (
                        <li key={h.key} role="option" aria-selected="false">
                          <button type="button" onClick={() => pick(h)} className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-start text-[15px] hover:bg-accent">
                            <span className="font-bold">{h.names[0]}</span>
                            <span className="shrink-0 text-[13px] text-muted-foreground">{cityName(h.cityId)} · {formatNumber(h.campuses.length)} {h.campuses.length > 1 ? "مجمعات" : "مجمع"}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <label className="sr-only" htmlFor="tp-city">المدينة</label>
                <select id="tp-city" value={city} onChange={(e) => (setCity(e.target.value), setCampus("all"), setPicked(null))} className="h-12 rounded-xl border bg-background px-3 text-[16px]">
                  <option value="all">كل المدن</option>
                  {data.cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <label className="sr-only" htmlFor="tp-campus">المجمع التعليمي</label>
                <select id="tp-campus" value={campus} onChange={(e) => (setCampus(e.target.value), setPicked(null))} className="h-12 min-w-0 rounded-xl border bg-background px-3 text-[16px]">
                  <option value="all">كل المجمعات</option>
                  {data.campuses.filter((c) => city === "all" || c.cityId === city).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button type="button" onClick={clear} disabled={!filtering} className="inline-flex h-12 items-center justify-center gap-1.5 rounded-xl border px-4 text-[15px] hover:bg-accent disabled:opacity-40">
                  <X className="h-4 w-4" aria-hidden="true" />
                  مسح
                </button>
              </div>

              {filtering && (
                <div className="mt-4" role="region" aria-live="polite" aria-label="نتائج البحث">
                  {shown.length === 0 ? (
                    <div className="rounded-xl bg-muted/60 p-4 text-[15px]">
                      <p className="font-bold">لا يوجد حي معتمد بهذا الاسم{city !== "all" ? ` في ${cityName(city)}` : ""}.</p>
                      {similar.length > 0 ? (
                        <p className="mt-2 flex flex-wrap items-center gap-2 text-muted-foreground">
                          هل تقصد:
                          {similar.map((h) => (
                            <button key={h.key} type="button" onClick={() => (clear(), pick(h))} className="rounded-full border bg-card px-3 py-1 text-foreground hover:bg-accent">{h.names[0]} · {cityName(h.cityId)}</button>
                          ))}
                        </p>
                      ) : (
                        <p className="mt-1 text-muted-foreground">جرّب جزءًا من الاسم، أو اختر «كل المدن».</p>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[14px] text-muted-foreground"><span className="num font-bold text-foreground">{formatNumber(shown.length)}</span> {shown.length > 10 ? "حيًّا" : shown.length > 2 ? "أحياء" : shown.length === 2 ? "حيّان" : "حي"}</p>
                        <span className="flex flex-wrap gap-1.5">
                          {q.trim() && (
                            <button type="button" onClick={() => copy(transportUrl(`q-${q.trim()}`), "نُسخ رابط نتيجة البحث")} className="inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[14px] hover:bg-accent">
                              <Link2 className="h-4 w-4" aria-hidden="true" />
                              نسخ رابط النتيجة
                            </button>
                          )}
                          <button type="button" onClick={exportHits} className="inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[14px] hover:bg-accent">
                            <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
                            تصدير النتائج
                          </button>
                        </span>
                      </div>
                      <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                        {shown.slice(0, 40).map((h) => (
                          <li key={h.key} className="rounded-xl border p-3.5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[18px] font-extrabold">{h.names.join(" / ")}</p>
                                <p className="text-[13px] text-muted-foreground">{cityName(h.cityId)} · العام الدراسي <span className="num">{data.year}</span></p>
                              </div>
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ok-soft px-2.5 py-0.5 text-[13px] font-bold text-ok"><Check className="h-3.5 w-3.5" aria-hidden="true" />معتمد</span>
                            </div>
                            <ul className="mt-2 flex flex-col gap-1">
                              {h.campuses.map((c) => (
                                <li key={c.id}>
                                  <button type="button" onClick={() => go(`c-${c.id}`)} className="inline-flex items-center gap-1.5 text-start text-[15px] font-bold text-primary hover:underline">
                                    <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                                    {c.name}
                                  </button>
                                </li>
                              ))}
                            </ul>
                            <button type="button" onClick={() => (setPicked(h.key), setMapCity(h.cityId), mapRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }))} className="mt-2 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
                              <MapPinned className="h-3.5 w-3.5" aria-hidden="true" />
                              {h.lat !== null ? "عرض موقع الحي على الخريطة" : `عرض ${cityName(h.cityId)} على الخريطة (موقع الحي غير محدد بعد)`}
                            </button>
                          </li>
                        ))}
                      </ul>
                      {shown.length > 40 && <p className="mt-2 text-[13px] text-muted-foreground">تظهر أول 40 نتيجة. ضيّق البحث باسم الحي أو المجمع.</p>}
                    </>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* 4 · campuses */}
          <section className="mt-8" aria-labelledby="tp-campuses">
            <h2 id="tp-campuses" className="text-[24px] font-extrabold">المجمعات التعليمية</h2>
            <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {data.campuses.map((c, i) => (
                <li key={c.id} className="rise" style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
                  <button type="button" onClick={() => go(`c-${c.id}`)} className="lift group flex h-full w-full flex-col gap-3 rounded-2xl border bg-card p-5 text-start">
                    <span className="flex items-start justify-between gap-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><BusFront className="h-6 w-6" aria-hidden="true" /></span>
                      <span className="rounded-full bg-secondary px-3 py-1 text-[13px] font-bold text-secondary-foreground">{cityName(c.cityId)}</span>
                    </span>
                    <span className="text-[18px] font-extrabold leading-snug">{c.name}</span>
                    <span className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
                      <span className="text-[14px] text-muted-foreground"><span className="num text-[20px] font-extrabold text-primary">{formatNumber(c.districts.length)}</span> حيًّا معتمدًا</span>
                      <span className="inline-flex items-center gap-1 text-[15px] font-bold text-primary">عرض التفاصيل<ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" aria-hidden="true" /></span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* 5 · the isometric map */}
          <section ref={mapRef} className="mt-8 scroll-mt-24" aria-labelledby="tp-map">
            <h2 id="tp-map" className="text-[24px] font-extrabold">خريطة المدن</h2>
            <p className="text-[15px] text-muted-foreground">خريطة ثلاثية الأبعاد لاستكشاف المدن المشمولة. دوّر المشهد وقرّبه، واختر مدينة لعرض مجمعاتها.</p>
            <div className="my-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]" role="group" aria-label="المدن">
              <button type="button" aria-pressed={!mapCity} onClick={() => (setMapCity(null), setPicked(null))} className={cn("inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-[14px]", !mapCity ? "border-primary bg-primary font-bold text-primary-foreground" : "bg-card hover:bg-accent")}>كل المدن</button>
              {mapCities.map((c) => (
                <button key={c.id} type="button" aria-pressed={mapCity === c.id} onClick={() => (setMapCity(c.id), setPicked(null))} className={cn("inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-[14px]", mapCity === c.id ? "border-primary bg-primary font-bold text-primary-foreground" : "bg-card hover:bg-accent")}>{c.name}</button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
              {mapOn ? (
                <Suspense fallback={<div className="flex h-[420px] items-center justify-center rounded-2xl border bg-muted text-muted-foreground sm:h-[520px]">جارٍ تحميل الخريطة…</div>}>
                  <CityMap cities={mapCities} active={mapCity} pins={pins} focus={focus} onCity={(id) => (setMapCity(id), setPicked(null))} />
                </Suspense>
              ) : (
                <div className="h-[420px] rounded-2xl border bg-muted sm:h-[520px]" />
              )}
              <Panel className="self-start">
                {mapCity ? (
                  <div className="p-4">
                    <h3 className="text-[19px] font-extrabold">{cityName(mapCity)}</h3>
                    <p className="text-[13px] text-muted-foreground">{formatNumber(mapCities.find((c) => c.id === mapCity)?.districts ?? 0)} حيًّا معتمدًا</p>
                    <ul className="mt-3 flex flex-col gap-1.5">
                      {data.campuses.filter((c) => c.cityId === mapCity).map((c) => (
                        <li key={c.id}>
                          <button type="button" onClick={() => go(`c-${c.id}`)} className="flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-start text-[14px] hover:bg-accent">
                            <span className="font-bold">{c.name}</span>
                            <span className="num shrink-0 text-muted-foreground">{formatNumber(c.districts.length)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="p-4 text-[14px] text-muted-foreground">اختر مدينة من الأزرار أو من الخريطة لعرض مجمعاتها.</p>
                )}
                <p className="border-t p-4 text-[13px] leading-relaxed text-muted-foreground">
                  الخريطة استكشافية على مستوى المدينة. خطة النقل تحدد الأحياء بأسمائها فقط، ولذلك لا تُعرض حدود الأحياء ولا مواقع المجمعات{pins.length ? " إلا ما توفرت إحداثياته الموثوقة" : ""}؛ التحديد الجغرافي التفصيلي يحتاج إلى بيانات إضافية.
                </p>
              </Panel>
            </div>
          </section>

          {/* 6 · service information */}
          <section className="mt-8 grid grid-cols-1 gap-3 lg:grid-cols-3" aria-labelledby="tp-info">
            <h2 id="tp-info" className="sr-only">معلومات الخدمة</h2>
            <Panel className="p-5">
              <h3 className="text-[17px] font-extrabold">نطاق الخدمة</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">خدمة النقل المدرسي مرتبطة بالأحياء المعتمدة لكل مجمع للعام الدراسي <span className="num">{data.year}</span>م. الحي غير الوارد في قائمة المجمع ليس ضمن نطاق خدمته.</p>
              {data.publishedAt && <p className="mt-2 text-[13px] text-muted-foreground">آخر تحديث للقوائم {formatDate(data.publishedAt)}.</p>}
            </Panel>
            <Panel className="p-5">
              <h3 className="text-[17px] font-extrabold">المدن المشمولة</h3>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {data.cities.map((c) => <li key={c.id} className="rounded-full bg-secondary px-3 py-1 text-[14px] text-secondary-foreground">{c.name}</li>)}
              </ul>
            </Panel>
            <Panel className="p-5">
              <h3 className="text-[17px] font-extrabold">للاستفسار</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">أرقام «الحركة والنقل» المعتمدة لكل فرع في دليل أرقام الفروع.</p>
              <button type="button" onClick={() => route({ page: "contacts" })} className="mt-3 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-[15px] font-bold text-primary-foreground hover:bg-primary/90">
                <PhoneCall className="h-4 w-4" aria-hidden="true" />
                فتح دليل الأرقام
              </button>
            </Panel>
          </section>
          <PageQr />
        </>
      )}

      {data && <CampusSheet data={data} campus={selCampus} missing={!!campusId && !selCampus} cityName={cityName} onClose={() => go(undefined)} />}
    </>
  )
}

function useQr(text: string | null) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    if (!text) return setSrc(null)
    QRCode.toDataURL(text, { margin: 1, width: 360, color: { dark: "#212178", light: "#ffffff" } }).then((u) => live && setSrc(u), () => live && setSrc(null))
    return () => {
      live = false
    }
  }, [text])
  return src
}

function PageQr() {
  const url = transportUrl()
  const qr = useQr(url)
  return (
    <Panel className="mt-3 flex flex-wrap items-center gap-4 p-5">
      {qr ? <img src={qr} alt="رمز QR لصفحة النقل المدرسي" className="h-28 w-28 rounded-lg border" /> : <span className="flex h-28 w-28 items-center justify-center rounded-lg border text-muted-foreground"><QrCode className="h-8 w-8" /></span>}
      <div className="min-w-0 flex-1">
        <h3 className="text-[17px] font-extrabold">رابط الصفحة العام</h3>
        <p className="mt-1 break-all text-[13px] text-muted-foreground" dir="ltr">{url}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button type="button" onClick={() => copy(url, "نُسخ رابط الصفحة")} className="inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[14px] hover:bg-accent"><Copy className="h-4 w-4" aria-hidden="true" />نسخ الرابط</button>
          {qr && <a href={qr} download="transport-qr.png" className="inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[14px] hover:bg-accent"><FileDown className="h-4 w-4" aria-hidden="true" />تنزيل رمز QR</a>}
        </div>
      </div>
    </Panel>
  )
}

/** The campus drawer: its districts, an inner search, copy, print, PDF, share and QR. */
function CampusSheet({ data, campus, missing, cityName, onClose }: { data: TransportData; campus: TCampus | null; missing: boolean; cityName: (id: string) => string; onClose: () => void }) {
  const downloads = useDownloads()
  const [q, setQ] = useState("")
  const [busy, setBusy] = useState<"pdf" | "print" | null>(null)
  const [printing, setPrinting] = useState(false)
  const pagesRef = useRef<HTMLDivElement>(null)
  const url = campus ? transportUrl(`c-${campus.id}`) : null
  const qr = useQr(url)
  useEffect(() => setQ(""), [campus?.id])
  if (!campus && !missing) return null
  const list = campus ? campus.districts.filter((d) => tnorm(q).split(" ").filter(Boolean).every((w) => d.norm.includes(w))) : []
  const pages = campus ? campusPages({ campus: campus.name, city: cityName(campus.cityId), year: data.year, districts: campus.districts.map((d) => d.name), publishedAt: data.publishedAt, qr: qr ?? undefined }) : []

  const pdf = async () => {
    if (!campus || !downloads) return
    setBusy("pdf")
    try {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      const blob = await exportPdf(pagesRef.current!, `الأحياء المعتمدة - ${campus.name}`)
      await downloads.save({ filename: `الأحياء المعتمدة للنقل - ${campus.name} - ${data.year.replace("/", "-")}.pdf`, data: blob })
      toast.success("حُفظ ملف PDF")
    } catch (e) {
      if ((e as { code?: string })?.code !== "declined") toast.error("لم يُحفظ الملف", { description: (e as Error)?.message })
    } finally {
      setBusy(null)
    }
  }
  const print = () => {
    setPrinting(true)
    document.body.classList.add("tp-printing")
    const done = () => (document.body.classList.remove("tp-printing"), setPrinting(false), window.removeEventListener("afterprint", done))
    window.addEventListener("afterprint", done)
    setTimeout(() => window.print(), 150)
  }

  return (
    <>
      <Sheet open onOpenChange={(o) => !o && onClose()}>
        <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-xl" dir="rtl">
          {!campus ? (
            <SheetHeader className="pe-8 text-start">
              <SheetTitle className="text-start text-[22px] font-bold">المجمع غير موجود</SheetTitle>
              <SheetDescription className="text-start text-[15px]">هذا الرابط لمجمع ليس في القائمة المنشورة حاليًا.</SheetDescription>
            </SheetHeader>
          ) : (
            <>
              <SheetHeader className="pe-8 text-start">
                <SheetTitle className="text-start text-[22px] font-extrabold leading-snug">{campus.name}</SheetTitle>
                <SheetDescription className="text-start text-[15px]">
                  {cityName(campus.cityId)} · <span className="num">{formatNumber(campus.districts.length)}</span> حيًّا معتمدًا · العام الدراسي <span className="num">{data.year}</span>م
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {downloads !== null && (
                  <button type="button" onClick={pdf} disabled={!!busy || !downloads} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-[14px] font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                    {busy === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileDown className="h-4 w-4" aria-hidden="true" />}
                    تحميل PDF
                  </button>
                )}
                <button type="button" onClick={print} className="inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-[14px] hover:bg-accent"><Printer className="h-4 w-4" aria-hidden="true" />طباعة</button>
                <button type="button" onClick={() => copy(url!, "نُسخ رابط المجمع")} className="inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-[14px] hover:bg-accent"><Link2 className="h-4 w-4" aria-hidden="true" />نسخ الرابط</button>
                {canShare() && <button type="button" onClick={() => void shareLink(`الأحياء المعتمدة للنقل المدرسي - ${campus.name}`, url!)} className="inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-[14px] hover:bg-accent"><Share2 className="h-4 w-4" aria-hidden="true" />مشاركة</button>}
              </div>
              <div className="relative mt-4">
                <label htmlFor="tp-inner" className="sr-only">ابحث في أحياء المجمع</label>
                <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input id="tp-inner" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث في أحياء هذا المجمع" className="h-11 w-full rounded-xl border bg-background pe-3 ps-10 text-[16px] outline-none focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/20" />
              </div>
              {list.length === 0 ? (
                <p className="mt-4 rounded-xl bg-muted/60 p-4 text-[15px] text-muted-foreground">لا يوجد حي بهذا الاسم في قائمة هذا المجمع.</p>
              ) : (
                <ol className="mt-3 divide-y rounded-xl border">
                  {list.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
                      <span className="flex min-w-0 items-baseline gap-2.5">
                        <span className="num w-6 shrink-0 text-[12px] text-muted-foreground">{formatNumber(campus.districts.indexOf(d) + 1)}</span>
                        <span className="text-[16px]">{d.name}</span>
                      </span>
                      <button type="button" onClick={() => copy(d.name, "نُسخ اسم الحي")} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent" aria-label={`نسخ ${d.name}`}><Copy className="h-4 w-4" /></button>
                    </li>
                  ))}
                </ol>
              )}
              {qr && (
                <div className="mt-4 flex items-center gap-3 rounded-xl border p-3">
                  <img src={qr} alt="رمز QR لرابط المجمع" className="h-20 w-20" />
                  <p className="text-[13px] text-muted-foreground">امسح الرمز لفتح قائمة هذا المجمع مباشرة.</p>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
      {busy === "pdf" && <div aria-hidden="true" style={{ position: "fixed", top: 0, left: -20000, pointerEvents: "none" }}><div ref={pagesRef}>{pages}</div></div>}
      {printing && createPortal(<div className="tp-print-area">{pages}</div>, document.body)}
    </>
  )
}
