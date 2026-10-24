// RADIUS diagram engine.
// The AI only supplies a small JSON spec (numbers and labels). Everything is
// drawn here in code, so the geometry is always exact. Every renderer returns
// { svg, width, height }. Colours come from the palette passed in, so diagrams
// match the light and dark themes and export cleanly as images.

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

export const DIAGRAM_TYPES = ['miller_plane', 'fbd', 'beam', 'circuit', 'lens']

const num = (v, d = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : d
}
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const r1 = (n) => Math.round(n * 10) / 10
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Short numbers for labels: 3.3333 -> 3.33, 2 -> 2.
function fmt(v, digits = 3) {
  if (!Number.isFinite(v)) return '?'
  if (Math.abs(v) < 1e-9) return '0'
  return String(Number(v.toPrecision(digits)))
}

// Labels may use _ for a subscript and ^ for a superscript, e.g. "F_N" or "m^2".
function rich(label, size) {
  const s = String(label ?? '')
  const re = /([_^])(\{[^}]*\}|[A-Za-z0-9]+)/g
  let out = ''
  let last = 0
  let pending = 0
  let m
  const flush = (txt) => {
    if (!txt) return
    out += pending ? `<tspan dy="${r1(pending)}">${esc(txt)}</tspan>` : esc(txt)
    pending = 0
  }
  while ((m = re.exec(s))) {
    flush(s.slice(last, m.index))
    const body = m[2].replace(/^\{|\}$/g, '')
    const dy = m[1] === '_' ? size * 0.25 : -size * 0.4
    const dyNow = pending ? dy + pending : dy
    out += `<tspan dy="${r1(dyNow)}" font-size="${r1(size * 0.75)}">${esc(body)}</tspan>`
    pending = -dy
    last = m.index + m[0].length
  }
  flush(s.slice(last))
  return out
}

function T(x, y, label, { size = 13, anchor = 'middle', weight = 400, fill, italic } = {}) {
  return `<text x="${r1(x)}" y="${r1(y)}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}"${italic ? ' font-style="italic"' : ''} fill="${fill}" font-family="${FONT}">${rich(label, size)}</text>`
}

function line(x1, y1, x2, y2, stroke, w = 1.5, dash) {
  return `<line x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`
}

function arrow(x1, y1, x2, y2, color, w = 2.2, head = 9) {
  const a = Math.atan2(y2 - y1, x2 - x1)
  const bx = x2 - head * Math.cos(a)
  const by = y2 - head * Math.sin(a)
  const px = (head * 0.42) * Math.sin(a)
  const py = (head * 0.42) * Math.cos(a)
  return (
    line(x1, y1, bx, by, color, w) +
    `<polygon points="${r1(x2)},${r1(y2)} ${r1(bx + px)},${r1(by - py)} ${r1(bx - px)},${r1(by + py)}" fill="${color}"/>`
  )
}

function wrap(width, height, body) {
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" role="img" font-family="${FONT}">${body}</svg>`,
    width,
    height,
  }
}

// ---------------------------------------------------------------------------
// 1. Crystal plane in a unit cell (Miller indices)
// ---------------------------------------------------------------------------
function bar(n) {
  return n < 0 ? `${Math.abs(n)}\u0304` : String(n)
}

function planeEquation(h, k, l, d) {
  const terms = []
  ;[[h, 'x'], [k, 'y'], [l, 'z']].forEach(([co, v]) => {
    if (co === 0) return
    const a = Math.abs(co)
    const t = (a === 1 ? '' : String(a)) + v
    if (!terms.length) terms.push(co < 0 ? `\u2212${t}` : t)
    else terms.push(`${co < 0 ? '\u2212' : '+'} ${t}`)
  })
  return `${terms.join(' ')} = ${fmt(d)}`
}

