/**
 * The school bus in real 3D (Three.js): a first, procedurally built model in the
 * proportions of a white Toyota Coaster with the company's logo on both sides.
 * It is a prototype until an approved GLB model is supplied. Drag to turn it
 * all the way round, pinch or scroll to zoom. Loaded lazily; a still image is
 * shown where WebGL is not available.
 */
import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js"
import { LOGO_NAVY, LOGO_RATIO } from "@/assets/logo"
import { reducedMotion } from "@/lib/motion"

import { BUS_IMAGE } from "./busImage"

function webglOk() {
  try {
    const c = document.createElement("canvas")
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")))
  } catch {
    return false
  }
}

/** The side panel artwork: the company logo, a rule, and the department name. */
function liveryTexture(onReady: () => void) {
  const c = document.createElement("canvas")
  c.width = 1536
  c.height = 384
  const ctx = c.getContext("2d")!
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  const img = new Image()
  img.onload = () => {
    ctx.clearRect(0, 0, c.width, c.height)
    const h = 250, w = h * LOGO_RATIO
    ctx.drawImage(img, c.width - w - 30, 30, w, h)
    ctx.fillStyle = "#212178"
    ctx.fillRect(c.width - w - 70, 50, 4, 210)
    ctx.textAlign = "right"
    ctx.direction = "rtl"
    ctx.font = "700 64px Tajawal, sans-serif"
    ctx.fillText("إدارة الحركة والنقل", c.width - w - 110, 150)
    ctx.font = "500 44px Tajawal, sans-serif"
    ctx.fillStyle = "#4a4a8a"
    ctx.fillText("النقل المدرسي", c.width - w - 110, 222)
    ctx.fillStyle = "#212178"
    ctx.fillRect(40, 330, c.width - 80, 5)
    tex.needsUpdate = true
    onReady()
  }
  img.src = LOGO_NAVY
  return tex
}

