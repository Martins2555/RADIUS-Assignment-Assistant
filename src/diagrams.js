// RADIUS diagram engine.
// The AI only supplies a small JSON spec (numbers and labels). Everything is
// drawn here in code, so the geometry is always exact. Every renderer returns
// { svg, width, height }. Colours come from the palette passed in, so diagrams
// match the light and dark themes and export cleanly as images.

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

export const DIAGRAM_TYPES = ['miller_plane', 'fbd', 'beam', 'circuit', 'lens', 'wave', 'projectile', 'mirror', 'sketch', 'flow']

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

function T(x, y, label, { size = 13, anchor = 'middle', weight = 400, fill, italic, halo } = {}) {
  return `<text x="${r1(x)}" y="${r1(y)}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}"${italic ? ' font-style="italic"' : ''}${halo ? ` stroke="${halo}" stroke-width="5" stroke-linejoin="round" paint-order="stroke"` : ''} fill="${fill}" font-family="${FONT}">${rich(label, size)}</text>`
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
      body += T(A[0], 316, `x = ${fr(h)}`, { size: 13, weight: 600, fill: p.accent, halo: p.bg })
    }
    if (k > 0) {
      const B = P(0, 1 / k, 0)
      body += `<circle cx="${r1(B[0])}" cy="${r1(B[1])}" r="4.5" fill="${p.accent}"/>`
      body += T(B[0] + 12, B[1] + 26, `y = ${fr(k)}`, { size: 13, weight: 600, fill: p.accent, anchor: 'start', halo: p.bg })
    }
    if (l > 0) {
      const C = P(0, 0, 1 / l)
      body += `<circle cx="${r1(C[0])}" cy="${r1(C[1])}" r="4.5" fill="${p.accent}"/>`
      body += line(C[0] - 6, C[1], C[0] - 34, C[1], p.sub, 0.8, '3 3')
      body += T(C[0] - 38, C[1] + 5, `z = ${fr(l)}`, { size: 13, weight: 600, fill: p.accent, anchor: 'end', halo: p.bg })
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
  const hGiven = spec.h !== undefined && spec.h !== null && spec.h !== ''
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
    body += T(190, 282, `v = ${fmt(v)} ${unit}   m = ${fmt(m)}${hGiven ? `   h\u2032 = ${fmt(hi)} ${unit}` : ''}`, { size: 13, weight: 600, fill: p.accent })
    const nature = `${real ? 'Real' : 'Virtual'}, ${hi < 0 ? 'inverted' : 'upright'}, ${Math.abs(m) > 1.0001 ? 'magnified' : Math.abs(m) < 0.9999 ? 'diminished' : 'same size'}`
    body += T(190, 302, nature, { size: 12, fill: p.sub })
  }
  return wrap(W, H, body)
}