function miller(spec, p) {
  const h = Math.round(num(spec.h))
  const k = Math.round(num(spec.k))
  const l = Math.round(num(spec.l))
  if (![h, k, l].every((n) => Math.abs(n) <= 6) || (h === 0 && k === 0 && l === 0)) {
    throw new Error('Miller indices must be whole numbers from -6 to 6, not all zero.')
  }
  const hasNeg = h < 0 || k < 0 || l < 0
  // A negative index means the origin moves to the far corner of that axis.
  const d = 1 + [h, k, l].filter((n) => n < 0).reduce((a, b) => a + b, 0)
  const g = (P) => h * P[0] + k * P[1] + l * P[2] - d

  const corners = []
  for (let x = 0; x <= 1; x++) for (let y = 0; y <= 1; y++) for (let z = 0; z <= 1; z++) corners.push([x, y, z])
  const pts = []
  const addPt = (P) => {
    if (!pts.some((Q) => Math.hypot(P[0] - Q[0], P[1] - Q[1], P[2] - Q[2]) < 1e-6)) pts.push(P)
  }
  corners.forEach((P) => { if (Math.abs(g(P)) < 1e-9) addPt(P) })
  corners.forEach((A) => corners.forEach((B) => {
    const diff = (A[0] !== B[0]) + (A[1] !== B[1]) + (A[2] !== B[2])
    if (diff !== 1 || A[0] + A[1] + A[2] > B[0] + B[1] + B[2]) return
    const ga = g(A)
    const gb = g(B)
    if (ga * gb < -1e-12) {
      const t = ga / (ga - gb)
      addPt([A[0] + t * (B[0] - A[0]), A[1] + t * (B[1] - A[1]), A[2] + t * (B[2] - A[2])])
    }
  }))
  if (pts.length < 3) throw new Error('That plane does not cut through the unit cell.')

  // Order the corners of the cut around the plane.
  const n = [h, k, l]
  const nl = Math.hypot(...n)
  const nn = n.map((v) => v / nl)
  const helper = Math.abs(nn[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
  let u = cross(nn, helper)
  const ul = Math.hypot(...u)
  u = u.map((v) => v / ul)
  const v2 = cross(nn, u)
  const cen = [0, 1, 2].map((i) => pts.reduce((s, P) => s + P[i], 0) / pts.length)
  pts.sort((A, B) => {
    const ang = (P) => {
      const r = [P[0] - cen[0], P[1] - cen[1], P[2] - cen[2]]
      return Math.atan2(r[0] * v2[0] + r[1] * v2[1] + r[2] * v2[2], r[0] * u[0] + r[1] * u[1] + r[2] * u[2])
    }
    return ang(A) - ang(B)
  })

  // Oblique projection: x comes toward the viewer (down-left), y goes right, z goes up.
  const O = [150, 234]
  const EX = [-70, 45]
  const EY = [130, 0]
  const EZ = [0, -130]
  const P = (x, y, z) => [O[0] + x * EX[0] + y * EY[0] + z * EZ[0], O[1] + x * EX[1] + y * EY[1] + z * EZ[1]]
  const poly = pts.map((q) => P(...q).map(r1).join(',')).join(' ')

  const solid = [
    [[1, 0, 0], [1, 1, 0]], [[1, 1, 0], [0, 1, 0]], [[1, 0, 0], [1, 0, 1]], [[1, 1, 0], [1, 1, 1]],
    [[0, 1, 0], [0, 1, 1]], [[1, 0, 1], [1, 1, 1]], [[1, 1, 1], [0, 1, 1]], [[1, 0, 1], [0, 0, 1]], [[0, 0, 1], [0, 1, 1]],
  ]
  const hidden = [[[0, 0, 0], [1, 0, 0]], [[0, 0, 0], [0, 1, 0]], [[0, 0, 0], [0, 0, 1]]]
  const seg = (a, b, stroke, w, dash) => line(...P(...a), ...P(...b), stroke, w, dash)

  let body = ''
  body += `<polygon points="${poly}" fill="${p.accent}" fill-opacity="0.3"/>`
  hidden.forEach(([a, b]) => { body += seg(a, b, p.sub, 1.2, '5 4') })
  solid.forEach(([a, b]) => { body += seg(a, b, p.text, 1.6) })
  body += `<polygon points="${poly}" fill="none" stroke="${p.accent}" stroke-width="2.2" stroke-linejoin="round"/>`

  // Axes continue past the cell with arrowheads and labels.
  const tip = (a, b) => {
    const A = P(...a)
    const B = P(...b)
    return arrow(A[0], A[1], B[0], B[1], p.sub, 1.4, 7)
  }
  body += tip([1, 0, 0], [1.28, 0, 0]) + tip([0, 1, 0], [0, 1.28, 0]) + tip([0, 0, 1], [0, 0, 1.28])
  const xt = P(1.28, 0, 0)
  const yt = P(0, 1.28, 0)
  const zt = P(0, 0, 1.28)
  body += T(xt[0] - 9, xt[1] + 5, 'x', { size: 14, weight: 600, fill: p.text, italic: true })
  body += T(yt[0] + 10, yt[1] + 5, 'y', { size: 14, weight: 600, fill: p.text, italic: true })
  body += T(zt[0], zt[1] - 7, 'z', { size: 14, weight: 600, fill: p.text, italic: true })

  const o = P(0, 0, 0)
  body += `<circle cx="${o[0]}" cy="${o[1]}" r="3" fill="${p.sub}"/>`
  body += T(o[0] + 9, o[1] - 7, 'O', { size: 12, fill: p.sub })

  // Intercept dots and labels (only when no axis is shifted).
  const fr = (i) => (i === 1 ? '1' : `1/${i}`)
  if (!hasNeg) {
    if (h > 0) {
      const A = P(1 / h, 0, 0)
      body += line(A[0], A[1] + 5, A[0], 301, p.sub, 0.8, '3 3')
      body += `<circle cx="${r1(A[0])}" cy="${r1(A[1])}" r="4.5" fill="${p.accent}"/>`
      body += T(A[0], 316, `x = ${fr(h)}`, { size: 13, weight: 600, fill: p.accent })
    }
    if (k > 0) {
      const B = P(0, 1 / k, 0)
      body += `<circle cx="${r1(B[0])}" cy="${r1(B[1])}" r="4.5" fill="${p.accent}"/>`
      body += T(B[0] + 12, B[1] + 26, `y = ${fr(k)}`, { size: 13, weight: 600, fill: p.accent, anchor: 'start' })
    }
    if (l > 0) {
      const C = P(0, 0, 1 / l)
      body += `<circle cx="${r1(C[0])}" cy="${r1(C[1])}" r="4.5" fill="${p.accent}"/>`
      body += line(C[0] - 6, C[1], C[0] - 34, C[1], p.sub, 0.8, '3 3')
      body += T(C[0] - 38, C[1] + 5, `z = ${fr(l)}`, { size: 13, weight: 600, fill: p.accent, anchor: 'end' })
    }
  }

  const idx = `(${bar(h)} ${bar(k)} ${bar(l)})`
  body += T(190, 344, `Plane ${idx}:  ${planeEquation(h, k, l, d)}`, { size: 13, weight: 600, fill: p.text })
  let sub
  if (hasNeg) sub = 'Origin moved to the far corner of the axes with a negative index'
  else sub = 'Intercepts: ' + [[h, 'x'], [k, 'y'], [l, 'z']].map(([i, a]) => `${a} = ${i === 0 ? '\u221E' : fr(i)}`).join(',  ')
  body += T(190, 363, sub, { size: 12, fill: p.sub })

  body += `<rect x="64" y="378" width="16" height="10" rx="2" fill="${p.accent}" fill-opacity="0.3" stroke="${p.accent}" stroke-width="1.4"/>`
  body += T(86, 387, `${idx} plane`, { size: 12, fill: p.sub, anchor: 'start' })
  body += line(190, 383, 214, 383, p.sub, 1.2, '5 4')
  body += T(220, 387, 'hidden edge', { size: 12, fill: p.sub, anchor: 'start' })
  return wrap(380, 400, body)
}

// ---------------------------------------------------------------------------
// 2. Free body diagram
// ---------------------------------------------------------------------------
function fbd(spec, p) {
  const W = 380
  const H = 340
  const incl = clamp(num(spec.incline, 0), 0, 75)
  const th = (incl * Math.PI) / 180
  const forces = (Array.isArray(spec.forces) ? spec.forces : []).slice(0, 8)
  const kind = String(spec.object || 'block').toLowerCase()
  const colors = [p.accent, '#e5645b', '#4aa3ff', '#e8a33d', '#a678f5', '#2fbf9b', '#f06fa8', '#8fbf3f']
  let body = ''
  let cx
  let cy

  if (incl < 1) {
    const gy = 218
    cx = 190
    cy = gy - 22
    body += line(40, gy, 340, gy, p.sub, 1.6)
    for (let x = 48; x < 340; x += 12) body += line(x, gy, x - 8, gy + 9, p.sub, 1)
    if (kind === 'particle' || kind === 'point') body += `<circle cx="${cx}" cy="${cy}" r="6" fill="${p.text}"/>`
    else if (kind === 'sphere' || kind === 'ball') body += `<circle cx="${cx}" cy="${gy - 22}" r="22" fill="${p.sub}" fill-opacity="0.2" stroke="${p.text}" stroke-width="1.8"/>`
    else body += `<rect x="${cx - 32}" y="${cy - 22}" width="64" height="44" rx="3" fill="${p.sub}" fill-opacity="0.2" stroke="${p.text}" stroke-width="1.8"/>`
  } else {
    const ax = 40
    const ay = 290
    const L = Math.min(300 / Math.cos(th), 190 / Math.sin(th), 330)
    const bx = ax + L * Math.cos(th)
    const ty = ay - L * Math.sin(th)
    body += `<polygon points="${ax},${ay} ${r1(bx)},${ay} ${r1(bx)},${r1(ty)}" fill="${p.sub}" fill-opacity="0.12" stroke="${p.text}" stroke-width="1.8" stroke-linejoin="round"/>`
    const s = L * 0.55
    const hh = kind === 'particle' ? 0 : 22
    const sx = ax + s * Math.cos(th)
    const sy = ay - s * Math.sin(th)
    cx = sx - Math.sin(th) * hh
    cy = sy - Math.cos(th) * hh
    if (kind === 'particle' || kind === 'point') {
      body += `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="6" fill="${p.text}"/>`
    } else if (kind === 'sphere' || kind === 'ball') {
      cx = sx - Math.sin(th) * 22
      cy = sy - Math.cos(th) * 22
      body += `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="22" fill="${p.sub}" fill-opacity="0.2" stroke="${p.text}" stroke-width="1.8"/>`
    } else {
      body += `<rect x="${r1(cx - 32)}" y="${r1(cy - 22)}" width="64" height="44" rx="3" fill="${p.sub}" fill-opacity="0.2" stroke="${p.text}" stroke-width="1.8" transform="rotate(${r1(-incl)} ${r1(cx)} ${r1(cy)})"/>`
    }
    const r = 44
    body += `<path d="M ${r1(ax + r)} ${ay} A ${r} ${r} 0 0 0 ${r1(ax + r * Math.cos(th))} ${r1(ay - r * Math.sin(th))}" fill="none" stroke="${p.sub}" stroke-width="1.4"/>`
    body += T(ax + r + 10, ay - 8, `\u03B8 = ${fmt(incl)}\u00B0`, { size: 13, fill: p.text, anchor: 'start', weight: 600 })
  }

  const mags = forces.map((f) => Math.abs(num(f.mag, 0))).filter((m) => m > 0)
  const maxMag = mags.length ? Math.max(...mags) : 0
  forces.forEach((f, i) => {
    const ang = (num(f.angle, 0) * Math.PI) / 180
    const m = Math.abs(num(f.mag, 0))
    const len = maxMag > 0 && m > 0 ? 44 + 62 * (m / maxMag) : 78
    const dx = Math.cos(ang)
    const dy = -Math.sin(ang)
    const x2 = cx + dx * len
    const y2 = cy + dy * len
    const col = colors[i % colors.length]
    body += arrow(cx, cy, x2, y2, col, 2.6, 10)
    const lx = x2 + dx * 8
    const ly = y2 + dy * 8 + (Math.abs(dx) > 0.35 ? 4 : dy < 0 ? -3 : 13)
    body += T(lx, ly, f.label || `F${i + 1}`, { size: 13, weight: 600, fill: col, anchor: dx > 0.35 ? 'start' : dx < -0.35 ? 'end' : 'middle' })
  })
  body += `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="3.2" fill="${p.text}"/>`
  if (spec.note) body += T(190, H - 12, spec.note, { size: 12, fill: p.sub })
  return wrap(W, H, body)
}

// ---------------------------------------------------------------------------
// 3. Beam with supports and loads
// ---------------------------------------------------------------------------
function hatch(x, y, w, p, dir = 'down') {
  let s = ''
  for (let i = 0; i <= w; i += 8) s += line(x + i, y, x + i - 7, y + (dir === 'down' ? 8 : -8), p.sub, 1)
  return s
}

function beam(spec, p) {
  const W = 380
  const L = num(spec.length, 0)
  if (!(L > 0)) throw new Error('The beam needs a positive length.')
  const unit = spec.unit ? String(spec.unit) : 'm'
  const x0 = 50
  const x1 = 330
  const by = 142
  const sc = (x) => x0 + (clamp(num(x, 0), 0, L) / L) * (x1 - x0)
  const supports = (Array.isArray(spec.supports) ? spec.supports : []).slice(0, 4)
  const loads = (Array.isArray(spec.loads) ? spec.loads : []).slice(0, 8)
  let body = ''

  supports.forEach((s) => {
    const x = sc(s.at)
    const kind = String(s.kind || s.type || 'pin').toLowerCase()
    if (kind === 'fixed') {
      const right = num(s.at, 0) > L / 2
      const wx = right ? x : x - 12
      body += `<rect x="${wx}" y="${by - 34}" width="12" height="76" fill="${p.sub}" fill-opacity="0.16" stroke="${p.text}" stroke-width="1.6"/>`
      for (let yy = by - 30; yy < by + 40; yy += 10) {
        body += line(right ? wx + 12 : wx, yy, right ? wx + 22 : wx - 10, yy + 9, p.sub, 1)
      }
    } else if (kind === 'roller') {
      body += `<polygon points="${r1(x)},${by + 4} ${r1(x - 13)},${by + 26} ${r1(x + 13)},${by + 26}" fill="none" stroke="${p.text}" stroke-width="1.6" stroke-linejoin="round"/>`
      body += `<circle cx="${r1(x - 6)}" cy="${by + 31}" r="4.5" fill="none" stroke="${p.text}" stroke-width="1.4"/><circle cx="${r1(x + 6)}" cy="${by + 31}" r="4.5" fill="none" stroke="${p.text}" stroke-width="1.4"/>`
      body += line(x - 20, by + 36, x + 20, by + 36, p.text, 1.6)
      body += hatch(x - 20, by + 36, 40, p)
    } else {
      body += `<polygon points="${r1(x)},${by + 4} ${r1(x - 14)},${by + 28} ${r1(x + 14)},${by + 28}" fill="none" stroke="${p.text}" stroke-width="1.6" stroke-linejoin="round"/>`
      body += line(x - 22, by + 28, x + 22, by + 28, p.text, 1.6)
      body += hatch(x - 22, by + 28, 44, p)
    }
    if (s.label) body += T(x, by + 62, s.label, { size: 13, weight: 600, fill: p.accent })
  })

  loads.forEach((ld) => {
    const kind = String(ld.kind || ld.type || 'point').toLowerCase()
    if (kind === 'udl') {
      const a = sc(ld.from ?? 0)
      const b = sc(ld.to ?? L)
      const top = by - 46
      body += line(a, top, b, top, p.accent, 1.8)
      const n = Math.max(2, Math.round((b - a) / 18))
      for (let i = 0; i <= n; i++) {
        const x = a + ((b - a) * i) / n
        body += arrow(x, top, x, by - 5, p.accent, 1.6, 7)
      }
      if (ld.label) body += T((a + b) / 2, top - 9, ld.label, { size: 13, weight: 600, fill: p.accent })
    } else if (kind === 'moment') {
      const x = sc(ld.at)
      const r = 20
      const cyy = by - 38
      const cw = String(ld.dir || 'cw').toLowerCase() !== 'ccw'
      // Three-quarter circle with the gap at the bottom, arrowhead at the end.
      const a0 = (cw ? 135 : 45) * (Math.PI / 180)
      const a1 = (cw ? 45 : 135) * (Math.PI / 180)
      const pt = (a) => [x + r * Math.cos(a), cyy - r * Math.sin(a) * -1]
      const sP = pt(a0)
      const eP = pt(a1)
      body += `<path d="M ${r1(sP[0])} ${r1(sP[1])} A ${r} ${r} 0 1 ${cw ? 1 : 0} ${r1(eP[0])} ${r1(eP[1])}" fill="none" stroke="${p.accent}" stroke-width="2.2" stroke-linecap="round"/>`
      const tx = cw ? -Math.sin(a1) * -1 : Math.sin(a1) * -1
      const ty = cw ? Math.cos(a1) : -Math.cos(a1)
      body += arrow(eP[0] - tx * 6, eP[1] - ty * 6, eP[0] + tx * 2, eP[1] + ty * 2, p.accent, 2.2, 9)
      body += line(x, cyy + r, x, by - 4, p.sub, 0.8, '3 3')
      if (ld.label) body += T(x, cyy - r - 9, ld.label, { size: 13, weight: 600, fill: p.accent })
    } else {
      const x = sc(ld.at)
      const up = String(ld.dir || 'down').toLowerCase() === 'up'
      if (up) {
        body += arrow(x, by + 68, x, by + 6, p.accent, 2.4, 10)
        if (ld.label) body += T(x, by + 86, ld.label, { size: 13, weight: 600, fill: p.accent })
      } else {
        body += arrow(x, by - 62, x, by - 4, p.accent, 2.4, 10)
        if (ld.label) body += T(x, by - 70, ld.label, { size: 13, weight: 600, fill: p.accent })
      }
    }
  })

  body += `<rect x="${x0}" y="${by - 4}" width="${x1 - x0}" height="8" rx="1.5" fill="${p.text}" fill-opacity="0.85"/>`

  // Dimension lines between every support and load position.
  const keys = new Set([0, L])
  supports.forEach((s) => keys.add(clamp(num(s.at, 0), 0, L)))
  loads.forEach((ld) => {
    if (String(ld.kind || ld.type || 'point').toLowerCase() === 'udl') {
      keys.add(clamp(num(ld.from, 0), 0, L))
      keys.add(clamp(num(ld.to, L), 0, L))
    } else keys.add(clamp(num(ld.at, 0), 0, L))
  })
  const ks = Array.from(keys).sort((a, b) => a - b)
  const dy = 232
  body += line(x0, dy, x1, dy, p.sub, 1)
  ks.forEach((k) => {
    body += line(sc(k), dy - 6, sc(k), dy + 6, p.sub, 1.2)
    body += line(sc(k), by + 10, sc(k), dy - 6, p.sub, 0.6, '2 4')
  })
  for (let i = 0; i < ks.length - 1; i++) {
    const a = sc(ks[i])
    const b = sc(ks[i + 1])
    if (b - a >= 26) body += T((a + b) / 2, dy + 19, `${fmt(ks[i + 1] - ks[i])} ${unit}`, { size: 12, fill: p.sub })
  }
  let H = 270
  if (ks.length > 2) {
    const dy2 = 262
    body += line(x0, dy2, x1, dy2, p.sub, 1)
    body += line(x0, dy2 - 6, x0, dy2 + 6, p.sub, 1.2) + line(x1, dy2 - 6, x1, dy2 + 6, p.sub, 1.2)
    body += T(190, dy2 + 19, `${fmt(L)} ${unit}`, { size: 12, weight: 600, fill: p.text })
    H = 300
  }
  return wrap(W, H, body)
}

// ---------------------------------------------------------------------------
// 4. Circuit
// ---------------------------------------------------------------------------
function symbol(kind, p) {
  const s = p.text
  const w = 1.8
  switch (kind) {
    case 'capacitor':
      return `<path d="M-28 0 H-4 M4 0 H28" stroke="${s}" stroke-width="${w}" fill="none"/><path d="M-4 -14 V14 M4 -14 V14" stroke="${s}" stroke-width="2.6" fill="none"/>`
    case 'inductor':
      return `<path d="M-28 0 H-20 a5 5 0 0 1 10 0 a5 5 0 0 1 10 0 a5 5 0 0 1 10 0 a5 5 0 0 1 10 0 H28" stroke="${s}" stroke-width="${w}" fill="none"/>`
    case 'lamp':
      return `<path d="M-28 0 H-11 M11 0 H28" stroke="${s}" stroke-width="${w}" fill="none"/><circle r="11" fill="none" stroke="${s}" stroke-width="${w}"/><path d="M-7.8 -7.8 L7.8 7.8 M-7.8 7.8 L7.8 -7.8" stroke="${s}" stroke-width="1.6"/>`
    case 'switch':
      return `<path d="M-28 0 H-12 M12 0 H28" stroke="${s}" stroke-width="${w}" fill="none"/><path d="M-12 0 L11 -14" stroke="${s}" stroke-width="${w}" fill="none"/><circle cx="-12" r="2.6" fill="${s}"/><circle cx="12" r="2.6" fill="${s}"/>`
    case 'battery':
      return `<path d="M-28 0 H-3 M3 0 H28" stroke="${s}" stroke-width="${w}" fill="none"/><path d="M-3 -15 V15" stroke="${s}" stroke-width="2.8"/><path d="M3 -8 V8" stroke="${s}" stroke-width="2.8"/>`
    case 'ac':
      return `<path d="M-28 0 H-13 M13 0 H28" stroke="${s}" stroke-width="${w}" fill="none"/><circle r="13" fill="none" stroke="${s}" stroke-width="${w}"/><path d="M-8 0 q4 -8 8 0 t8 0" stroke="${s}" stroke-width="1.6" fill="none"/>`
    default:
      return `<path d="M-28 0 H-21 L-16 -9 L-8 9 L0 -9 L8 9 L15 -9 L21 0 H28" stroke="${s}" stroke-width="${w}" fill="none" stroke-linejoin="round"/>`
  }
}

function place(kind, cx, cy, vertical, p) {
  return `<g transform="translate(${r1(cx)} ${r1(cy)})${vertical ? ' rotate(90)' : ''}">${symbol(kind, p)}</g>`
}

function labelLines(x, y, label, p, { anchor = 'middle', size = 12.5 } = {}) {
  const s = String(label ?? '')
  const parts = s.includes(' = ') ? [s.split(' = ')[0], s.split(' = ').slice(1).join(' = ')] : [s]
  return parts.map((t, i) => T(x, y + i * 15, t, { size, anchor, weight: i === 0 && parts.length > 1 ? 600 : 400, fill: p.text })).join('')
}

function circuit(spec, p) {
  const W = 380
  const parts = (Array.isArray(spec.parts) ? spec.parts : Array.isArray(spec.components) ? spec.components : []).slice(0, 6)
  if (!parts.length) throw new Error('The circuit needs at least one part.')
  const src = spec.source || { kind: 'battery' }
  const srcKind = String(src.kind || 'battery').toLowerCase() === 'ac' ? 'ac' : 'battery'
  const layout = String(spec.layout || 'series').toLowerCase()
  const kindOf = (c) => String(c.kind || c.type || 'resistor').toLowerCase()
  const dot = (x, y) => `<circle cx="${r1(x)}" cy="${r1(y)}" r="3.2" fill="${p.text}"/>`
  const wire = (pts) => `<polyline points="${pts.map((q) => q.map(r1).join(',')).join(' ')}" fill="none" stroke="${p.text}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>`
  const L = 50
  const R = 330
  const top = 74
  let body = ''
  let H

  if (layout === 'parallel') {
    const n = parts.length
    const bot = 214
    const mid = (top + bot) / 2
    const xs = parts.map((_, i) => L + (230 * (i + 1)) / n + 20)
    const last = xs[n - 1]
    body += wire([[L, mid + 28], [L, bot], [last, bot]]) + wire([[L, mid - 28], [L, top], [last, top]])
    body += place(srcKind, L, mid, true, p)
    body += T(L + 24, mid + 4, src.label || '', { size: 12.5, anchor: 'start', weight: 600, fill: p.text })
    parts.forEach((c, i) => {
      const x = xs[i]
      body += wire([[x, top], [x, mid - 28]]) + wire([[x, mid + 28], [x, bot]])
      body += place(kindOf(c), x, mid, true, p)
      body += labelLines(x + 16, mid - 4, c.label || '', p, { anchor: 'start', size: 12 })
      if (i < n - 1) body += dot(x, top) + dot(x, bot)
      else body += dot(x, top) + dot(x, bot)
    })
    H = bot + 40
  } else {
    const maxBranches = Math.max(1, ...parts.map((c) => (Array.isArray(c.parallel) ? c.parallel.length : 1)))
    const bot = Math.max(214, top + (maxBranches - 1) * 54 + 52)
    const mid = (top + bot) / 2
    const n = parts.length
    // Left side: source. Right side and bottom: plain wire.
    body += wire([[L, mid - 28], [L, top], [R, top], [R, bot], [L, bot], [L, mid + 28]])
    body += place(srcKind, L, mid, true, p)
    body += T(L + 24, mid + 4, src.label || '', { size: 12.5, anchor: 'start', weight: 600, fill: p.text })
    parts.forEach((c, i) => {
      const cx = L + (280 * (i + 1)) / (n + 1)
      if (Array.isArray(c.parallel) && c.parallel.length) {
        const br = c.parallel.slice(0, 4)
        const lx = cx - 44
        const rx = cx + 44
        const lastY = top + (br.length - 1) * 54
        body += wire([[lx, top], [lx, lastY]]) + wire([[rx, top], [rx, lastY]])
        br.forEach((b, j) => {
          const y = top + j * 54
          body += wire([[lx, y], [cx - 28, y]]) + wire([[cx + 28, y], [rx, y]])
          body += place(kindOf(b), cx, y, false, p)
          body += j === 0 ? labelLines(cx, y - 24 - (String(b.label || '').includes(' = ') ? 15 : 0), b.label || '', p) : labelLines(cx, y + 26, b.label || '', p)
          if (j > 0) body += dot(lx, y) + dot(rx, y)
        })
        body += dot(lx, top) + dot(rx, top)
      } else {
        body += place(kindOf(c), cx, top, false, p)
        body += labelLines(cx, top - 24 - (String(c.label || '').includes(' = ') ? 15 : 0), c.label || '', p)
      }
    })
    H = bot + 40
  }
  return wrap(W, H, body)
}

// ---------------------------------------------------------------------------
// 5. Thin lens ray diagram
// ---------------------------------------------------------------------------
function lens(spec, p) {
  const f = num(spec.f, 0)
  const u = num(spec.u, 0)
  const h = num(spec.h, 3)
  if (!f || !(u > 0)) throw new Error('A lens diagram needs a focal length f and an object distance u > 0.')
  const unit = spec.unit ? String(spec.unit) : 'cm'
  const W = 380
  const H = 330
  const lx = 190
  const ay = 150
  const atFocus = Math.abs(1 / f - 1 / u) < 1e-9
  const v = atFocus ? Infinity : 1 / (1 / f - 1 / u)
  const hi = atFocus ? 0 : (-h * v) / u
  const extent = Math.max(u, atFocus ? 0 : Math.min(Math.abs(v), 4 * Math.abs(f) + u), 2.2 * Math.abs(f)) * 1.1
  const sx = 160 / extent
  const hmax = Math.max(Math.abs(h), atFocus ? 0 : Math.min(Math.abs(hi), 3 * Math.abs(h)))
  const sy = 68 / (hmax || 1)
  const X = (x) => lx + x * sx
  const Y = (y) => ay - y * sy
  const real = !atFocus && v > 0
  let body = ''
  const clipR = 362
  const clipL = 18
  // Extends a ray (point + direction in data units) to the image edge.
  const extend = (x0, y0, dx, dy) => {
    let t = (clipR - X(x0)) / (dx * sx)
    if (Math.abs(dy) > 1e-9) {
      const lim = dy > 0 ? (ay - 22) / sy : (ay - 236) / sy
      const t2 = (lim - y0) / dy
      if (t2 > 0 && t2 < t) t = t2
    }
    return [x0 + dx * t, y0 + dy * t]
  }

  body += line(clipL, ay, clipR, ay, p.sub, 1.2)
  // Lens
  const lh = Math.min(100, Math.max(Math.abs(h) * sy, Math.abs(hi) * sy) + 24)
  body += line(lx, ay - lh, lx, ay + lh, p.text, 2.2)
  if (f > 0) {
    body += `<polygon points="${lx},${ay - lh - 2} ${lx - 6},${ay - lh + 10} ${lx + 6},${ay - lh + 10}" fill="${p.text}"/><polygon points="${lx},${ay + lh + 2} ${lx - 6},${ay + lh - 10} ${lx + 6},${ay + lh - 10}" fill="${p.text}"/>`
  } else {
    body += `<polygon points="${lx},${ay - lh + 10} ${lx - 6},${ay - lh - 2} ${lx + 6},${ay - lh - 2}" fill="${p.text}"/><polygon points="${lx},${ay + lh - 10} ${lx - 6},${ay + lh + 2} ${lx + 6},${ay + lh + 2}" fill="${p.text}"/>`
  }
  // Focal points
  ;[[-f, 'F'], [f, 'F\u2032']].forEach(([x, t]) => {
    body += `<circle cx="${r1(X(x))}" cy="${ay}" r="3.2" fill="${p.sub}"/>`
    body += T(X(x), ay + 18, t, { size: 12, fill: p.sub })
  })

  const rayCol = p.accent
  const virtCol = p.accent
  // Object
  body += arrow(X(-u), ay, X(-u), Y(h), p.text, 2.6, 9)
  body += T(X(-u), h >= 0 ? Y(h) - 8 : Y(h) + 16, 'Object', { size: 12, fill: p.text, weight: 600 })

  // Ray 1: parallel to the axis, then through (or away from) the far focus.
  const s = Math.sign(f)
  const d1 = [s * f, -s * h]
  const end1 = extend(0, h, d1[0], d1[1])
  body += line(X(-u), Y(h), lx, Y(h), rayCol, 1.8)
  body += line(lx, Y(h), X(end1[0]), Y(end1[1]), rayCol, 1.8)
  // Ray 2: straight through the centre of the lens.
  const d2 = [u, -h]
  const end2 = extend(0, 0, d2[0], d2[1])
  body += line(X(-u), Y(h), X(end2[0]), Y(end2[1]), rayCol, 1.8)

  if (!atFocus) {
    if (v < 0) {
      // Virtual image: dotted back-extensions meet on the object side.
      body += line(lx, Y(h), X(v), Y(hi), virtCol, 1.4, '5 4')
      body += arrow(X(v), ay, X(v), Y(hi), virtCol, 2.2, 9)
    } else {
      body += arrow(X(v), ay, X(v), Y(hi), virtCol, 2.6, 9)
    }
    if (v < 0) body += T(X(v), ay + 34, 'Virtual image', { size: 12, fill: p.accent, weight: 600 })
    else body += T(X(v), ay - 9, 'Image', { size: 12, fill: p.accent, weight: 600 })
  } else {
    body += T(280, 40, 'Object at F: rays leave parallel, image at infinity', { size: 12, fill: p.accent })
  }

  const m = atFocus ? null : -v / u
  body += T(190, 262, `f = ${fmt(f)} ${unit} (${f > 0 ? 'converging' : 'diverging'})   u = ${fmt(u)} ${unit}`, { size: 13, weight: 600, fill: p.text })
  if (!atFocus) {
    body += T(190, 282, `v = ${fmt(v)} ${unit}   m = ${fmt(m)}   h\u2032 = ${fmt(hi)} ${unit}`, { size: 13, weight: 600, fill: p.accent })
    const nature = `${real ? 'Real' : 'Virtual'}, ${hi < 0 ? 'inverted' : 'upright'}, ${Math.abs(m) > 1.0001 ? 'magnified' : Math.abs(m) < 0.9999 ? 'diminished' : 'same size'}`
    body += T(190, 302, nature, { size: 12, fill: p.sub })
  }
  return wrap(W, H, body)
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------
// The AI sometimes leaves out "type". Work it out from the other keys.
export function inferType(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return ''
  const t = String(o.type || '').toLowerCase()
  if (t) return t
  if (o.curves || o.series || o.functions) return 'graph'
  if (o.parts || o.components || o.source) return 'circuit'
  if (o.supports || o.loads) return 'beam'
  if (Array.isArray(o.forces)) return 'fbd'
  if ('f' in o && 'u' in o) return 'lens'
  if ('h' in o && 'k' in o && 'l' in o) return 'miller_plane'
  return ''
}

export function renderDiagram(spec, p) {
  if (!spec || typeof spec !== 'object') throw new Error('Empty diagram.')
  switch (inferType(spec)) {
    case 'miller_plane':
    case 'miller':
      return miller(spec, p)
    case 'fbd':
    case 'free_body':
      return fbd(spec, p)
    case 'beam':
      return beam(spec, p)
    case 'circuit':
      return circuit(spec, p)
    case 'lens':
      return lens(spec, p)
    default:
      throw new Error(`Unknown diagram type "${spec.type}".`)
  }
}

// ---------------------------------------------------------------------------
// Free-form SVG written by the AI: cleaned with an allow-list before display.
// Colours come in as the words TEXT, MUTED and ACCENT and are swapped for the
// real theme colours here.
// ---------------------------------------------------------------------------
const OK_TAGS = new Set(['svg', 'g', 'path', 'line', 'polyline', 'polygon', 'rect', 'circle', 'ellipse', 'text', 'tspan', 'defs', 'marker', 'title', 'desc'])
const OK_ATTRS = new Set([
  'd', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height', 'points', 'fill', 'stroke', 'stroke-width',
  'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'fill-opacity', 'stroke-opacity', 'opacity', 'transform', 'text-anchor',
  'dominant-baseline', 'font-size', 'font-weight', 'font-style', 'dx', 'dy', 'viewBox', 'id', 'marker-end', 'marker-start', 'refX',
  'refY', 'markerWidth', 'markerHeight', 'orient', 'markerUnits', 'xmlns',
])

export function prepareFreeSvg(source, p) {
  let src = String(source || '').trim()
  if (!/^<svg[\s>]/i.test(src) || !/<\/svg>\s*$/i.test(src)) throw new Error('Incomplete drawing.')
  src = src
    .replace(/(["'])TEXT\1/g, `"${p.text}"`)
    .replace(/(["'])MUTED\1/g, `"${p.sub}"`)
    .replace(/(["'])ACCENT\1/g, `"${p.accent}"`)
    .replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-f]+;)/gi, '&amp;')
  if (!/xmlns=/.test(src.slice(0, 200))) src = src.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"')
  const doc = new DOMParser().parseFromString(src, 'image/svg+xml')
  if (doc.querySelector('parsererror')) throw new Error('Could not read the drawing.')
  const root = doc.documentElement
  const walk = (el) => {
    Array.from(el.children).forEach((child) => {
      if (!OK_TAGS.has(child.tagName.toLowerCase())) { child.remove(); return }
      walk(child)
    })
    Array.from(el.attributes).forEach((a) => {
      const name = a.name
      const val = a.value
      const bad =
        !OK_ATTRS.has(name) ||
        /javascript:|data:|expression\(/i.test(val) ||
        (/url\(/i.test(val) && !/^url\(#[\w-]+\)$/.test(val.trim())) ||
        (name === 'transform' && !/^[\w\s.,()\-+]*$/.test(val))
      if (bad) el.removeAttribute(name)
    })
  }
  walk(root)
  const vb = (root.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number)
  let width = 380
  let height = 300
  if (vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0) {
    width = vb[2]
    height = vb[3]
  } else {
    root.setAttribute('viewBox', `0 0 ${width} ${height}`)
  }
  root.setAttribute('width', '100%')
  root.removeAttribute('height')
  root.setAttribute('fill', p.text)
  root.setAttribute('font-family', FONT)
  return { svg: new XMLSerializer().serializeToString(root), width, height }
}
