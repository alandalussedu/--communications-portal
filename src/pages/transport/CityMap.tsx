/**
 * The isometric 3D city map (MapLibre GL with OpenFreeMap's open tiles: tilted
 * camera and extruded buildings, no access key). It is an exploratory view of
 * each city: the plan gives district names only, so no district or campus is
 * pinned unless the database holds coordinates for it.
 */
import { useEffect, useRef, useState } from "react"
import * as maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url"
import { CITY_GEO } from "@/data/csrMap"
import { reducedMotion } from "@/lib/motion"

// MapLibre 6 loads its worker beside its own module; the bundle moves it, so say where it is
maplibregl.setWorkerUrl(workerUrl)

export type MapCity = { id: string; name: string; campuses: number; districts: number }
export type MapPin = { id: string; name: string; lat: number; lng: number; note: string }

const STYLE = "https://tiles.openfreemap.org/styles/liberty"
/** backup when the main map does not answer: plain raster tiles, still tilted and turnable */
const FALLBACK: maplibregl.StyleSpecification = {
  version: 8,
  sources: { base: { type: "raster", tiles: ["https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png", "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 19, attribution: "© OpenStreetMap contributors © CARTO" } },
  layers: [{ id: "base", type: "raster", source: "base" }],
}
export const cityCenter = (name: string) => (CITY_GEO[name] ? ([CITY_GEO[name].lon, CITY_GEO[name].lat] as [number, number]) : null)

export default function CityMap({ cities, active, pins, focus, onCity }: { cities: MapCity[]; active: string | null; pins: MapPin[]; focus: MapPin | null; onCity: (id: string) => void }) {
  const host = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const markers = useRef<maplibregl.Marker[]>([])
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading")
  const onCityRef = useRef(onCity)
  onCityRef.current = onCity

  useEffect(() => {
    if (!host.current) return
    let m: maplibregl.Map
    try {
      m = new maplibregl.Map({ container: host.current, style: STYLE, center: [42.5, 23.2], zoom: 4.3, pitch: 50, bearing: -12, attributionControl: { compact: true }, maxPitch: 70, scrollZoom: false })
    } catch {
      setState("failed")
      return
    }
    map.current = m
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-left")
    // the page keeps scrolling with the wheel until the visitor taps the map
    const wake = () => m.scrollZoom.enable()
    m.getCanvas().addEventListener("pointerdown", wake, { once: true })
    let ok = false, fellBack = false
    const fallBack = () => {
      if (ok || fellBack) return
      fellBack = true
      m.setStyle(FALLBACK)
      clearTimeout(t)
      t = setTimeout(() => !ok && setState("failed"), 15000)
    }
    const ready = () => {
      if (ok) return
      ok = true
      clearTimeout(t)
      setState("ready")
      if (!fellBack)
        // Arabic names where the vector tiles have them
        for (const l of m.getStyle().layers ?? []) if (l.type === "symbol" && (l.layout as Record<string, unknown> | undefined)?.["text-field"]) m.setLayoutProperty(l.id, "text-field", ["coalesce", ["get", "name:ar"], ["get", "name"]])
    }
    m.on("load", ready)
    m.on("style.load", () => fellBack && ready())
    // the main style did not arrive: switch to the plain backup map
    m.on("error", (e) => !ok && !fellBack && /style|Failed to fetch|NetworkError|404|403/i.test(String((e as { error?: Error }).error?.message ?? "")) && fallBack())
    let t = setTimeout(fallBack, 9000)
    return () => {
      clearTimeout(t)
      m.remove()
      map.current = null
    }
  }, [])

  // city markers
  useEffect(() => {
    const m = map.current
    if (!m) return
    markers.current.forEach((x) => x.remove())
    markers.current = []
    for (const c of cities) {
      const at = cityCenter(c.name)
      if (!at) continue
      const el = document.createElement("button")
      el.type = "button"
      el.className = "tp-city" + (c.id === active ? " on" : "")
      el.setAttribute("aria-label", `${c.name}: ${c.campuses} مجمع`)
      el.innerHTML = `<b></b><span></span>`
      el.querySelector("b")!.textContent = c.name
      el.querySelector("span")!.textContent = String(c.campuses)
      el.addEventListener("click", (e) => (e.stopPropagation(), onCityRef.current(c.id)))
      markers.current.push(new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat(at).addTo(m))
    }
    for (const p of pins) {
      const el = document.createElement("div")
      el.className = "tp-pin"
      el.title = p.name
      const mk = new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([p.lng, p.lat]).setPopup(new maplibregl.Popup({ offset: 18 }).setText(`${p.name} · ${p.note}`)).addTo(m)
      markers.current.push(mk)
    }
  }, [cities, active, pins, state])

  // camera
  useEffect(() => {
    const m = map.current
    if (!m || state !== "ready") return
    const fly = (o: maplibregl.FlyToOptions) => (reducedMotion() ? m.jumpTo(o as maplibregl.JumpToOptions) : m.flyTo({ ...o, duration: 2600, essential: true }))
    if (focus) return void fly({ center: [focus.lng, focus.lat], zoom: 15.2, pitch: 60, bearing: 20 })
    const c = cities.find((x) => x.id === active)
    const at = c && cityCenter(c.name)
    if (at) fly({ center: at, zoom: 12.6, pitch: 58, bearing: -18 })
    else fly({ center: [42.5, 23.2], zoom: 4.3, pitch: 50, bearing: -12 })
  }, [active, focus, state, cities])

  return (
    <div className="relative h-[420px] overflow-hidden rounded-2xl border bg-muted sm:h-[520px]">
      <div ref={host} className="absolute inset-0 h-full w-full" style={{ position: "absolute" }} dir="ltr" />
      {state === "ready" && (
        <p className="pointer-events-none absolute bottom-2 end-2 rounded-full bg-card/90 px-3 py-1 text-[12px] text-muted-foreground shadow-sm backdrop-blur">اسحب للتحريك · انقر ثم استخدم العجلة للتقريب</p>
      )}
      {state !== "ready" && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/90 p-6 text-center text-[15px] text-muted-foreground">
          {state === "loading" ? "جارٍ تحميل الخريطة…" : "تعذّر تحميل الخريطة الآن. تحقّق من الاتصال ثم أعد فتح الصفحة؛ بقية الصفحة تعمل كما هي."}
        </div>
      )}
    </div>
  )
}