// ---------------------------------------------------------------------------
// 6. Waves: transverse (crest, trough, amplitude, wavelength), longitudinal
//    (compressions and rarefactions) and standing waves (nodes and antinodes).
//    Every curve is computed point by point, so it is a true smooth sine curve,
//    and every label sits on the exact point it names.
// ---------------------------------------------------------------------------
function wave(spec, p) {
  const kindRaw = String(spec.kind || spec.wave || spec.waveType || 'transverse').toLowerCase()
  const kind = /long|compress|sound/.test(kindRaw) ? 'longitudinal' : /stand|station/.test(kindRaw) ? 'standing' : 'transverse'
  const unit = spec.unit ? String(spec.unit) : ''
  const hasA = spec.amplitude !== undefined && spec.amplitude !== null && spec.amplitude !== '' && Number.isFinite(Number(spec.amplitude))
  const hasL = spec.wavelength !== undefined && spec.wavelength !== null && spec.wavelength !== '' && Number.isFinite(Number(spec.wavelength))
  const aTxt = hasA ? `Amplitude (A = ${fmt(Number(spec.amplitude))}${unit ? ' ' + unit : ''})` : 'Amplitude (A)'
  const lTxt = hasL ? `Wavelength (\u03BB = ${fmt(Number(spec.wavelength))}${unit ? ' ' + unit : ''})` : 'Wavelength (\u03BB)'
  const show = Array.isArray(spec.show) ? spec.show.map((s) => String(s).toLowerCase()) : null
  const want = (name) => !show || show.some((s) => s.includes(name))
  const W = 380
  const left = 52
  const L = 300 // length of the wave in drawing units
  const title = spec.title ? String(spec.title) : ''
  const titleH = title ? 24 : 0
  let body = ''
  if (title) body += T(W / 2, 18, title, { size: 14, weight: 700, fill: p.text })

  if (kind === 'transverse') {
    const cycles = clamp(Math.round(num(spec.cycles, 2)), 2, 4)
    const A = 56
    const lam = L / cycles
    const y0 = titleH + 76 + A
    const H = y0 + A + 64
    // equilibrium (rest) line
    if (want('equilibrium') || want('rest')) {
      body += line(left - 6, y0, left + L + 10, y0, p.sub, 1.3, '6 4')
      body += T(left + 2, y0 + 15, 'Equilibrium', { size: 11, fill: p.sub, anchor: 'start', halo: p.bg })
    }
    // the curve: y = A sin(2 pi x / lambda), computed every pixel
    let d = ''
    for (let i = 0; i <= L; i++) {
      const x = left + i
      const y = y0 - A * Math.sin((2 * Math.PI * i) / lam)
      d += `${i ? 'L' : 'M'}${r1(x)} ${r1(y)}`
    }
    body += `<path d="${d}" fill="none" stroke="${p.accent}" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round"/>`
    const crest1 = left + lam / 4
    const crest2 = left + (5 * lam) / 4
    const trough1 = left + (3 * lam) / 4
    // crest and trough
    if (want('crest')) {
      body += `<circle cx="${r1(crest1)}" cy="${r1(y0 - A)}" r="4.2" fill="${p.accent}" stroke="${p.bg}" stroke-width="1.5"/>`
      body += T(crest1, y0 - A - 9, 'Crest', { size: 12.5, weight: 700, fill: p.text })
    }
    if (want('trough')) {
      body += `<circle cx="${r1(trough1)}" cy="${r1(y0 + A)}" r="4.2" fill="${p.accent}" stroke="${p.bg}" stroke-width="1.5"/>`
      body += T(trough1, y0 + A + 19, 'Trough', { size: 12.5, weight: 700, fill: p.text })
    }
    // amplitude: from the rest line to the crest level, at the left edge
    if (want('amplitude')) {
      const ax = left - 16
      body += line(ax, y0 - A, crest1 - 5, y0 - A, p.sub, 1, '3 3')
      body += arrow(ax, y0 - A / 2 + 0.01, ax, y0 - A, p.text, 1.6, 7)
      body += arrow(ax, y0 - A / 2 - 0.01, ax, y0, p.text, 1.6, 7)
      body += `<g transform="rotate(-90 ${ax - 9} ${r1(y0 - A / 2)})">${T(ax - 9, y0 - A / 2 + 4, aTxt, { size: 11.5, weight: 600, fill: p.text })}</g>`
    }
    // wavelength: crest to the next crest
    if (want('wavelength') && crest2 <= left + L + 1) {
      const wy = y0 - A - 34
      body += line(crest1, y0 - A - 16, crest1, wy - 5, p.sub, 1, '3 3')
      body += line(crest2, y0 - A - 4, crest2, wy - 5, p.sub, 1, '3 3')
      body += arrow(crest1 + (crest2 - crest1) / 2 + 0.01, wy, crest2, wy, p.text, 1.6, 7)
      body += arrow(crest1 + (crest2 - crest1) / 2 - 0.01, wy, crest1, wy, p.text, 1.6, 7)
      body += T((crest1 + crest2) / 2, wy - 7, lTxt, { size: 12, weight: 600, fill: p.text })
    }
    // direction of travel
    if (want('direction')) {
      const dy = H - 18
      body += arrow(left + L / 2 - 50, dy, left + L / 2 + 50, dy, p.sub, 2, 9)
      body += T(left + L / 2, dy - 7, 'Direction of wave travel', { size: 11, fill: p.sub })
    }
    return wrap(W, H, body)
  }

  if (kind === 'longitudinal') {
    const cycles = clamp(Math.round(num(spec.cycles, 3)), 2, 4)
    const lam = L / cycles
    const y0 = titleH + 90
    const half = 26
    const H = y0 + half + 78
    const a = lam * 0.12 // displacement amplitude of the particles (0.12 of a wavelength keeps the lines apart)
    const N = 70
    // particles: u is the rest position, the real position is u + a sin(2 pi u / lambda)
    for (let i = 0; i <= N; i++) {
      const u = (i / N) * L
      const x = left + u + a * Math.sin((2 * Math.PI * u) / lam)
      body += line(x, y0 - half, x, y0 + half, p.accent, 1.6)
    }
    // dense places (compressions) are at u = lambda/2, 3 lambda/2 ...; thin places (rarefactions) at u = lambda, 2 lambda ...
    const comp = []
    const rare = []
    for (let k = 0; k < cycles; k++) comp.push(left + (k + 0.5) * lam)
    for (let k = 1; k <= cycles; k++) if (k * lam < L - 6) rare.push(left + k * lam)
    if (want('compression')) comp.forEach((cx, i) => { if (i < 2 || comp.length <= 3) body += T(cx, y0 - half - 8, 'Compression', { size: 11.5, weight: 700, fill: p.text }) })
    if (want('rarefaction')) rare.forEach((rx, i) => { if (i < 2) body += T(rx, y0 + half + 17, 'Rarefaction', { size: 11.5, weight: 700, fill: p.text }) })
    if (want('wavelength') && comp.length >= 2) {
      const wy = y0 - half - 30
      const c1 = comp[0]
      const c2 = comp[1]
      body += line(c1, y0 - half - 20, c1, wy - 4, p.sub, 1, '3 3')
      body += line(c2, y0 - half - 20, c2, wy - 4, p.sub, 1, '3 3')
      body += arrow((c1 + c2) / 2 + 0.01, wy, c2, wy, p.text, 1.6, 7)
      body += arrow((c1 + c2) / 2 - 0.01, wy, c1, wy, p.text, 1.6, 7)
      body += T((c1 + c2) / 2, wy - 7, lTxt, { size: 12, weight: 600, fill: p.text })
    }
    if (want('direction')) {
      const dy = H - 34
      body += arrow(left + L / 2 - 50, dy, left + L / 2 + 50, dy, p.sub, 2, 9)
      body += T(left + L / 2, dy - 7, 'Direction of wave travel', { size: 11, fill: p.sub })
      body += T(left + L / 2, dy + 17, 'Particles vibrate back and forth, parallel to this', { size: 11, fill: p.sub })
    }
    return wrap(W, H, body)
  }

  // standing wave: nodes (no movement) and antinodes (largest movement)
  const loops = clamp(Math.round(num(spec.loops, num(spec.cycles, 3))), 2, 6)
  const A = 52
  const y0 = titleH + 74 + A
  const H = y0 + A + 62
  const lenLoop = L / loops
  let dUp = ''
  let dDown = ''
  for (let i = 0; i <= L; i++) {
    const s = Math.sin((Math.PI * loops * i) / L)
    dUp += `${i ? 'L' : 'M'}${r1(left + i)} ${r1(y0 - A * s)}`
    dDown += `${i ? 'L' : 'M'}${r1(left + i)} ${r1(y0 + A * s)}`
  }
  body += line(left - 6, y0, left + L + 6, y0, p.sub, 1.2, '6 4')
  body += `<path d="${dUp}" fill="none" stroke="${p.accent}" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round"/>`
  body += `<path d="${dDown}" fill="none" stroke="${p.accent}" stroke-width="2" stroke-dasharray="6 4" stroke-linejoin="round" stroke-linecap="round" opacity="0.75"/>`
  for (let k = 0; k <= loops; k++) {
    const nx = left + k * lenLoop
    body += `<circle cx="${r1(nx)}" cy="${r1(y0)}" r="3.8" fill="${p.bg}" stroke="${p.text}" stroke-width="1.8"/>`
  }
  if (want('node')) body += T(left - 9, y0 + 4, 'Node', { size: 12, weight: 700, fill: p.text, anchor: 'end', halo: p.bg })
  const antiX = left + 0.5 * lenLoop
  if (want('antinode')) {
    body += `<circle cx="${r1(antiX)}" cy="${r1(y0 - A)}" r="4.2" fill="${p.accent}" stroke="${p.bg}" stroke-width="1.5"/>`
    body += T(antiX, y0 - A - 9, 'Antinode', { size: 12, weight: 700, fill: p.text })
  }
  if (want('wavelength') && loops >= 2) {
    const wy = y0 - A - 34
    const x1 = left
    const x2 = left + 2 * lenLoop
    body += line(x1, y0 - 6, x1, wy - 5, p.sub, 1, '3 3')
    body += line(x2, y0 - 6, x2, wy - 5, p.sub, 1, '3 3')
    body += arrow((x1 + x2) / 2 + 0.01, wy, x2, wy, p.text, 1.6, 7)
    body += arrow((x1 + x2) / 2 - 0.01, wy, x1, wy, p.text, 1.6, 7)
    body += T((x1 + x2) / 2, wy - 7, hasL ? lTxt : 'Wavelength (\u03BB = 2 loops)', { size: 12, weight: 600, fill: p.text })
  }
  body += T(left + L / 2, H - 14, 'Solid and dashed curves: the two extreme positions of the string', { size: 11, fill: p.sub })
  return wrap(W, H, body)
}