function buildBus(livery: THREE.Texture) {
  const bus = new THREE.Group()
  const W = 2.06
  const paint = new THREE.MeshPhysicalMaterial({ color: 0xfafafa, roughness: 0.32, metalness: 0.05, clearcoat: 0.9, clearcoatRoughness: 0.18 })
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x1a2530, roughness: 0.08, metalness: 0.6, envMapIntensity: 1.4 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.75 })
  const trim = new THREE.MeshStandardMaterial({ color: 0xc9ccd2, roughness: 0.35, metalness: 0.8 })
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, shadow = true) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.castShadow = shadow
    bus.add(m)
    return m
  }

  // body: the side outline extruded across the width (front is +X)
  const s = new THREE.Shape()
  s.moveTo(-3.42, 0.5)
  s.lineTo(-3.46, 2.2)
  s.quadraticCurveTo(-3.46, 2.52, -3.1, 2.56)
  s.lineTo(2.55, 2.6)
  s.quadraticCurveTo(2.95, 2.58, 3.12, 2.3)
  s.lineTo(3.44, 1.5)
  s.quadraticCurveTo(3.52, 1.3, 3.52, 1.1)
  s.lineTo(3.52, 0.62)
  s.quadraticCurveTo(3.52, 0.5, 3.4, 0.5)
  s.closePath()
  const body = new THREE.ExtrudeGeometry(s, { depth: W - 0.16, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 4, curveSegments: 16 })
  body.translate(0, 0, -(W - 0.16) / 2)
  add(body, paint, 0, 0, 0)

  for (const side of [1, -1]) {
    const z = side * (W / 2 + 0.006)
    // side windows: one dark band of panes; the door (kerb side, +Z) splits it
    const panes: [number, number][] = side === 1 ? [[-3.05, -2.2], [-2.12, -1.1], [-1.02, 0.0], [1.22, 1.72], [1.8, 2.72]] : [[-3.05, -2.2], [-2.12, -1.1], [-1.02, 0.0], [0.08, 1.1], [1.18, 1.72], [1.8, 2.72]]
    for (const [a, b] of panes) add(new THREE.BoxGeometry(b - a, 0.72, 0.02), glass, (a + b) / 2, 1.86, z, false)
    // wheel arches and wheels
    for (const x of [2.32, -2.02]) {
      const arch = add(new THREE.CircleGeometry(0.56, 28, 0, Math.PI), dark, x, 0.5, z + side * 0.004, false)
      if (side === -1) arch.rotation.y = Math.PI
      const wheel = new THREE.Group()
      const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.28, 32), new THREE.MeshStandardMaterial({ color: 0x0e0e10, roughness: 0.9 }))
      tyre.rotation.x = Math.PI / 2
      tyre.castShadow = true
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.3, 24), trim)
      hub.rotation.x = Math.PI / 2
      wheel.add(tyre, hub)
      wheel.position.set(x, 0.42, side * (W / 2 - 0.12))
      wheel.name = "wheel"
      bus.add(wheel)
    }
    // the thin blue line of the livery, low on the side
    add(new THREE.BoxGeometry(6.1, 0.035, 0.012), new THREE.MeshStandardMaterial({ color: 0x212178, roughness: 0.5 }), -0.1, 0.78, z, false)
    // logo panel behind the door
    const panel = add(new THREE.PlaneGeometry(2.6, 0.65), new THREE.MeshBasicMaterial({ map: livery, transparent: true }), -1.25, 1.14, z + side * 0.004, false)
    if (side === -1) panel.rotation.y = Math.PI
    // mirrors
    add(new THREE.BoxGeometry(0.06, 0.28, 0.12), dark, 3.1, 1.72, side * (W / 2 + 0.2))
    add(new THREE.BoxGeometry(0.04, 0.04, 0.2), dark, 3.08, 1.84, side * (W / 2 + 0.09), false)
    // headlights and indicators
    add(new THREE.BoxGeometry(0.06, 0.2, 0.42), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3d0, emissiveIntensity: 0.9, roughness: 0.2 }), 3.615, 0.98, side * 0.72, false)
    add(new THREE.BoxGeometry(0.05, 0.1, 0.16), new THREE.MeshStandardMaterial({ color: 0xff9a2e, emissive: 0xff7a00, emissiveIntensity: 0.35 }), 3.615, 0.98, side * 0.98, false)
    add(new THREE.BoxGeometry(0.05, 0.42, 0.2), new THREE.MeshStandardMaterial({ color: 0xb01818, emissive: 0x700000, emissiveIntensity: 0.4 }), -3.565, 1.1, side * 0.82, false)
  }
  // the passenger door (two leaves with glass)
  const dz = W / 2 + 0.01
  add(new THREE.BoxGeometry(1.02, 1.96, 0.02), new THREE.MeshStandardMaterial({ color: 0xe9eaee, roughness: 0.4 }), 0.6, 1.5, dz, false)
  for (const x of [0.36, 0.84]) add(new THREE.BoxGeometry(0.38, 1.2, 0.022), glass, x, 1.72, dz + 0.004, false)
  add(new THREE.BoxGeometry(0.03, 1.96, 0.026), dark, 0.6, 1.5, dz + 0.004, false)

  // windscreen (follows the slope of the front), rear window, grille and bumpers
  const ws = add(new THREE.BoxGeometry(0.03, 0.92, W - 0.24), glass, 3.39, 1.95, 0, false)
  ws.rotation.z = Math.atan2(0.32, 0.8)
  add(new THREE.BoxGeometry(0.03, 0.7, W - 0.5), glass, -3.555, 1.88, 0, false)
  add(new THREE.BoxGeometry(0.05, 0.26, 0.9), dark, 3.615, 0.98, 0, false)
  add(new THREE.BoxGeometry(0.03, 0.09, 0.2), trim, 3.625, 1.3, 0, false)
  add(new THREE.BoxGeometry(0.16, 0.24, W + 0.04), new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.6 }), 3.56, 0.56, 0)
  add(new THREE.BoxGeometry(0.14, 0.2, W + 0.02), new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.6 }), -3.5, 0.56, 0)
  // floor pan so nothing shows through under the body
  add(new THREE.BoxGeometry(6.6, 0.12, W - 0.3), dark, 0, 0.44, 0)
  return bus
}

