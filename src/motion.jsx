import { useEffect, useRef } from 'react'
import { styles } from './styles.js'

// "Voxel Wave" motion for RADIUS: a small isometric grid of blocks that rise
// and fall in a diagonal wave. It is drawn on a canvas, in the live accent
// colour (--accent), and is used in three places:
//   mode="think"   loops forever. Used by <Cube3D> (chat "Thinking...", quiz loading).
//   mode="launch"  plays once, then keeps gently moving. Used by <LaunchSplash>.
//   mode="sign"    waves faster while signing in. When `done` turns true it
//                  levels into one slab and draws a check mark. Used by <SignInOverlay>.

const TAU = Math.PI * 2
const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
const prog = (t, a, b) => clamp((t - a) / (b - a), 0, 1)
const easeOut = (x) => 1 - Math.pow(1 - x, 3)
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
const easeBack = (x) => { const c = 1.70158, d = c + 1; return 1 + d * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2) }
const lerp = (a, b, k) => a + (b - a) * k

function readAccent() {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
    if (v[0] === '#') {
      const h = v.length === 4 ? v.slice(1).split('').map((c) => c + c).join('') : v.slice(1, 7)
      const n = parseInt(h, 16)
      if (!Number.isNaN(n)) return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    }
    const m = v.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/)
    if (m) return [+m[1], +m[2], +m[3]]
  } catch (e) { /* fall through */ }
  return [34, 197, 94]
}

function drawVoxel(g, t, mode, u, n, rgb, tf, r) {
  // colour helper: alpha, brightness multiplier, mix toward white
  const A = (a, m = 1, w = 0) => {
    const c = rgb.map((v) => Math.round(Math.min(255, v * m + (255 - v * m) * w)))
    return `rgba(${c[0]},${c[1]},${c[2]},${clamp(a, 0, 1)})`
  }
  const k = 4 / n
  const cw = 0.17 * k, ch = 0.085 * k, oy = n === 4 ? 0.2 : 0.16
  const lw = Math.max(0.008, 1.3 * u)
  const L = mode === 'launch'
  const S = mode === 'sign'
  const resolving = S && r >= 0
  const half = (n - 1) / 2
  const Pj = (x, y, z) => [(x - y) * cw, (x + y) * ch - z + oy]
  const poly = (pts, fill, stroke) => {
    g.beginPath()
    pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])))
    g.closePath()
    g.fillStyle = fill; g.fill()
    g.strokeStyle = stroke; g.lineWidth = lw; g.stroke()
  }
  const cells = []
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) cells.push([x, y])
  cells.sort((a, b) => a[0] + a[1] - (b[0] + b[1]))

  for (const [x, y] of cells) {
    const dd = x + y
    const gx = x - half, gy = y - half
    const tt = resolving ? Math.min(t, tf) : t
    let s, h, wh = 0, bo = 0
    if (S) {
      const p = prog(tt, 0, 1.6)
      const phase = 3.2 * tt + 9 * p * p + (tt > 1.6 ? 11.25 * (tt - 1.6) : 0)
      s = Math.sin(phase - dd * 0.9)
      h = 0.07 + (0.1 + 0.1 * p) * (1 + s)
    } else {
      s = Math.sin(3.2 * t - dd * 0.9)
      h = 0.07 + 0.11 * (1 + s)
    }
    let b = 0.5 + 0.5 * s
    if (L) {
      const d0 = 0.2 + dd * 0.12
      h *= easeBack(prog(t, d0, d0 + 0.7))
      wh = 0.55 * (1 - prog(t, d0 + 0.5, d0 + 1.1))
      if (t > 1.8 && t < 3.2) bo = Math.exp(-Math.pow(dd - (t - 1.8) * 5, 2) / 0.8)
    }
    if (resolving) {
      const e = easeInOut(prog(r, 0, 0.55))
      h = lerp(h, 0.13, e)
      b = lerp(b, 1, e)
      wh = 0.6 * (1 - prog(r, 0.55, 1.1)) * prog(r, 0.25, 0.55)
    }
    h = Math.max(h, 0.02)
    b = clamp(b + bo * 0.6, 0, 1)
    wh = clamp(wh + bo * 0.4, 0, 1)
    const q = 0.44
    g.lineJoin = 'round'
    poly([Pj(gx - q, gy + q, h), Pj(gx + q, gy + q, h), Pj(gx + q, gy + q, 0), Pj(gx - q, gy + q, 0)], A(1, 0.3 + 0.1 * b), A(0.7, 0.6))
    poly([Pj(gx + q, gy - q, h), Pj(gx + q, gy + q, h), Pj(gx + q, gy + q, 0), Pj(gx + q, gy - q, 0)], A(1, 0.18 + 0.05 * b), A(0.7, 0.5))
    poly([Pj(gx - q, gy - q, h), Pj(gx + q, gy - q, h), Pj(gx + q, gy + q, h), Pj(gx - q, gy + q, h)], A(1, 0.5 + 0.5 * b, wh), A(0.95, 1, 0.25))
  }

  if (resolving && r > 0.5) {
    const rise = easeOut(prog(r, 0.5, 1.1))
    const cy = lerp(-0.45, -0.74, rise)
    const gr = g.createRadialGradient(0, cy, 0, 0, cy, 0.3)
    gr.addColorStop(0, A(0.35 * rise, 1, 0.6)); gr.addColorStop(1, A(0))
    g.fillStyle = gr; g.beginPath(); g.arc(0, cy, 0.3, 0, TAU); g.fill()
    const p = prog(r, 0.6, 1.15)
    if (p > 0) {
      const pts = [[-0.26, 0], [-0.07, 0.2], [0.28, -0.2]], L1 = 0.276, L2 = 0.531, d = p * (L1 + L2), s2 = 0.24
      const kk = Math.min(d, L1) / L1
      g.beginPath()
      g.moveTo(pts[0][0] * s2, cy + pts[0][1] * s2)
      g.lineTo((pts[0][0] + (pts[1][0] - pts[0][0]) * kk) * s2, cy + (pts[0][1] + (pts[1][1] - pts[0][1]) * kk) * s2)
      if (d > L1) {
        const k2 = (d - L1) / L2
        g.lineTo((pts[1][0] + (pts[2][0] - pts[1][0]) * k2) * s2, cy + (pts[1][1] + (pts[2][1] - pts[1][1]) * k2) * s2)
      }
      g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(0.04, 1.3 * u); g.lineCap = 'square'; g.lineJoin = 'miter'; g.stroke()
      g.lineCap = 'round'
    }
  }
}