// ---------------------------------------------------------------------------
// 7. Projectile motion: exact path, maximum height, range and time of flight
// ---------------------------------------------------------------------------
function projectile(spec, p) {
  const v0 = num(spec.v0, 0)
  const ang = clamp(num(spec.angle, 45), -80, 89)
  const g = num(spec.g, 9.8) || 9.8
  const h0 = Math.max(0, num(spec.h0, 0))
  const unit = spec.unit ? String(spec.unit) : 'm'
  if (!(v0 > 0)) throw new Error('A projectile diagram needs a launch speed v0 greater than 0.')
  const th = (ang * Math.PI) / 180
  const vx = v0 * Math.cos(th)
  const vy = v0 * Math.sin(th)
  const disc = vy * vy + 2 * g * h0
  if (disc < 0) throw new Error('This projectile never reaches the ground.')
  const Tf = (vy + Math.sqrt(disc)) / g
  if (!(Tf > 0)) throw new Error('This projectile never leaves the ground.')
  const R = vx * Tf
  const tp = vy > 0 ? vy / g : 0
  const Hm = h0 + (vy > 0 ? (vy * vy) / (2 * g) : 0)
  const W = 380
  const left = 44
  const pw = 296
  const titleH = spec.title ? 24 : 0
  const s = Math.min(pw / R, 140 / Math.max(Hm, 1e-9))
  const top = titleH + 50
  const groundY = top + Hm * s + 8
  const H = Math.round(groundY + 82)
  let body = ''
  if (spec.title) body += T(W / 2, 18, String(spec.title), { size: 14, weight: 700, fill: p.text })
  body += line(left - 14, groundY, left + R * s + 18, groundY, p.sub, 1.6)
  const ly = groundY - h0 * s
  if (h0 > 0) {
    body += line(left, ly, left, groundY, p.sub, 1.2, '4 3')
    body += T(left + 12, (ly + groundY) / 2 + 4, `h_0 = ${fmt(h0)} ${unit}`, { size: 11, fill: p.sub, anchor: 'start', halo: p.bg })
  }
  let d = ''
  const N = 180
  for (let i = 0; i <= N; i++) {
    const t = (Tf * i) / N
    const x = left + vx * t * s
    const y = groundY - (h0 + vy * t - 0.5 * g * t * t) * s
    d += `${i ? 'L' : 'M'}${r1(x)} ${r1(y)}`
  }
  body += `<path d="${d}" fill="none" stroke="${p.accent}" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round"/>`
  // launch velocity and angle
  const vl = 48
  const tx = left + vl * Math.cos(th)
  const ty = ly - vl * Math.sin(th)
  body += arrow(left, ly, tx, ty, p.text, 2.2, 9)
  body += T(left + 8, ly + (th > 0 ? 32 : -22), `v_0 = ${fmt(v0)} ${unit}/s`, { size: 12, weight: 600, fill: p.text, anchor: 'start', halo: p.bg })
  if (Math.abs(ang) > 0.5) {
    let a = ''
    for (let i = 0; i <= 30; i++) {
      const aa = (th * i) / 30
      a += `${i ? 'L' : 'M'}${r1(left + 28 * Math.cos(aa))} ${r1(ly - 28 * Math.sin(aa))}`
    }
    body += `<path d="${a}" fill="none" stroke="${p.sub}" stroke-width="1.4"/>`
    body += T(left + 40, ly + (th > 0 ? 13 : -4), `\u03B8 = ${fmt(ang)}\u00B0`, { size: 11.5, fill: p.sub, anchor: 'start', halo: p.bg })
  }
  // maximum height
  if (vy > 0) {
    const mxp = left + vx * tp * s
    const myp = groundY - Hm * s
    body += line(mxp, myp, mxp, groundY, p.sub, 1.2, '4 3')
    body += `<circle cx="${r1(mxp)}" cy="${r1(myp)}" r="4" fill="${p.accent}" stroke="${p.bg}" stroke-width="1.5"/>`
    body += T(mxp, myp - 11, `H = ${fmt(Hm)} ${unit}`, { size: 12, weight: 700, fill: p.text, halo: p.bg })
  }
  // landing point and range
  const lx = left + R * s
  body += `<circle cx="${r1(lx)}" cy="${r1(groundY)}" r="4" fill="${p.accent}" stroke="${p.bg}" stroke-width="1.5"/>`
  const ry = groundY + 22
  body += line(left, groundY + 4, left, ry + 5, p.sub, 1, '3 3')
  body += line(lx, groundY + 4, lx, ry + 5, p.sub, 1, '3 3')
  body += arrow((left + lx) / 2 + 0.01, ry, lx, ry, p.text, 1.6, 7)
  body += arrow((left + lx) / 2 - 0.01, ry, left, ry, p.text, 1.6, 7)
  body += T((left + lx) / 2, ry + 16, `Range R = ${fmt(R)} ${unit}`, { size: 12, weight: 600, fill: p.text })
  body += T(W / 2, H - 10, `Time of flight T = ${fmt(Tf)} s   (g = ${fmt(g)} ${unit}/s^2)`, { size: 12, fill: p.sub })
  return wrap(W, H, body)
}