export default function Bus3D({ className }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(() => !webglOk())
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    const el = host.current
    if (!el || failed) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" })
    } catch {
      setFailed(true)
      return
    }
    const still = reducedMotion()
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    el.appendChild(renderer.domElement)
    renderer.domElement.setAttribute("aria-hidden", "true")

    const scene = new THREE.Scene()
    const pmrem = new THREE.PMREMGenerator(renderer)
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100)

    let dirty = true
    const livery = liveryTexture(() => (dirty = true))
    const bus = buildBus(livery)
    scene.add(bus)
    const wheels = bus.children.filter((c) => c.name === "wheel")

    scene.add(new THREE.HemisphereLight(0xffffff, 0xb9c4d6, 0.7))
    const sun = new THREE.DirectionalLight(0xffffff, 2.2)
    sun.position.set(5, 9, 6)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 })
    sun.shadow.radius = 6
    sun.shadow.bias = -0.0005
    scene.add(sun)
    const ground = new THREE.Mesh(new THREE.CircleGeometry(9, 48), new THREE.ShadowMaterial({ opacity: 0.22 }))
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    scene.add(ground)
    // a faint mirrored sheen under the bus
    const sheen = new THREE.Mesh(new THREE.CircleGeometry(5.2, 48), new THREE.MeshStandardMaterial({ color: 0xdfe6f1, roughness: 0.25, metalness: 0.3, transparent: true, opacity: 0.35 }))
    sheen.rotation.x = -Math.PI / 2
    sheen.position.y = -0.002
    scene.add(sheen)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 1.15, 0)
    controls.enablePan = false
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 7
    controls.maxDistance = 16
    controls.minPolarAngle = 0.5
    controls.maxPolarAngle = Math.PI / 2 - 0.04
    controls.autoRotate = !still
    controls.autoRotateSpeed = 0.55
    controls.zoomSpeed = 0.6
    let interacted = false
    controls.addEventListener("start", () => {
      interacted = true
      controls.autoRotate = false // the bus stays where the visitor leaves it
      setTouched(true)
    })
    controls.addEventListener("change", () => (dirty = true))
    // the page keeps scrolling with the wheel; zoom is with ctrl/pinch or the buttons
    controls.enableZoom = true
    renderer.domElement.style.touchAction = "pan-y" // vertical swipes still scroll the page
    renderer.domElement.addEventListener("wheel", (e) => !e.ctrlKey && e.stopImmediatePropagation(), { capture: true })

    const size = () => {
      const w = el.clientWidth, h = el.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      // keep the whole bus in view on narrow screens
      controls.minDistance = w < 520 ? 10 : 7
      camera.updateProjectionMatrix()
      dirty = true
    }
    const ro = new ResizeObserver(size)
    ro.observe(el)

    // intro: the bus rolls in while the camera sweeps round to its resting view
    const rest = new THREE.Vector3(6.4, 2.5, 7.9)
    const from = new THREE.Vector3(-9, 5.2, 12)
    const T = still ? 0 : 2600
    const t0 = performance.now()
    camera.position.copy(still ? rest : from)
    size()
    if (el.clientWidth < 520) rest.multiplyScalar(1.35)

    let visible = true
    const io = new IntersectionObserver(([e]) => ((visible = e.isIntersecting), (dirty = true)), { threshold: 0.01 })
    io.observe(el)
    let raf = 0, last = t0
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      if (!visible || document.hidden) return
      const dt = Math.min(50, now - last)
      last = now
      const p = T ? Math.min(1, (now - t0) / T) : 1
      if (p < 1 && !interacted) {
        const e = 1 - Math.pow(1 - p, 3)
        bus.position.x = -7 * (1 - e)
        wheels.forEach((w) => (w.rotation.z = (-bus.position.x / 0.42) % (Math.PI * 2)))
        camera.position.lerpVectors(from, rest, e)
        dirty = true
      } else if (bus.position.x !== 0) {
        bus.position.x = 0
        dirty = true
      }
      // a gentle turn with the page scroll, until the visitor takes over
      if (!interacted && p >= 1 && !still) {
        const r = el.getBoundingClientRect()
        const k = Math.max(-1, Math.min(1, (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight))
        bus.rotation.y += (k * -0.35 - bus.rotation.y) * 0.06
      }
      if (controls.autoRotate || dirty || p < 1) {
        controls.update(dt / 1000)
        renderer.render(scene, camera)
        dirty = false
      }
    }
    raf = requestAnimationFrame(tick)
    const zoom = (ev: Event) => {
      const dir = (ev as CustomEvent<number>).detail
      const v = camera.position.clone().sub(controls.target)
      v.setLength(Math.max(controls.minDistance, Math.min(controls.maxDistance, v.length() * (dir > 0 ? 0.85 : 1.18))))
      camera.position.copy(controls.target).add(v)
      controls.autoRotate = false
      interacted = true
      dirty = true
    }
    el.addEventListener("bus-zoom", zoom)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      el.removeEventListener("bus-zoom", zoom)
      controls.dispose()
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        m.geometry?.dispose()
        const mat = m.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
        else mat?.dispose()
      })
      livery.dispose()
      pmrem.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [failed])

  if (failed)
    return (
      <div className={className}>
        <img src={BUS_IMAGE} alt="حافلة النقل المدرسي لشركة الأندلس التعليمية" className="h-full w-full rounded-2xl object-cover" />
      </div>
    )
  const zoom = (d: number) => host.current?.dispatchEvent(new CustomEvent("bus-zoom", { detail: d }))
  return (
    <div className={className} style={{ position: "relative" }}>
      <div ref={host} className="absolute inset-0 cursor-grab active:cursor-grabbing [&>canvas]:h-full [&>canvas]:w-full" role="img" aria-label="نموذج ثلاثي الأبعاد لحافلة النقل المدرسي. اسحب لتدويرها." />
      <div className="absolute bottom-2 start-2 flex gap-1.5">
        <button type="button" onClick={() => zoom(1)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border bg-card/90 text-[18px] font-bold shadow-sm backdrop-blur hover:bg-accent" aria-label="تقريب الحافلة">+</button>
        <button type="button" onClick={() => zoom(-1)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border bg-card/90 text-[18px] font-bold shadow-sm backdrop-blur hover:bg-accent" aria-label="إبعاد الحافلة">−</button>
      </div>
      <p className="pointer-events-none absolute bottom-2 end-2 rounded-full bg-card/85 px-3 py-1 text-[12px] text-muted-foreground backdrop-blur" aria-live="polite">
        {touched ? "نموذج أولي للحافلة" : "اسحب لتدوير الحافلة 360°"}
      </p>
    </div>
  )
}