export function VoxelWave({ size = 120, mode = 'think', done = false, style }) {
  const ref = useRef(null)
  const doneAt = useRef(null)
  const doneProp = useRef(done)
  doneProp.current = done
  // With reduced motion there is no animation loop, so the still frame has to
  // be redrawn once when sign-in finishes. Normal motion never restarts.
  const reduceMotion = typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const stillDone = reduceMotion && done

  useEffect(() => {
    const cv = ref.current
    if (!cv) return undefined
    const g = cv.getContext('2d')
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    cv.width = cv.height = Math.round(size * dpr)
    const n = size < 48 ? 3 : 4
    const u = 2 / size
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let rgb = readAccent()
    let raf = 0
    let frames = 0
    const t0 = performance.now()
    doneAt.current = null

    const paint = (t, tf, r) => {
      const kk = (dpr * size) / 2
      g.setTransform(1, 0, 0, 1, 0, 0)
      g.clearRect(0, 0, cv.width, cv.height)
      g.setTransform(kk, 0, 0, kk, kk, kk)
      g.lineCap = 'round'
      drawVoxel(g, t, mode, u, n, rgb, tf, r)
    }

    if (reduce) {
      // No motion: draw one still frame that still tells the story.
      const finished = mode === 'sign' && doneProp.current
      paint(mode === 'launch' ? 5 : 1.2, 0, finished ? 2 : -1)
      return undefined
    }

    const frame = (now) => {
      if (frames++ % 40 === 0) rgb = readAccent() // follows the accent colour picker
      if (doneProp.current && doneAt.current == null) doneAt.current = now
      const t = (now - t0) / 1000
      const tf = doneAt.current == null ? 0 : (doneAt.current - t0) / 1000
      const r = doneAt.current == null ? -1 : (now - doneAt.current) / 1000
      paint(t, tf, r)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [size, mode, stillDone])

  return <canvas ref={ref} aria-hidden="true" style={{ width: size, height: size, display: 'block', flexShrink: 0, ...style }} />
}

// ---- Shared canvas runner for the globe and the gyro cube -------------------
const mkA = (rgb) => (a, m = 1, w = 0) => {
  const c = rgb.map((v) => Math.round(Math.min(255, v * m + (255 - v * m) * w)))
  return `rgba(${c[0]},${c[1]},${c[2]},${clamp(a, 0, 1)})`
}

function P3(x, y, z, ay, ax) {
  let c = Math.cos(ay), s = Math.sin(ay)
  const x1 = x * c + z * s, z1 = -x * s + z * c
  c = Math.cos(ax); s = Math.sin(ax)
  const y1 = y * c - z1 * s, z2 = y * s + z1 * c, f = 3.2 / (3.2 + z2)
  return [x1 * f, y1 * f, z2, f]
}

function CanvasAnim({ size, draw, style }) {
  const ref = useRef(null)
  const drawRef = useRef(draw)
  drawRef.current = draw
  useEffect(() => {
    const cv = ref.current
    if (!cv) return undefined
    const g = cv.getContext('2d')
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    cv.width = cv.height = Math.round(size * dpr)
    const u = 2 / size
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let rgb = readAccent()
    let raf = 0
    let frames = 0
    const t0 = performance.now()
    const paint = (t) => {
      const k = (dpr * size) / 2
      g.setTransform(1, 0, 0, 1, 0, 0)
      g.clearRect(0, 0, cv.width, cv.height)
      g.setTransform(k, 0, 0, k, k, k)
      g.lineCap = 'round'; g.lineJoin = 'round'
      drawRef.current(g, t, u, rgb)
    }
    if (reduce) { paint(1.6); return undefined }
    const frame = (now) => {
      if (frames++ % 40 === 0) rgb = readAccent()
      paint((now - t0) / 1000)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [size])
  return <canvas ref={ref} aria-hidden="true" style={{ width: size, height: size, display: 'block', flexShrink: 0, ...style }} />
}

// ---- Particle Globe: the thinking loader ------------------------------------
const GLOBES = {}
function globePoints(n) {
  if (GLOBES[n]) return GLOBES[n]
  const pts = []
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n
    const r = Math.sqrt(1 - y * y), th = i * 2.399963
    pts.push([Math.cos(th) * r, y, Math.sin(th) * r])
  }
  GLOBES[n] = pts
  return pts
}

function drawGlobe(g, t, u, rgb, pts) {
  const A = mkA(rgb)
  const R = 0.74, a = 0.7 * t, ph = 3 * t
  const grd = g.createRadialGradient(0, 0, 0, 0, 0, 0.9)
  grd.addColorStop(0, A(0.14, 1, 0.5)); grd.addColorStop(1, A(0))
  g.fillStyle = grd; g.beginPath(); g.arc(0, 0, 0.9, 0, TAU); g.fill()
  for (let i = 0; i < pts.length; i++) {
    const b = pts[i]
    const wv = Math.sin(b[1] * 6 - ph)
    const rr = R * (1 + 0.09 * wv)
    const p = P3(b[0] * rr, b[1] * rr, b[2] * rr, a, -0.35)
    const dn = clamp((1 - p[2]) / 2, 0, 1), br = 0.5 + 0.5 * wv
    const r = Math.max(1.0 * u, 0.006 + 0.013 * dn)
    g.beginPath(); g.arc(p[0], p[1], r, 0, TAU)
    g.fillStyle = A((0.25 + 0.75 * dn) * (0.45 + 0.55 * br), 1, br * 0.15)
    g.fill()
  }
}

// Replaces the old spinning cube everywhere it was used (chat "Thinking...",
// "Working on it...", quiz loading).
export function LoaderMark({ size = 20 }) {
  const px = size + 20
  const pts = globePoints(px < 48 ? 110 : 300)
  return <CanvasAnim size={px} draw={(g, t, u, rgb) => drawGlobe(g, t, u, rgb, pts)} style={{ verticalAlign: 'middle' }} />
}

// ---- Gyro Cube: the home-screen hero, with the RADIUS logo inside ------------
const CUBE_V = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]
const CUBE_E = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]

function drawGyro(g, t, u, rgb) {
  const A = mkA(rgb)
  const a = 0.5 * t
  const lw = Math.max(0.013, 1.3 * u)
  const rk = [easeBack(prog(t, 0.05, 0.75)), easeBack(prog(t, 0.2, 0.9)), easeBack(prog(t, 0.35, 1.05))]
  const cs = easeBack(prog(t, 0.3, 1.1)), ca = prog(t, 0.3, 0.6)
  const R = [0.9, 0.76, 0.62]
  for (let i = 0; i < 3; i++) {
    if (rk[i] < 0.01) continue
    const rr = R[i] * rk[i]
    const ay = a * (0.5 + 0.35 * i) + i * 1.1
    const ax = a * (0.3 + 0.2 * i) * (i % 2 ? -1 : 1) + 0.9 * i + 0.4
    let prev = null
    for (let k = 0; k <= 56; k++) {
      const ph = (k / 56) * TAU
      const p = P3(rr * Math.cos(ph), rr * Math.sin(ph), 0, ay, ax)
      if (prev) {
        const z = (p[2] + prev[2]) / 2
        g.beginPath(); g.moveTo(prev[0], prev[1]); g.lineTo(p[0], p[1])
        g.strokeStyle = A(clamp(0.6 - z * 1.1, 0.08, 1) * (0.85 - 0.15 * i)); g.lineWidth = lw; g.stroke()
      }
      prev = p
    }
    const bp = P3(rr * Math.cos(a * 1.4 + i * 2), rr * Math.sin(a * 1.4 + i * 2), 0, ay, ax)
    const gl = g.createRadialGradient(bp[0], bp[1], 0, bp[0], bp[1], 0.07)
    gl.addColorStop(0, A(0.7, 1, 0.75)); gl.addColorStop(1, A(0))
    g.fillStyle = gl; g.beginPath(); g.arc(bp[0], bp[1], 0.07, 0, TAU); g.fill()
    g.beginPath(); g.arc(bp[0], bp[1], 0.017, 0, TAU); g.fillStyle = '#fff'; g.fill()
  }
  if (ca > 0) {
    const e = 0.34 * cs
    const pr3 = CUBE_V.map((v) => P3(v[0] * e, v[1] * e, v[2] * e, a * 0.6, a * 0.35 + 0.5))
    CUBE_E.forEach((ed) => {
      const p = pr3[ed[0]], q = pr3[ed[1]], z = (p[2] + q[2]) / 2
      g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1])
      g.strokeStyle = A(ca * clamp(0.65 - z * 1.2, 0.2, 1), 1, 0.1); g.lineWidth = lw; g.stroke()
    })
  }
}