// ---------------------------------------------------------------------------
// 8. Spherical mirror ray diagram (concave f > 0, convex f < 0)
// ---------------------------------------------------------------------------
function mirror(spec, p) {
  let f = num(spec.f, 0)
  const u = num(spec.u, 0)
  const h = num(spec.h, 3)
  const hGiven = spec.h !== undefined && spec.h !== null && spec.h !== ''
  if (/convex|diverg/.test(String(spec.kind || spec.mirror || spec.type || '')) && f > 0) f = -f
  if (!f || !(u > 0)) throw new Error('A mirror diagram needs a focal length f and an object distance u greater than 0.')
  const unit = spec.unit ? String(spec.unit) : 'cm'
  const W = 380
  const H = 330
  const mx = 250
  const ay = 150
  const atFocus = Math.abs(1 / f - 1 / u) < 1e-9
  const v = atFocus ? Infinity : 1 / (1 / f - 1 / u) // distance in front of the mirror (negative = behind it)
  const hi = atFocus ? 0 : (-h * v) / u
  const front = Math.max(u, !atFocus && v > 0 ? Math.min(v, 5 * Math.abs(f) + u) : 0, 2 * Math.abs(f)) * 1.1
  const behind = !atFocus && v < 0 ? Math.min(-v, 4 * Math.abs(f)) * 1.05 : f < 0 ? Math.abs(f) * 2.2 : 0
  const sx = Math.min(215 / front, behind > 0 ? 100 / behind : Infinity)
  const hmax = Math.max(Math.abs(h), atFocus ? 0 : Math.min(Math.abs(hi), 3 * Math.abs(h)))
  const sy = 62 / (hmax || 1)
  const X = (dd) => mx - dd * sx
  const Y = (yy) => ay - yy * sy
  const yLim = 122 / sy
  const real = !atFocus && v > 0
  const bulgePx = f > 0 ? 15 : -15
  // x on the page where a ray at height py meets the curved mirror
  const hitX = (py) => mx + bulgePx * Math.max(0, 1 - ((py - ay) / 82) * ((py - ay) / 82))
  const XD = (dd, py) => (dd === 0 ? hitX(py) : X(dd))
  let body = ''
  body += line(X(front), ay, mx + Math.max(behind, 40) * sx > 366 ? 366 : mx + Math.max(behind, 40) * sx, ay, p.sub, 1.2)
  // the mirror: a smooth curve with hatching behind it
  const bulge = f > 0 ? 15 : -15
  let md = `M${mx} ${ay - 82} Q${mx + 2 * bulge} ${ay} ${mx} ${ay + 82}`
  body += `<path d="${md}" fill="none" stroke="${p.text}" stroke-width="3" stroke-linecap="round"/>`
  for (let i = -7; i <= 7; i++) {
    const tt = (i / 7.5 + 1) / 2
    const bx = (1 - tt) * (1 - tt) * mx + 2 * (1 - tt) * tt * (mx + 2 * bulge) + tt * tt * mx
    const by = (1 - tt) * (1 - tt) * (ay - 82) + 2 * (1 - tt) * tt * ay + tt * tt * (ay + 82)
    body += line(bx, by, bx + 9, by + 7, p.sub, 1)
  }
  // focal point and centre of curvature
  ;[[f, 'F'], [2 * f, 'C']].forEach(([dd, nm]) => {
    const px = X(dd)
    if (px < 14 || px > 366) return
    body += `<circle cx="${r1(px)}" cy="${ay}" r="3" fill="${p.sub}"/>`
    body += T(px, ay + 17, nm, { size: 12, weight: 600, fill: p.sub, halo: p.bg })
  })
  // object
  body += arrow(X(u), ay, X(u), Y(h), p.text, 2.6, 9)
  body += T(X(u), ay + 32, 'Object', { size: 11.5, fill: p.text })
  // rays: a straight line y = y0 + m d, drawn only where it stays on the page
  const clip = (y0, m, a, b) => {
    let lo = Math.min(a, b)
    let hi2 = Math.max(a, b)
    if (Math.abs(m) < 1e-12) return Math.abs(y0) <= yLim ? [lo, hi2] : null
    const d1 = (-yLim - y0) / m
    const d2 = (yLim - y0) / m
    lo = Math.max(lo, Math.min(d1, d2))
    hi2 = Math.min(hi2, Math.max(d1, d2))
    return lo < hi2 ? [lo, hi2] : null
  }
  const draw = (y0, m, a, b, color, dash) => {
    const c = clip(y0, m, a, b)
    if (!c) return ''
    return line(XD(c[0], Y(y0 + m * c[0])), Y(y0 + m * c[0]), XD(c[1], Y(y0 + m * c[1])), Y(y0 + m * c[1]), color, 1.8, dash)
  }
  const reach = front * 0.98
  const back = !atFocus && v < 0 ? v : f < 0 ? f : 0
  const rays = []
  rays.push({ inc: [[u, h], [0, h]], y0: h, m: -h / f }) // parallel ray, reflected through F
  if (!atFocus) rays.push({ inc: [[u, h], [0, (h * -f) / (u - f)]], y0: (h * -f) / (u - f), m: 0 }) // ray through F, reflected parallel
  rays.push({ inc: [[u, h], [0, 0]], y0: 0, m: -h / u }) // ray to the pole
  rays.forEach((r) => {
    body += line(X(r.inc[0][0]), Y(r.inc[0][1]), hitX(Y(r.inc[1][1])), Y(r.inc[1][1]), p.text, 1.8)
    body += draw(r.y0, r.m, 0, reach, p.accent)
    if (back < 0) body += draw(r.y0, r.m, back, 0, p.accent, '5 4')
  })
  // image
  if (!atFocus && Math.abs(hi) > 1e-9 && Math.abs(v) < 1e5) {
    const ix = X(v)
    if (ix > 8 && ix < 372) {
      if (real) body += arrow(ix, ay, ix, Y(hi), p.accent, 2.6, 9)
      else {
        body += line(ix, ay, ix, Y(hi) + (hi > 0 ? 7 : -7), p.accent, 2.6, '5 3')
        body += arrow(ix, Y(hi) + (hi > 0 ? 8 : -8), ix, Y(hi), p.accent, 2.6, 9)
      }
      body += T(Math.min(ix, 346), hi > 0 ? Y(hi) - 8 : Y(hi) + 16, 'Image', { size: 11.5, weight: 600, fill: p.accent, halo: p.bg })
    }
  } else if (atFocus) body += T(150, 40, 'Object at F: reflected rays are parallel, image at infinity', { size: 12, fill: p.accent })
  body += T(190, 262, `f = ${fmt(f)} ${unit} (${f > 0 ? 'concave' : 'convex'})   u = ${fmt(u)} ${unit}`, { size: 13, weight: 600, fill: p.text })
  if (!atFocus) {
    const m = -v / u
    body += T(190, 282, `v = ${fmt(v)} ${unit}   m = ${fmt(m)}${hGiven ? `   h\u2032 = ${fmt(hi)} ${unit}` : ''}`, { size: 13, weight: 600, fill: p.accent })
    body += T(190, 302, `${real ? 'Real' : 'Virtual'}, ${hi < 0 ? 'inverted' : 'upright'}, ${Math.abs(m) > 1.0001 ? 'magnified' : Math.abs(m) < 0.9999 ? 'diminished' : 'same size'}`, { size: 12, fill: p.sub })
  }
  return wrap(W, H, body)
}

// ---------------------------------------------------------------------------
// 9. Sketch: a general drawing from simple parts (smooth curves, arrows, arcs,
//    shapes, dimension lines, labels). Works for any subject. Every curve is
//    smoothed in code, so a curved line is always a clean, continuous curve.
// ---------------------------------------------------------------------------
function smoothPath(pts, closed) {
  const n = pts.length
  if (n < 2) return ''
  if (n === 2) return `M${r1(pts[0][0])} ${r1(pts[0][1])}L${r1(pts[1][0])} ${r1(pts[1][1])}`
  const at = (i) => (closed ? pts[((i % n) + n) % n] : pts[clamp(i, 0, n - 1)])
  let d = `M${r1(pts[0][0])} ${r1(pts[0][1])}`
  const segs = closed ? n : n - 1
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1)
    const p1 = at(i)
    const p2 = at(i + 1)
    const p3 = at(i + 2)
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += `C${r1(c1[0])} ${r1(c1[1])} ${r1(c2[0])} ${r1(c2[1])} ${r1(p2[0])} ${r1(p2[1])}`
  }
  return d + (closed ? 'Z' : '')
}

function sketch(spec, p) {
  const W = 380
  const H = clamp(Math.round(num(spec.height, 300)), 120, 460)
  const items = Array.isArray(spec.items) ? spec.items.slice(0, 160) : []
  const col = (c, dflt) => {
    const k = String(c || dflt || 'text').toLowerCase()
    return k === 'accent' ? p.accent : k === 'muted' || k === 'sub' || k === 'grey' || k === 'gray' ? p.sub : k === 'none' ? 'none' : p.text
  }
  const pt = (a) => (Array.isArray(a) && a.length >= 2 && Number.isFinite(Number(a[0])) && Number.isFinite(Number(a[1])) ? [clamp(Number(a[0]), -30, W + 30), clamp(Number(a[1]), -30, H + 30)] : null)
  const pts = (a) => (Array.isArray(a) ? a.map(pt).filter(Boolean).slice(0, 80) : [])
  const wd = (it, d) => clamp(num(it.w, d), 0.5, 6)
  const dash = (it) => (it.dashed ? ' stroke-dasharray="6 4"' : '')
  let body = ''
  let drawn = 0
  if (spec.title) body += T(W / 2, 18, String(spec.title), { size: 14, weight: 700, fill: p.text })
  items.forEach((it) => {
    if (!it || typeof it !== 'object') return
    const k = String(it.k || it.kind || it.type || '').toLowerCase()
    const c = col(it.color, 'text')
    const fill = col(it.fill, 'none')
    const fo = it.fill && it.fill !== 'none' && it.opacity === undefined ? ' fill-opacity="0.22"' : it.opacity !== undefined ? ` fill-opacity="${clamp(num(it.opacity, 1), 0, 1)}"` : ''
    if (k === 'curve' || k === 'spline') {
      const a = pts(it.pts || it.points)
      if (a.length < 2) return
      const closed = !!it.closed
      body += `<path d="${smoothPath(a, closed)}" fill="${closed ? fill : 'none'}"${closed ? fo : ''} stroke="${c}" stroke-width="${wd(it, 2.4)}" stroke-linejoin="round" stroke-linecap="round"${dash(it)}/>`
      const ar = String(it.arrow || '')
      if (!closed && (ar === 'end' || ar === 'both')) {
        const e = a[a.length - 1]
        const b = a[a.length - 2]
        const L = Math.hypot(e[0] - b[0], e[1] - b[1]) || 1
        body += arrow(e[0] - ((e[0] - b[0]) / L) * 3, e[1] - ((e[1] - b[1]) / L) * 3, e[0], e[1], c, wd(it, 2.4), 9)
      }
      if (!closed && (ar === 'start' || ar === 'both')) {
        const e = a[0]
        const b = a[1]
        const L = Math.hypot(e[0] - b[0], e[1] - b[1]) || 1
        body += arrow(e[0] - ((e[0] - b[0]) / L) * 3, e[1] - ((e[1] - b[1]) / L) * 3, e[0], e[1], c, wd(it, 2.4), 9)
      }
    } else if (k === 'line' || k === 'arrow') {
      const a = pt(it.from)
      const b = pt(it.to)
      if (!a || !b) return
      const ar = String(it.arrow || (k === 'arrow' ? 'end' : ''))
      if (ar === 'end' || ar === 'both') body += arrow(a[0], a[1], b[0], b[1], c, wd(it, 2.2), 9)
      else body += line(a[0], a[1], b[0], b[1], c, wd(it, 2), it.dashed ? '6 4' : undefined)
      if (ar === 'start' || ar === 'both') body += arrow(b[0], b[1], a[0], a[1], c, wd(it, 2.2), 9)
    } else if (k === 'poly' || k === 'polygon' || k === 'polyline') {
      const a = pts(it.pts || it.points)
      if (a.length < 2) return
      const closed = it.closed !== false && k !== 'polyline'
      body += `<path d="M${a.map((q) => `${r1(q[0])} ${r1(q[1])}`).join('L')}${closed ? 'Z' : ''}" fill="${closed ? fill : 'none'}"${closed ? fo : ''} stroke="${c}" stroke-width="${wd(it, 2)}" stroke-linejoin="round"${dash(it)}/>`
    } else if (k === 'circle') {
      const a = pt(it.c || it.at)
      const r = clamp(num(it.r, 20), 1, 300)
      if (!a) return
      body += `<circle cx="${r1(a[0])}" cy="${r1(a[1])}" r="${r1(r)}" fill="${fill}"${fo} stroke="${c}" stroke-width="${wd(it, 2)}"${dash(it)}/>`
    } else if (k === 'ellipse') {
      const a = pt(it.c || it.at)
      if (!a) return
      const rot = num(it.rot, 0)
      body += `<ellipse cx="${r1(a[0])}" cy="${r1(a[1])}" rx="${r1(clamp(num(it.rx, 30), 1, 300))}" ry="${r1(clamp(num(it.ry, 18), 1, 300))}"${rot ? ` transform="rotate(${r1(rot)} ${r1(a[0])} ${r1(a[1])})"` : ''} fill="${fill}"${fo} stroke="${c}" stroke-width="${wd(it, 2)}"${dash(it)}/>`
    } else if (k === 'rect') {
      const x = clamp(num(it.x, 0), -30, W + 30)
      const y = clamp(num(it.y, 0), -30, H + 30)
      body += `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(clamp(num(it.w, 40), 1, W + 60))}" height="${r1(clamp(num(it.h, 30), 1, H + 60))}" rx="${r1(clamp(num(it.r, 0), 0, 60))}" fill="${fill}"${fo} stroke="${c}" stroke-width="${wd(it, 2)}"${dash(it)}/>`
    } else if (k === 'arc') {
      const a = pt(it.c || it.at)
      if (!a) return
      const r = clamp(num(it.r, 24), 2, 300)
      const a0 = num(it.from, 0)
      const a1 = num(it.to, 90)
      let d = ''
      const steps = 60
      for (let i = 0; i <= steps; i++) {
        const aa = ((a0 + ((a1 - a0) * i) / steps) * Math.PI) / 180
        d += `${i ? 'L' : 'M'}${r1(a[0] + r * Math.cos(aa))} ${r1(a[1] - r * Math.sin(aa))}`
      }
      body += `<path d="${d}" fill="none" stroke="${c}" stroke-width="${wd(it, 1.8)}" stroke-linecap="round"${dash(it)}/>`
      if (it.arrow) {
        const aa = (a1 * Math.PI) / 180
        const dir = a1 >= a0 ? 1 : -1
        const ex = a[0] + r * Math.cos(aa)
        const ey = a[1] - r * Math.sin(aa)
        body += arrow(ex + dir * Math.sin(aa) * 4, ey + dir * Math.cos(aa) * 4, ex, ey, c, wd(it, 1.8), 8)
      }
    } else if (k === 'dim' || k === 'dimension') {
      const a = pt(it.from)
      const b = pt(it.to)
      if (!a || !b) return
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
      const off = clamp(num(it.offset, 0), -80, 80)
      const nx = (-(b[1] - a[1]) / L) * off
      const ny = ((b[0] - a[0]) / L) * off
      const a2 = [a[0] + nx, a[1] + ny]
      const b2 = [b[0] + nx, b[1] + ny]
      if (off) {
        body += line(a[0], a[1], a2[0], a2[1], p.sub, 1, '3 3')
        body += line(b[0], b[1], b2[0], b2[1], p.sub, 1, '3 3')
      }
      const mid = [(a2[0] + b2[0]) / 2, (a2[1] + b2[1]) / 2]
      body += arrow(mid[0] + 0.01 * (b2[0] - a2[0]) / L, mid[1] + 0.01 * (b2[1] - a2[1]) / L, b2[0], b2[1], c, 1.6, 7)
      body += arrow(mid[0] - 0.01 * (b2[0] - a2[0]) / L, mid[1] - 0.01 * (b2[1] - a2[1]) / L, a2[0], a2[1], c, 1.6, 7)
      if (it.label) body += T(mid[0], mid[1] - 6, String(it.label), { size: num(it.size, 12), weight: 600, fill: c, halo: p.bg })
    } else if (k === 'text' || k === 'label') {
      const a = pt(it.at || it.pos)
      if (!a || it.text === undefined) return
      const anchor = ['start', 'middle', 'end'].includes(String(it.anchor)) ? String(it.anchor) : 'middle'
      const t = T(a[0], a[1], String(it.text).slice(0, 80), { size: clamp(num(it.size, 12), 9, 24), anchor, weight: it.bold ? 700 : 400, fill: col(it.color, 'text'), italic: !!it.italic, halo: p.bg })
      const rot = num(it.rot, 0)
      body += rot ? `<g transform="rotate(${r1(-rot)} ${r1(a[0])} ${r1(a[1])})">${t}</g>` : t
    } else return
    drawn++
  })
  if (!drawn) throw new Error('The sketch has nothing to draw. Give it items such as curves, lines, circles and text.')
  return wrap(W, H, body)
}