// The logo sits under the canvas, so the cube edges and rings pass in front of it.
export function GyroHero({ size = 150 }) {
  const logo = Math.round(size * 0.36)
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div style={{ position: 'absolute', inset: '14%', borderRadius: '50%', background: 'radial-gradient(circle, var(--accent-soft) 0%, transparent 68%)', filter: 'blur(10px)' }} />
      <img
        src="/logo.png"
        alt="RADIUS"
        style={{ position: 'absolute', left: '50%', top: '50%', width: logo, height: logo, marginLeft: -logo / 2, marginTop: -logo / 2, borderRadius: Math.round(logo * 0.22), objectFit: 'cover', boxShadow: '0 0 18px var(--accent-soft)', animation: 'vw-fade 0.6s ease 0.5s both' }}
      />
      <CanvasAnim size={size} draw={drawGyro} style={{ position: 'absolute', inset: 0 }} />
    </div>
  )
}

// Shown when RADIUS first opens in the browser. It sits on top of the app, so
// the app can finish loading underneath while the animation plays.
export function LaunchSplash() {
  const letters = 'RADIUS'.split('')
  return (
    <div role="status" aria-label="Starting RADIUS" style={{ ...styles.container, position: 'fixed', inset: 0, zIndex: 10000 }}>
      <VoxelWave size={230} mode="launch" />
      <div className="vw-word radius-display" aria-hidden="true">
        {letters.map((ch, i) => <span key={i} style={{ '--i': i }}>{ch}</span>)}
      </div>
      <p className="vw-tag" aria-hidden="true">ASSIGNMENT ASSISTANT</p>
    </div>
  )
}

// Shown while a password sign-in is running, then finishes with a check mark.
export function SignInOverlay({ status }) {
  const ok = status === 'success'
  return (
    <div
      role="status"
      aria-live="polite"
      style={{ position: 'fixed', inset: 0, zIndex: 10001, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.1rem', backgroundColor: 'var(--bg, #0a0c12)', color: 'var(--text, #fff)', animation: 'radius-fade-scale 0.25s ease both' }}
    >
      <VoxelWave size={220} mode="sign" done={ok} />
      <p key={status} className="vw-status">{ok ? 'Welcome back' : 'Signing you in'}</p>
    </div>
  )
}