// ---------------------------------------------------------------------------
// 10. Flowchart: boxes are placed top to bottom, arrows and loops are routed here
// ---------------------------------------------------------------------------
function wrapWords(text, max) {
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean)
  const lines = []
  let cur = ''
  words.forEach((w) => {
    if (cur && (cur + ' ' + w).length > max) { lines.push(cur); cur = w } else cur = cur ? cur + ' ' + w : w
  })
  if (cur) lines.push(cur)
  return lines.slice(0, 4)
}

function flow(spec, p) {
  const raw = Array.isArray(spec.nodes) ? spec.nodes.slice(0, 16) : []
  if (raw.length < 2) throw new Error('A flowchart needs at least 2 steps in "nodes".')
  const W = 380
  const cx = 150
  const titleH = spec.title ? 26 : 0
  const nodes = raw.map((n, i) => {
    const o = typeof n === 'string' ? { text: n } : n || {}
    let kind = String(o.kind || o.shape || '').toLowerCase()
    if (!['start', 'end', 'process', 'decision', 'io'].includes(kind)) kind = i === 0 ? 'start' : i === raw.length - 1 ? 'end' : /\?\s*$/.test(String(o.text || '')) ? 'decision' : 'process'
    const lines = wrapWords(o.text ?? o.label ?? '', kind === 'decision' ? 15 : 22)
    const hgt = kind === 'decision' ? Math.max(64, 40 + lines.length * 15) : Math.max(38, 18 + lines.length * 15)
    const wid = kind === 'decision' ? 176 : kind === 'io' ? 170 : kind === 'process' ? 156 : 130
    return { id: o.id !== undefined ? String(o.id) : String(i + 1), kind, lines, h: hgt, w: wid }
  })
  const idx = (ref) => {
    const byId = nodes.findIndex((n) => n.id === String(ref))
    if (byId >= 0) return byId
    const k = Number(ref)
    return Number.isInteger(k) && k >= 1 && k <= nodes.length ? k - 1 : -1
  }
  let edges = []
  if (Array.isArray(spec.edges) && spec.edges.length) {
    spec.edges.slice(0, 30).forEach((e) => {
      const a = idx(e && e.from)
      const b = idx(e && e.to)
      if (a >= 0 && b >= 0 && a !== b) edges.push({ a, b, label: e.label ? String(e.label).slice(0, 12) : '' })
    })
  }
  if (!edges.length) for (let i = 0; i < nodes.length - 1; i++) edges.push({ a: i, b: i + 1, label: nodes[i].kind === 'decision' ? 'Yes' : '' })
  let y = titleH + 14
  nodes.forEach((n) => { n.y = y + n.h / 2; y += n.h + 34 })
  const H = y - 34 + 24
  let body = ''
  if (spec.title) body += T(W / 2, 18, String(spec.title), { size: 14, weight: 700, fill: p.text })
  nodes.forEach((n) => {
    const x = cx - n.w / 2
    const yy = n.y - n.h / 2
    const common = `fill="${p.bg}" stroke="${n.kind === 'decision' ? p.accent : p.text}" stroke-width="2"`
    if (n.kind === 'decision') body += `<polygon points="${cx},${r1(yy)} ${r1(cx + n.w / 2)},${r1(n.y)} ${cx},${r1(yy + n.h)} ${r1(cx - n.w / 2)},${r1(n.y)}" ${common} stroke-linejoin="round"/>`
    else if (n.kind === 'io') body += `<polygon points="${r1(x + 14)},${r1(yy)} ${r1(x + n.w)},${r1(yy)} ${r1(x + n.w - 14)},${r1(yy + n.h)} ${r1(x)},${r1(yy + n.h)}" ${common} stroke-linejoin="round"/>`
    else body += `<rect x="${r1(x)}" y="${r1(yy)}" width="${n.w}" height="${n.h}" rx="${n.kind === 'process' ? 5 : n.h / 2}" ${common}/>`
    n.lines.forEach((ln, i) => { body += T(cx, n.y - ((n.lines.length - 1) * 15) / 2 + i * 15 + 4.5, ln, { size: 12.5, weight: n.kind === 'start' || n.kind === 'end' ? 700 : 500, fill: p.text }) })
  })
  const maxHalf = Math.max(...nodes.map((n) => n.w / 2))
  let lane = 0
  edges.forEach((e) => {
    const A = nodes[e.a]
    const B = nodes[e.b]
    if (e.b === e.a + 1) {
      body += arrow(cx, A.y + A.h / 2, cx, B.y - B.h / 2, p.text, 1.8, 8)
      if (e.label) body += T(cx + 8, (A.y + A.h / 2 + B.y - B.h / 2) / 2 + 4, e.label, { size: 11.5, weight: 700, fill: p.accent, anchor: 'start', halo: p.bg })
    } else {
      const lx = cx + maxHalf + 18 + lane * 16
      lane++
      const sx0 = cx + A.w / 2
      const ex = cx + B.w / 2
      body += `<path d="M${r1(sx0)} ${r1(A.y)} H${r1(lx)} V${r1(B.y)} H${r1(ex + 8)}" fill="none" stroke="${p.text}" stroke-width="1.8" stroke-linejoin="round"/>`
      body += arrow(ex + 12, B.y, ex, B.y, p.text, 1.8, 8)
      if (e.label) body += T(sx0 + 6, A.y - 6, e.label, { size: 11.5, weight: 700, fill: p.accent, anchor: 'start', halo: p.bg })
    }
  })
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
  if ('v0' in o && 'angle' in o) return 'projectile'
  if (Array.isArray(o.nodes)) return 'flow'
  if (Array.isArray(o.items)) return 'sketch'
  if ('wavelength' in o || 'amplitude' in o || 'loops' in o || (o.cycles !== undefined && o.kind !== undefined)) return 'wave'
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
    case 'wave':
    case 'waves':
      return wave(spec, p)
    case 'projectile':
      return projectile(spec, p)
    case 'mirror':
      return mirror(spec, p)
    case 'sketch':
      return sketch(spec, p)
    case 'flow':
      return flow(spec, p)
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
