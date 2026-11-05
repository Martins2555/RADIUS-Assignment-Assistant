// RADIUS graph engine.
// The AI only supplies equations or data. The maths (evaluation, intercepts,
// turning points, axes, scaling) is all done here, so graphs are exact.
// No eval() is used: equations go through a small parser of our own.

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

// ---------------------------------------------------------------------------
// Expression parser
// ---------------------------------------------------------------------------
const FUNCS = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs,
  ln: Math.log, log: Math.log10, log10: Math.log10, log2: Math.log2, exp: Math.exp,
  floor: Math.floor, ceil: Math.ceil, sign: Math.sign, round: Math.round,
  sec: (v) => 1 / Math.cos(v), csc: (v) => 1 / Math.sin(v), cot: (v) => 1 / Math.tan(v),
}
const CONSTS = { pi: Math.PI, e: Math.E }

// x^2 -> x\u00B2, x^-1 -> x\u207B\u00B9 (titles and legends read better with real superscripts)
const SUP = { '0': '\u2070', '1': '\u00B9', '2': '\u00B2', '3': '\u00B3', '4': '\u2074', '5': '\u2075', '6': '\u2076', '7': '\u2077', '8': '\u2078', '9': '\u2079', '-': '\u207B' }
const prettyPow = (t) => String(t).replace(/\^\(?(-?\d{1,2})\)?/g, (m, d) => [...d].map((c) => SUP[c] || c).join(''))

function tokenize(src, vname) {
  const s = String(src)
    .replace(/[\u2212\u2013\u2014]/g, '-')
    .replace(/[\u00D7\u00B7\u22C5]/g, '*')
    .replace(/\u00F7/g, '/')
    .replace(/\u03C0/g, 'pi')
    .replace(/\u221A/g, 'sqrt')
    .replace(/\u00B2/g, '^2')
    .replace(/\u00B3/g, '^3')
    .replace(/\*\*/g, '^')
    .replace(/\s+/g, ' ')
    .trim()
  const out = []
  let i = 0
  while (i < s.length) {
    const ch = s[i]
    if (ch === ' ') { i++; continue }
    const numM = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+(?![a-z(]))?/i.exec(s.slice(i))
    if (numM && /[\d.]/.test(ch)) {
      out.push({ t: 'num', v: parseFloat(numM[0]) })
      i += numM[0].length
      continue
    }
    const idM = /^[a-z_][a-z0-9_]*/i.exec(s.slice(i))
    if (idM) {
      const name = idM[0].toLowerCase()
      if (FUNCS[name] || name in CONSTS || name === vname) {
        out.push({ t: 'id', v: name })
      } else if ([...name].every((c2) => c2 === vname || c2 in CONSTS)) {
        // Things like "xe" are read as x * e.
        ;[...name].forEach((c2) => out.push({ t: 'id', v: c2 }))
      } else {
        throw new Error(`Unknown name "${idM[0]}"`)
      }
      i += idM[0].length
      continue
    }
    if ('+-*/^(),'.includes(ch)) {
      out.push({ t: 'op', v: ch })
      i++
      continue
    }
    throw new Error(`Unexpected "${ch}"`)
  }
  return out
}

export function compileExpr(src, vname = 'x') {
  const toks = tokenize(src, vname)
  if (!toks.length) throw new Error('Empty equation')
  let pos = 0
  const peek = () => toks[pos]
  const isOp = (v) => peek() && peek().t === 'op' && peek().v === v
  const startsOperand = () => {
    const k = peek()
    return !!k && (k.t === 'num' || k.t === 'id' || (k.t === 'op' && k.v === '('))
  }

  function parseExpr() {
    let left = parseTerm()
    while (isOp('+') || isOp('-')) {
      const op = toks[pos++].v
      const right = parseTerm()
      const l = left
      left = op === '+' ? (a) => l(a) + right(a) : (a) => l(a) - right(a)
    }
    return left
  }
  function parseTerm() {
    let left = parseUnary()
    for (;;) {
      if (isOp('*') || isOp('/')) {
        const op = toks[pos++].v
        const right = parseUnary()
        const l = left
        left = op === '*' ? (a) => l(a) * right(a) : (a) => l(a) / right(a)
      } else if (startsOperand()) {
        const right = parseUnary()
        const l = left
        left = (a) => l(a) * right(a)
      } else break
    }
    return left
  }
  function parseUnary() {
    if (isOp('-')) { pos++; const v = parseUnary(); return (a) => -v(a) }
    if (isOp('+')) { pos++; return parseUnary() }
    return parsePower()
  }
  function parsePower() {
    const base = parsePrimary()
    if (isOp('^')) {
      pos++
      const ex = parseUnary()
      return (a) => Math.pow(base(a), ex(a))
    }
    return base
  }
  function parsePrimary() {
    const k = toks[pos++]
    if (!k) throw new Error('Equation ends too early')
    if (k.t === 'num') { const v = k.v; return () => v }
    if (k.t === 'op' && k.v === '(') {
      const inner = parseExpr()
      if (!isOp(')')) throw new Error('Missing )')
      pos++
      return inner
    }
    if (k.t === 'id') {
      if (k.v === vname) return (a) => a
      if (k.v in CONSTS) { const v = CONSTS[k.v]; return () => v }
      const fn = FUNCS[k.v]
      let power = null
      if (isOp('^')) { pos++; power = parsePrimary() }
      let arg
      if (isOp('(')) {
        pos++
        arg = parseExpr()
        if (!isOp(')')) throw new Error('Missing )')
        pos++
      } else {
        arg = parsePower()
      }
      if (power) return (a) => Math.pow(fn(arg(a)), power(a))
      return (a) => fn(arg(a))
    }
    throw new Error(`Unexpected "${k.v}"`)
  }

  const f = parseExpr()
  if (pos < toks.length) throw new Error('Could not read the whole equation')
  return f
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const r1 = (n) => Math.round(n * 10) / 10
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const isNum = (v) => typeof v === 'number' && Number.isFinite(v)

function fmtVal(v) {
  if (!Number.isFinite(v)) return '?'
  if (Math.abs(v) < 1e-9) return '0'
  const a = Math.abs(v)
  if (a >= 1e6 || a < 1e-4) return Number(v.toPrecision(3)).toExponential().replace('e+', 'e')
  return String(Number(v.toPrecision(4)))
}

function niceStep(range, target = 6) {
  const raw = range / target
  const pow = Math.pow(10, Math.floor(Math.log10(raw)))
  const frac = raw / pow
  const nice = frac < 1.5 ? 1 : frac < 3.5 ? 2 : frac < 7.5 ? 5 : 10
  return nice * pow
}

function tickLabel(v, step) {
  if (Math.abs(v) < step * 1e-9) return '0'
  const dec = Math.max(0, -Math.floor(Math.log10(step) + 1e-9))
  const a = Math.abs(v)
  if (a >= 1e6 || (a < 1e-3 && a > 0)) return Number(v.toPrecision(3)).toExponential().replace('e+', 'e')
  return v.toFixed(Math.min(dec, 6))
}

const CURVE_COLORS = (p) => [p.accent, '#4aa3ff', '#e5645b', '#e8a33d', '#a678f5', '#2fbf9b']

let clipCounter = 0

// ---------------------------------------------------------------------------
// Spec reading
// Nothing is dropped quietly: everything that cannot be drawn is listed in
// `problems` (for the server, which asks the model to fix it) and, when the
// student asked for it, in `notes` (shown under the graph).
// ---------------------------------------------------------------------------
const KNOWN_KEYS = new Set(['type', 'title', 'caption', 'subtitle', 'xlabel', 'ylabel', 'xmin', 'xmax', 'ymin', 'ymax', 'xstep', 'ystep', 'equal', 'markers', 'legend', 'grid', 'curves', 'functions', 'series', 'points', 'vlines', 'hlines', 'lines', 'expect'])
const LIMITS = { curves: 6, series: 8, seriesPoints: 1500, points: 40, lines: 6, guides: 8 }
const num = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN)
const lc = (v) => String(v ?? '').trim().toLowerCase()

const NAMED_COLORS = (p) => ({ accent: p.accent, green: '#2fbf9b', blue: '#4aa3ff', red: '#e5645b', amber: '#e8a33d', orange: '#e8a33d', purple: '#a678f5', black: p.text, grey: p.sub, gray: p.sub })
function pickColor(raw, fallback, p) {
  if (typeof raw !== 'string') return fallback
  const k = raw.trim().toLowerCase()
  const named = NAMED_COLORS(p)[k]
  if (named) return named
  if (/^#[0-9a-f]{3,8}$/.test(k) || /^[a-z]{3,20}$/.test(k)) return k
  return fallback
}

function fillLabel(label, x, y, slope) {
  return String(label ?? '')
    .replace(/\{x\}/g, isNum(x) ? fmtVal(x) : '')
    .replace(/\{y\}/g, isNum(y) ? fmtVal(y) : '')
    .replace(/\{slope(?:\/([0-9.]+))?\}/g, (m, d) => (isNum(slope) ? fmtVal(slope / (d ? Number(d) : 1)) : ''))
}

function readSpec(spec) {
  const notes = []
  const problems = []
  const fixes = []
  const curves = []
  const list = Array.isArray(spec.curves) ? spec.curves : Array.isArray(spec.functions) ? spec.functions : []
  if (list.length > LIMITS.curves) problems.push(`Only ${LIMITS.curves} curves can be drawn, but ${list.length} were given.`)
  list.slice(0, LIMITS.curves).forEach((c, i) => {
    try {
      if (c && c.param) {
        const fx = compileExpr(c.param.x, 't')
        const fy = compileExpr(c.param.y, 't')
        const t0 = isNum(Number(c.param.t?.[0])) ? Number(c.param.t[0]) : 0
        const t1 = isNum(Number(c.param.t?.[1])) ? Number(c.param.t[1]) : 2 * Math.PI
        curves.push({ param: { fx, fy, t0, t1 }, label: c.label || '', dashed: !!c.dashed, color: c.color })
      } else if (c && (c.expr || c.y)) {
        const src = String(c.expr || c.y).replace(/^\s*y\s*=\s*/i, '')
        const dom = Array.isArray(c.domain) && c.domain.length === 2 ? [Number(c.domain[0]), Number(c.domain[1])] : null
        curves.push({ f: compileExpr(src, 'x'), label: c.label || '', dashed: !!c.dashed, color: c.color, domain: dom && dom.every(isNum) ? dom : null })
      } else {
        problems.push(`Curve ${i + 1} has no "expr" and no "param", so it cannot be drawn.`)
      }
    } catch (e) {
      notes.push(`Curve ${i + 1}: ${e.message}`)
      problems.push(`Curve ${i + 1} (${c && (c.label || c.expr) || '?'}) could not be read: ${e.message}`)
    }
  })

  const rawSeries = Array.isArray(spec.series) ? spec.series : []
  if (rawSeries.length > LIMITS.series) problems.push(`Only ${LIMITS.series} data series can be drawn, but ${rawSeries.length} were given.`)
  const series = []
  rawSeries.slice(0, LIMITS.series).forEach((s, i) => {
    const raw = Array.isArray(s && s.points) ? s.points : []
    const pts = []
    let bad = 0
    raw.forEach((q) => {
      const x = Array.isArray(q) ? num(q[0]) : NaN
      const y = Array.isArray(q) ? num(q[1]) : NaN
      if (isNum(x) && isNum(y)) pts.push([x, y])
      else bad++
    })
    const name = String((s && s.name) || '')
    const shown = name || `series ${i + 1}`
    if (bad) {
      notes.push(`${bad} point(s) of "${shown}" are not numbers and were left out.`)
      problems.push(`Series "${shown}" has ${bad} point(s) that are not valid [x, y] number pairs.`)
    }
    if (pts.length > LIMITS.seriesPoints) problems.push(`Series "${shown}" has ${pts.length} points; the limit is ${LIMITS.seriesPoints}.`)
    if (!pts.length) { problems.push(`Series "${shown}" has no valid points, so it is not drawn.`); notes.push(`"${shown}" has no valid points.`); return }
    const line = !!(s && s.line)
    series.push({
      name,
      points: pts.slice(0, LIMITS.seriesPoints),
      line,
      dashed: !!(s && s.dashed),
      color: s && s.color,
      markers: !line ? true : (s && s.markers === false ? false : pts.length <= 80),
    })
  })

  const rawPoints = Array.isArray(spec.points) ? spec.points : []
  if (rawPoints.length > LIMITS.points) problems.push(`Only ${LIMITS.points} marked points can be drawn, but ${rawPoints.length} were given.`)
  const pointSpecs = rawPoints.slice(0, LIMITS.points).map((q, i) => {
    const x = num(q && q.x)
    const y = num(q && q.y)
    return { i, x, y, label: String((q && q.label) ?? ''), series: q && q.series, at: q && q.at, line: q && q.line, hasXY: isNum(x) && isNum(y) }
  })
  const points = pointSpecs.filter((q) => q.series === undefined && q.at === undefined && q.hasXY).map((q) => ({ x: q.x, y: q.y, label: q.label }))

  const guide = (arr, key, name) => {
    const src = Array.isArray(arr) ? arr : []
    if (src.length > LIMITS.guides) problems.push(`Only ${LIMITS.guides} ${name} can be drawn, but ${src.length} were given.`)
    const out = []
    src.slice(0, LIMITS.guides).forEach((q) => {
      const v = num(q && q[key])
      if (isNum(v)) out.push({ [key]: v, label: String((q && q.label) || '') })
      else problems.push(`A ${name.replace(/s$/, '')} has no valid "${key}" value.`)
    })
    return out
  }
  const vlines = guide(spec.vlines, 'x', 'vlines')
  const hlines = guide(spec.hlines, 'y', 'hlines')
  // A point that the model wrote inside "lines" (for example the proof stress, where the offset line meets the curve)
  // is moved to "points" instead of being dropped.
  const rawLines = Array.isArray(spec.lines) ? spec.lines : []
  const isPointLike = (L) => L && typeof L === 'object' && !L.fit && !L.from && !L.through && (L.at !== undefined || (L.series !== undefined && L.line !== undefined))
  rawLines.filter(isPointLike).forEach((L) => {
    const at = L.at !== undefined ? L.at : 'intersect'
    const x = num(L.x)
    const y = num(L.y)
    pointSpecs.push({ i: pointSpecs.length, x, y, label: String(L.label ?? ''), series: L.series, at, line: L.line, hasXY: isNum(x) && isNum(y) })
    fixes.push(`Moved "${String(L.label || 'a point').replace(/\{[^}]*\}/g, '').trim()}" from lines to points.`)
  })
  const lineSpecs = rawLines.filter((L) => !isPointLike(L)).slice(0, LIMITS.lines)
  if (Array.isArray(spec.lines) && spec.lines.length > LIMITS.lines) problems.push(`Only ${LIMITS.lines} reference lines can be drawn, but ${spec.lines.length} were given.`)

  Object.keys(spec).forEach((k) => { if (!KNOWN_KEYS.has(k)) problems.push(`The field "${k}" is not supported and would be ignored.`) })

  if (!curves.length && !series.length && !points.length && !pointSpecs.length) {
    throw new Error(notes.length ? `I could not read the equation (${notes[0]}).` : 'Nothing to plot.')
  }
  const expect = (Array.isArray(spec.expect) ? spec.expect : []).map((e) => String(e)).filter(Boolean).slice(0, 20)
  return { curves, series, points, pointSpecs, lineSpecs, lines: [], vlines, hlines, notes, problems, fixes, expect }
}

// ---------------------------------------------------------------------------
// Anchoring: labelled points and reference lines are worked out from the data
// here, so a label can never sit away from the point it names.
// ---------------------------------------------------------------------------
function seriesRef(R, ref) {
  if (!R.series.length) return null
  if (ref === undefined || ref === null || ref === '') return R.series.length === 1 ? R.series[0] : null
  if (typeof ref === 'number') return R.series[ref] || null
  const k = lc(ref)
  return R.series.find((s) => lc(s.name) === k) || R.series.find((s) => lc(s.name).includes(k) || (k.length > 2 && k.includes(lc(s.name)) && lc(s.name))) || null
}

function lineRef(lines, ref) {
  if (typeof ref === 'number') return lines[ref] || null
  const k = lc(ref)
  return lines.find((l) => lc(l.label) === k) || lines.find((l) => lc(l.rawLabel).includes(k) && k) || null
}

function interpAt(pts, x) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [xa, ya] = pts[i]
    const [xb, yb] = pts[i + 1]
    if ((x >= xa && x <= xb) || (x <= xa && x >= xb)) {
      if (xa === xb) return [x, ya]
      return [x, ya + ((yb - ya) * (x - xa)) / (xb - xa)]
    }
  }
  return null
}

function polyMeets(pts, fn, xStart) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [xa, ya] = pts[i]
    const [xb, yb] = pts[i + 1]
    if (Math.max(xa, xb) < xStart) continue
    const da = ya - fn(xa)
    const db = yb - fn(xb)
    if (da === 0 && xa >= xStart) return [xa, ya]
    if (da * db < 0) {
      const t = da / (da - db)
      const x = xa + t * (xb - xa)
      if (x >= xStart - 1e-12) return [x, ya + t * (yb - ya)]
    }
  }
  return null
}

function anchorGraph(R, view) {
  const rx = view.xmax - view.xmin || 1
  const ry = view.ymax - view.ymin || 1
  const allVerts = []
  R.series.forEach((s, si) => s.points.forEach((q) => allVerts.push({ x: q[0], y: q[1], si })))
  const nearest = (x, y, verts) => {
    let best = null
    verts.forEach((v) => {
      const d = Math.hypot((v.x - x) / rx, (v.y - y) / ry)
      if (!best || d < best.d) best = { d, v }
    })
    return best
  }

  // 1. reference lines
  R.lines = []
  R.lineSpecs.forEach((L, i) => {
    const rawLabel = String((L && L.label) || '')
    const shown = rawLabel || `line ${i + 1}`
    let x0
    let y0
    let slope
    let defA = view.xmin
    let defB = view.xmax
    if (L && L.fit) {
      const s = seriesRef(R, L.fit.series)
      if (!s) { R.problems.push(`Line "${shown}" fits series "${L.fit.series ?? ''}", but there is no such series. Series names: ${R.series.map((q) => q.name || '(unnamed)').join(', ') || 'none'}.`); R.notes.push(`Line "${shown}" could not be drawn.`); return }
      const fa = Array.isArray(L.fit.x) && isNum(num(L.fit.x[0])) ? num(L.fit.x[0]) : -Infinity
      const fb = Array.isArray(L.fit.x) && isNum(num(L.fit.x[1])) ? num(L.fit.x[1]) : Infinity
      const eps = Math.abs(rx) * 1e-9
      const pts = s.points.filter((q) => q[0] >= fa - eps && q[0] <= fb + eps)
      if (pts.length < 2) { R.problems.push(`Line "${shown}": fewer than 2 points of "${s.name}" lie in the fit range, so no line can be fitted.`); R.notes.push(`Line "${shown}" could not be drawn.`); return }
      const n = pts.length
      let m
      let c
      if (L.fit.origin) {
        const sxx = pts.reduce((t, q) => t + q[0] * q[0], 0)
        m = sxx ? pts.reduce((t, q) => t + q[0] * q[1], 0) / sxx : 0
        c = 0
      } else {
        const mx = pts.reduce((t, q) => t + q[0], 0) / n
        const my = pts.reduce((t, q) => t + q[1], 0) / n
        const sxx = pts.reduce((t, q) => t + (q[0] - mx) ** 2, 0)
        m = sxx ? pts.reduce((t, q) => t + (q[0] - mx) * (q[1] - my), 0) / sxx : 0
        c = my - m * mx
      }
      x0 = 0
      y0 = c
      slope = m
      defA = isFinite(fa) ? Math.min(0, fa) : view.xmin
      defB = isFinite(fb) ? fb : view.xmax
    } else {
      const from = (L && (L.from || L.through)) || null
      const fx = Array.isArray(from) ? num(from[0]) : NaN
      const fy = Array.isArray(from) ? num(from[1]) : NaN
      if (!isNum(fx) || !isNum(fy)) { R.problems.push(`Line "${shown}" needs a start point "from":[x, y], or a "fit".`); R.notes.push(`Line "${shown}" could not be drawn.`); return }
      x0 = fx
      y0 = fy
      if (isNum(num(L.slope))) slope = num(L.slope)
      else if (L.parallelTo !== undefined) {
        const ref = lineRef(R.lines, L.parallelTo)
        if (!ref) { R.problems.push(`Line "${shown}" is parallel to "${L.parallelTo}", but no earlier line has that label.`); R.notes.push(`Line "${shown}" could not be drawn.`); return }
        slope = ref.slope
      } else if (Array.isArray(L.to) && isNum(num(L.to[0])) && isNum(num(L.to[1])) && num(L.to[0]) !== x0) slope = (num(L.to[1]) - y0) / (num(L.to[0]) - x0)
      else { R.problems.push(`Line "${shown}" needs a "slope", a "to" point, or "parallelTo".`); R.notes.push(`Line "${shown}" could not be drawn.`); return }
      defA = x0
    }
    let xa = defA
    let xb = defB
    if (Array.isArray(L.x) && isNum(num(L.x[0])) && isNum(num(L.x[1]))) { xa = num(L.x[0]); xb = num(L.x[1]) }
    const yAt = (x) => y0 + slope * (x - x0)
    const lo = Math.min(yAt(xa), yAt(xb))
    const hi = Math.max(yAt(xa), yAt(xb))
    if (hi < view.ymin || lo > view.ymax || Math.max(xa, xb) < view.xmin || Math.min(xa, xb) > view.xmax) {
      R.problems.push(`Line "${shown}" lies completely outside the axes, so it would not be visible.`)
      R.notes.push(`Line "${shown}" is outside the graph.`)
    }
    R.lines.push({ label: fillLabel(rawLabel, undefined, undefined, slope), rawLabel, x0, y0, slope, xa, xb, dashed: !!L.dashed, color: L.color })
  })

  // 2. labelled points
  const points = []
  R.pointSpecs.forEach((q) => {
    const shown = q.label || `point ${q.i + 1}`
    const anchored = q.series !== undefined || q.at !== undefined
    let x
    let y
    if (anchored) {
      const s = seriesRef(R, q.series)
      const at = lc(q.at)
      if (!s && at !== 'intersect') {
        R.problems.push(`Point "${shown}" is placed on series "${q.series ?? ''}", but there is no such series. Series names: ${R.series.map((z) => z.name || '(unnamed)').join(', ') || 'none'}.`)
        R.notes.push(`Point "${shown}" could not be placed.`)
        return
      }
      if (at === 'max' || at === 'min') {
        const best = s.points.reduce((b, v) => (b === null || (at === 'max' ? v[1] > b[1] : v[1] < b[1]) ? v : b), null)
        ;[x, y] = best
      } else if (at === 'first') { [x, y] = s.points[0] } else if (at === 'last') { [x, y] = s.points[s.points.length - 1] } else if (at === 'x') {
        const xv = num(q.x)
        const hit = isNum(xv) ? interpAt(s.points, xv) : null
        if (!hit) { R.problems.push(`Point "${shown}": x = ${q.x ?? '?'} is outside the data of series "${s.name}".`); R.notes.push(`Point "${shown}" could not be placed.`); return }
        ;[x, y] = hit
      } else if (at === 'intersect') {
        const L = lineRef(R.lines, q.line)
        const target = seriesRef(R, q.series)
        if (!L || !target) { R.problems.push(`Point "${shown}" meets line "${q.line ?? ''}" and series "${q.series ?? ''}", but one of them does not exist.`); R.notes.push(`Point "${shown}" could not be placed.`); return }
        const hit = polyMeets(target.points, (xv) => L.y0 + L.slope * (xv - L.x0), Math.min(L.xa, L.xb))
        if (!hit) { R.problems.push(`Line "${L.rawLabel || 'line'}" never meets series "${target.name}", so "${shown}" cannot be placed. Check the line's start point and slope.`); R.notes.push(`Point "${shown}" could not be placed.`); return }
        ;[x, y] = hit
      } else if (q.hasXY && s) {
        const near = nearest(q.x, q.y, s.points.map((v) => ({ x: v[0], y: v[1] })))
        if (near.d > 0.08) { R.problems.push(`Point "${shown}" is not on series "${s.name}" (the nearest data point is ${Math.round(near.d * 100)}% of the plot away). Use "at":"max", "min", "first", "last" or "at":"x" with "x", instead of typing coordinates.`); R.notes.push(`Point "${shown}" could not be placed.`); return }
        if (near.d > 1e-9) R.fixes.push(`Moved "${shown}" onto the data point of "${s.name}".`)
        x = near.v.x
        y = near.v.y
      } else {
        R.problems.push(`Point "${shown}" has "series" but no "at" and no x and y.`)
        R.notes.push(`Point "${shown}" could not be placed.`)
        return
      }
    } else if (q.hasXY) {
      x = q.x
      y = q.y
      const near = allVerts.length ? nearest(x, y, allVerts) : null
      if (near && near.d <= 0.05 && near.d > 1e-9) {
        R.fixes.push(`Moved "${shown}" onto the nearest data point.`)
        x = near.v.x
        y = near.v.y
      }
    } else {
      R.problems.push(`Point "${shown}" has no position.`)
      R.notes.push(`Point "${shown}" could not be placed.`)
      return
    }
    points.push({ x, y, label: fillLabel(q.label, x, y), rawLabel: q.label })
  })
  R.points = points
}

// The view, the points and the lines, resolved from one spec.
export function resolveGraph(spec, { view: override } = {}) {
  const R = readSpec(spec || {})
  const view = override && isNum(override.xmin) ? { ...override } : autoView(R, spec || {})
  anchorGraph(R, view)
  return { R, view }
}

// A plain-words description built from what is really drawn.
function describeGraph(R, view, shownLabels) {
  const parts = []
  R.curves.forEach((c, i) => parts.push(`${c.label || `curve ${i + 1}`} (${c.dashed ? 'dashed' : 'solid'} line)`))
  R.series.forEach((s, i) => {
    const style = s.line ? `${s.dashed ? 'dashed' : 'solid'} line${s.markers ? ' with markers' : ''}` : 'points only'
    parts.push(`${s.name || `series ${i + 1}`} (${style})`)
  })
  R.lines.forEach((l, i) => parts.push(`${l.label || `line ${i + 1}`} (${l.dashed ? 'dashed' : 'solid'} line)`))
  R.vlines.concat(R.hlines).forEach((g) => { if (g.label) parts.push(`${g.label} (guide line)`) })
  const marks = shownLabels.map((m) => `${m.text} at (${fmtVal(m.x)}, ${fmtVal(m.y)})`)
  let out = parts.length ? `Drawn: ${parts.join('; ')}.` : ''
  if (marks.length) out += `${out ? ' ' : ''}Marked: ${marks.join('; ')}.`
  out += `${out ? ' ' : ''}Axes: x from ${fmtVal(view.xmin)} to ${fmtVal(view.xmax)}, y from ${fmtVal(view.ymin)} to ${fmtVal(view.ymax)}.`
  return out
}

function sampleCurve(c, x0, x1, n) {
  const pts = []
  if (c.param) {
    const { fx, fy, t0, t1 } = c.param
    for (let i = 0; i <= n; i++) {
      const t = t0 + ((t1 - t0) * i) / n
      pts.push([fx(t), fy(t)])
    }
    return pts
  }
  const a = c.domain ? Math.max(x0, c.domain[0]) : x0
  const b = c.domain ? Math.min(x1, c.domain[1]) : x1
  if (!(b > a)) return pts
  for (let i = 0; i <= n; i++) {
    const x = a + ((b - a) * i) / n
    pts.push([x, c.f(x)])
  }
  return pts
}

function autoView(R, spec) {
  let xmin = Number(spec.xmin)
  let xmax = Number(spec.xmax)
  let ymin = Number(spec.ymin)
  let ymax = Number(spec.ymax)
  const dataX = []
  const dataY = []
  R.series.forEach((s) => s.points.forEach((q) => { dataX.push(q[0]); dataY.push(q[1]) }))
  R.points.forEach((q) => { dataX.push(q.x); dataY.push(q.y) })
  R.vlines.forEach((q) => dataX.push(q.x))
  R.hlines.forEach((q) => dataY.push(q.y))

  if (!(isNum(xmin) && isNum(xmax) && xmax > xmin)) {
    const par = R.curves.filter((c) => c.param)
    const fun = R.curves.filter((c) => !c.param)
    let lo = Infinity
    let hi = -Infinity
    dataX.forEach((v) => { lo = Math.min(lo, v); hi = Math.max(hi, v) })
    par.forEach((c) => sampleCurve(c, 0, 0, 200).forEach(([x]) => { if (isFinite(x)) { lo = Math.min(lo, x); hi = Math.max(hi, x) } }))
    if (fun.length) {
      // Functions: use -10..10, but start near zero if nothing exists for x < 0 (sqrt, ln ...).
      let left = false
      fun.forEach((c) => { for (let i = 0; i <= 40; i++) { const x = -10 + (i * 9.9) / 40; if (isFinite(c.f(x))) left = true } })
      lo = Math.min(lo, left ? -10 : -1)
      hi = Math.max(hi, 10)
    }
    if (!isFinite(lo) || !isFinite(hi)) { lo = -10; hi = 10 }
    if (hi - lo < 1e-9) { lo -= 1; hi += 1 }
    const pad = dataX.length || par.length ? (hi - lo) * 0.08 : 0
    xmin = lo - pad
    xmax = hi + pad
    if (!fun.length && lo >= 0 && !par.length) xmin = 0
  }
  if (!(isNum(ymin) && isNum(ymax) && ymax > ymin)) {
    const ys = [...dataY]
    R.curves.forEach((c) => {
      sampleCurve(c, xmin, xmax, 400).forEach(([, y]) => { if (isFinite(y) && Math.abs(y) < 1e7) ys.push(y) })
    })
    let lo
    let hi
    if (ys.length) {
      ys.sort((a, b) => a - b)
      const q = (p) => ys[Math.min(ys.length - 1, Math.max(0, Math.floor(p * (ys.length - 1))))]
      lo = ys.length > 40 ? q(0.02) : ys[0]
      hi = ys.length > 40 ? q(0.98) : ys[ys.length - 1]
    } else { lo = -10; hi = 10 }
    if (hi - lo < 1e-9) { lo -= 1; hi += 1 }
    const pad = (hi - lo) * 0.1
    const allPos = lo >= 0
    lo -= pad
    hi += pad
    if (allPos && !R.curves.length) lo = Math.max(0, lo)
    if (lo > 0 && lo < (hi - lo) * 0.25) lo = 0
    if (hi < 0 && -hi < (hi - lo) * 0.25) hi = 0
    ymin = lo
    ymax = hi
  }
  return { xmin, xmax, ymin, ymax }
}

// ---------------------------------------------------------------------------
// Special points: roots, y-intercept, turning points
// ---------------------------------------------------------------------------
function findSpecial(c, view) {
  const out = []
  if (c.param) return out
  const { xmin, xmax, ymin, ymax } = view
  const f = c.f
  const a = c.domain ? Math.max(xmin, c.domain[0]) : xmin
  const b = c.domain ? Math.min(xmax, c.domain[1]) : xmax
  if (!(b > a)) return out
  const N = 900
  const xs = []
  const ys = []
  for (let i = 0; i <= N; i++) { const x = a + ((b - a) * i) / N; xs.push(x); ys.push(f(x)) }
  const yr = ymax - ymin
  const bis = (fn, lo, hi) => {
    let flo = fn(lo)
    for (let k = 0; k < 60; k++) {
      const mid = (lo + hi) / 2
      const fm = fn(mid)
      if ((fm < 0) === (flo < 0)) { lo = mid; flo = fm } else hi = mid
    }
    return (lo + hi) / 2
  }
  // roots
  let roots = 0
  for (let i = 0; i < N && roots < 6; i++) {
    const y0 = ys[i]
    const y1 = ys[i + 1]
    if (!isFinite(y0) || !isFinite(y1)) continue
    if (y0 === 0) { out.push({ x: xs[i], y: 0, kind: 'root' }); roots++; continue }
    if (y0 * y1 < 0 && Math.abs(y1 - y0) < yr * 3) {
      const xr = bis(f, xs[i], xs[i + 1])
      if (Math.abs(f(xr)) < yr * 1e-3) { out.push({ x: xr, y: 0, kind: 'root' }); roots++ }
    }
  }
  // y-intercept
  if (xmin < 0 && xmax > 0 && (!c.domain || (c.domain[0] <= 0 && c.domain[1] >= 0))) {
    const y0 = f(0)
    if (isFinite(y0) && y0 >= ymin && y0 <= ymax && Math.abs(y0) > yr * 1e-6) out.push({ x: 0, y: y0, kind: 'yint' })
  }
  // turning points: sign changes of the slope
  const h = (b - a) * 1e-6
  const d = (x) => (f(x + h) - f(x - h)) / (2 * h)
  const ds = xs.map((x) => (x - h > a - (b - a) * 0.5 ? d(x) : NaN))
  let turns = 0
  for (let i = 1; i < N && turns < 4; i++) {
    const d0 = ds[i]
    const d1 = ds[i + 1]
    if (!isFinite(d0) || !isFinite(d1)) continue
    const prev = ds[i - 1]
    const exactZero = d0 === 0 && isFinite(prev) && prev * d1 < 0
    if (exactZero || (d0 * d1 < 0 && Math.abs(d0) < 1e6 && Math.abs(d1) < 1e6)) {
      const xt = exactZero ? xs[i] : bis(d, xs[i], xs[i + 1])
      const yt = f(xt)
      if (isFinite(yt) && yt >= ymin && yt <= ymax && Math.abs(d(xt)) < 1e-2 * (1 + yr / (b - a))) {
        // skip jump discontinuities
        if (Math.abs(f(xt + h * 50) - yt) < yr) out.push({ x: xt, y: yt, kind: 'turn' }); turns++
      }
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
export function renderGraph(spec, p, viewOverride) {
  spec = spec || {}
  const { R, view } = resolveGraph(spec, { view: viewOverride })
  const W = 380
  const colors = CURVE_COLORS(p)
  // Every curve, series and line gets its own colour. A colour that is already taken (for example "red"
  // on a theme whose main colour is red) is swapped for the next free one, so two lines are never confused.
  const hexRgb = (c) => {
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})/i.exec(String(c || ''))
    if (!m) return null
    const h = m[1].length === 3 ? m[1].split('').map((x) => x + x).join('') : m[1]
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
  }
  const sameColor = (a, b) => {
    if (!a || !b) return false
    if (String(a).toLowerCase() === String(b).toLowerCase()) return true
    const x = hexRgb(a)
    const y = hexRgb(b)
    return !!(x && y && Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 70)
  }
  const palette = [...colors, '#4aa3ff', '#e8a33d', '#a678f5', '#2fbf9b', '#e5645b']
  const usedColors = []
  const takeColor = (wanted) => {
    let c = wanted && !usedColors.some((u) => sameColor(u, wanted)) ? wanted : null
    if (!c) c = palette.find((pc) => !usedColors.some((u) => sameColor(u, pc))) || wanted || palette[usedColors.length % palette.length]
    usedColors.push(c)
    return c
  }
  const curveCols = R.curves.map((c) => takeColor(pickColor(c.color, null, p)))
  const seriesCols = R.series.map((s) => takeColor(pickColor(s.color, null, p)))
  const lineCols = R.lines.map((l) => takeColor(pickColor(l.color, null, p)))
  const curveColor = (c, i) => curveCols[i]
  const seriesColor = (s, i) => seriesCols[i]
  const lineColor = (l, i) => lineCols[i]
  const legend = []
  const renderProblems = []

  R.curves.forEach((c, i) => { if (c.label) legend.push({ label: c.label, color: curveColor(c, i), dashed: c.dashed, kind: 'line' }) })
  R.series.forEach((s, i) => { if (s.name) legend.push({ label: s.name, color: seriesColor(s, i), dashed: s.dashed, kind: s.line ? 'line' : 'dot', marker: s.line && s.markers }) })
  R.lines.forEach((l, i) => { if (l.label) legend.push({ label: l.label, color: lineColor(l, i), dashed: l.dashed, kind: 'line' }) })
  const showLegend = legend.length > 1 || (legend.length === 1 && legend[0].label !== spec.title)
  const title = spec.title ? prettyPow(spec.title) : ''
  const headH = (title ? 26 : 10) + (showLegend ? legend.length * 17 + 4 : 0)
  const left = 54
  const right = W - 16
  const top = headH
  const ph = 230
  const bottom = top + ph
  const H = bottom + 50
  const pw = right - left
  if (!viewOverride && (spec.equal === true || R.curves.some((c) => c.param)) && spec.equal !== false) {
    const cx = (view.xmin + view.xmax) / 2
    const cy = (view.ymin + view.ymax) / 2
    const perUnit = Math.max((view.xmax - view.xmin) / pw, (view.ymax - view.ymin) / ph)
    view.xmin = cx - (perUnit * pw) / 2
    view.xmax = cx + (perUnit * pw) / 2
    view.ymin = cy - (perUnit * ph) / 2
    view.ymax = cy + (perUnit * ph) / 2
  }
  const { xmin, xmax, ymin, ymax } = view
  const X = (x) => left + ((x - xmin) / (xmax - xmin)) * pw
  const Y = (y) => top + ((ymax - y) / (ymax - ymin)) * ph
  const cid = `rg${++clipCounter}`

  let body = ''
  body += `<defs><clipPath id="${cid}"><rect x="${left}" y="${top}" width="${pw}" height="${ph}"/></clipPath></defs>`
  if (title) body += `<text x="${W / 2}" y="19" text-anchor="middle" font-size="14" font-weight="700" fill="${p.text}" font-family="${FONT}">${esc(title)}</text>`
  if (showLegend) {
    legend.forEach((lg, i) => {
      const y = (title ? 26 : 10) + i * 17 + 8
      if (lg.kind === 'dot') body += `<circle cx="${left + 9}" cy="${y - 3}" r="3.5" fill="${lg.color}"/>`
      else {
        body += `<line x1="${left}" y1="${y - 3}" x2="${left + 18}" y2="${y - 3}" stroke="${lg.color}" stroke-width="2.4"${lg.dashed ? ' stroke-dasharray="5 3"' : ''} stroke-linecap="round"/>`
        if (lg.marker) body += `<circle cx="${left + 9}" cy="${y - 3}" r="3" fill="${lg.color}"/>`
      }
      body += `<text x="${left + 26}" y="${y}" font-size="12" fill="${p.text}" font-family="${FONT}">${esc(lg.label)}</text>`
    })
  }

  // grid + tick labels on the border of the plot
  const nextNice = (st) => {
    const base = Math.pow(10, Math.floor(Math.log10(st) + 1e-9))
    const m = st / base
    return m < 1.5 ? 2 * base : m < 3.5 ? 5 * base : 10 * base
  }
  // Ticks must never run into each other: if the labels would touch, use a wider step.
  const fitStep = (given, range, lo, hi, px, labelPx, gap) => {
    const g = num(given)
    if (isNum(g) && g > 0 && range / g <= 40) return g
    let st = niceStep(range)
    for (let k = 0; k < 8; k++) {
      let longest = 1
      for (let v = Math.ceil(lo / st - 1e-9) * st; v <= hi + st * 1e-9; v += st) longest = Math.max(longest, tickLabel(v, st).length)
      if ((st / range) * px >= labelPx(longest) + gap) break
      st = nextNice(st)
    }
    return st
  }
  const sx = fitStep(spec.xstep, xmax - xmin, xmin, xmax, pw, (n) => n * 6.4, 8)
  const sy = fitStep(spec.ystep, ymax - ymin, ymin, ymax, ph, () => 11, 7)
  for (let v = Math.ceil(xmin / sx - 1e-9) * sx; v <= xmax + sx * 1e-9; v += sx) {
    const px = X(v)
    body += `<line x1="${r1(px)}" y1="${top}" x2="${r1(px)}" y2="${bottom}" stroke="${p.grid}" stroke-width="1"/>`
    body += `<text x="${r1(px)}" y="${bottom + 15}" text-anchor="middle" font-size="11" fill="${p.sub}" font-family="${FONT}">${tickLabel(v, sx)}</text>`
  }
  for (let v = Math.ceil(ymin / sy - 1e-9) * sy; v <= ymax + sy * 1e-9; v += sy) {
    const py = Y(v)
    body += `<line x1="${left}" y1="${r1(py)}" x2="${right}" y2="${r1(py)}" stroke="${p.grid}" stroke-width="1"/>`
    body += `<text x="${left - 6}" y="${r1(py + 4)}" text-anchor="end" font-size="11" fill="${p.sub}" font-family="${FONT}">${tickLabel(v, sy)}</text>`
  }
  if (ymin < 0 && ymax > 0) body += `<line x1="${left}" y1="${r1(Y(0))}" x2="${right}" y2="${r1(Y(0))}" stroke="${p.sub}" stroke-width="1.6"/>`
  if (xmin < 0 && xmax > 0) body += `<line x1="${r1(X(0))}" y1="${top}" x2="${r1(X(0))}" y2="${bottom}" stroke="${p.sub}" stroke-width="1.6"/>`
  body += `<rect x="${left}" y="${top}" width="${pw}" height="${ph}" fill="none" stroke="${p.sub}" stroke-width="1"/>`
  const xl = spec.xlabel === undefined ? 'x' : String(spec.xlabel)
  const yl = spec.ylabel === undefined ? 'y' : String(spec.ylabel)
  if (xl) body += `<text x="${(left + right) / 2}" y="${bottom + 36}" text-anchor="middle" font-size="12.5" font-style="italic" fill="${p.text}" font-family="${FONT}">${esc(xl)}</text>`
  if (yl) body += `<text x="12" y="${r1(top + ph / 2)}" text-anchor="middle" transform="rotate(-90 12 ${r1(top + ph / 2)})" font-size="12.5" font-style="italic" fill="${p.text}" font-family="${FONT}">${esc(yl)}</text>`

  // Everything drawn as a line is an obstacle that labels keep away from.
  const obstacles = []
  const addPath = (pts) => {
    for (let i = 0; i < pts.length - 1 && obstacles.length < 30000; i++) {
      const [x1, y1] = pts[i]
      const [x2, y2] = pts[i + 1]
      if (![x1, y1, x2, y2].every(isFinite)) continue
      const n = Math.min(250, Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 3)))
      for (let k = 0; k <= n; k++) obstacles.push([x1 + ((x2 - x1) * k) / n, y1 + ((y2 - y1) * k) / n])
    }
  }
  body += `<g clip-path="url(#${cid})">`
  // guide lines
  R.vlines.forEach((q) => {
    body += `<line x1="${r1(X(q.x))}" y1="${top}" x2="${r1(X(q.x))}" y2="${bottom}" stroke="${p.sub}" stroke-width="1.4" stroke-dasharray="6 4"/>`
    if (q.label) body += `<text x="${r1(X(q.x)) + 4}" y="${top + 13}" font-size="11" fill="${p.sub}" font-family="${FONT}" paint-order="stroke" stroke="${p.bg}" stroke-width="3">${esc(q.label)}</text>`
  })
  R.hlines.forEach((q) => {
    body += `<line x1="${left}" y1="${r1(Y(q.y))}" x2="${right}" y2="${r1(Y(q.y))}" stroke="${p.sub}" stroke-width="1.4" stroke-dasharray="6 4"/>`
    if (q.label) body += `<text x="${right - 4}" y="${r1(Y(q.y)) - 4}" text-anchor="end" font-size="11" fill="${p.sub}" font-family="${FONT}">${esc(q.label)}</text>`
  })
  // curves
  const N = Math.max(400, Math.round(pw * 1.6))
  R.curves.forEach((c, i) => {
    const col = curveColor(c, i)
    const pts = sampleCurve(c, xmin, xmax, c.param ? 700 : N)
    let d = ''
    let pen = false
    let prevY = null
    pts.forEach(([x, y]) => {
      if (!isFinite(x) || !isFinite(y)) { pen = false; prevY = null; return }
      const px = X(x)
      let py = Y(y)
      if (Math.abs(py) > 1e5) py = py > 0 ? 1e5 : -1e5
      if (pen && prevY !== null && Math.abs(py - prevY) > ph * 2.5) pen = false
      d += `${pen ? 'L' : 'M'}${r1(px)} ${r1(py)}`
      pen = true
      prevY = py
    })
    if (d) body += `<path d="${d}" fill="none" stroke="${col}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"${c.dashed ? ' stroke-dasharray="7 5"' : ''}/>`
    addPath(pts.map(([x, y]) => [X(x), Y(y)]).filter(([qx, qy]) => qx >= left - 20 && qx <= right + 20 && qy >= top - 20 && qy <= bottom + 20))
  })
  // data series (lines are clipped to the plot; markers are drawn below, unclipped)
  R.series.forEach((s, i) => {
    const col = seriesColor(s, i)
    if (s.line) {
      body += `<polyline points="${s.points.map((q) => `${r1(X(q[0]))},${r1(Y(q[1]))}`).join(' ')}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round"${s.dashed ? ' stroke-dasharray="7 5"' : ''}/>`
      addPath(s.points.map((q) => [X(q[0]), Y(q[1])]))
    } else s.points.forEach((q) => obstacles.push([X(q[0]), Y(q[1])]))
  })
  // reference lines (fitted lines, offset lines ...) go on top of the data, so a fitted line stays visible
  R.lines.forEach((l, i) => {
    const col = lineColor(l, i)
    let xa = l.xa
    let xb = l.xb
    const yAt = (x) => l.y0 + l.slope * (x - l.x0)
    if (l.slope) {
      // keep the coordinates sane when the line shoots far off the plot
      const lo = (ymin - (ymax - ymin)) , hi = (ymax + (ymax - ymin))
      const t1 = l.x0 + (lo - l.y0) / l.slope
      const t2 = l.x0 + (hi - l.y0) / l.slope
      const a = Math.min(t1, t2)
      const b = Math.max(t1, t2)
      xa = Math.max(Math.min(xa, xb), a)
      xb = Math.min(Math.max(l.xa, l.xb), b)
    }
    if (xb < xa) return
    body += `<line x1="${r1(X(xa))}" y1="${r1(Y(yAt(xa)))}" x2="${r1(X(xb))}" y2="${r1(Y(yAt(xb)))}" stroke="${col}" stroke-width="2" stroke-linecap="round"${l.dashed ? ' stroke-dasharray="7 5"' : ''}/>`
    addPath([[X(xa), Y(yAt(xa))], [X(xb), Y(yAt(xb))]])
  })
  body += '</g>'
  // Markers sit on top and are not clipped, so a point on the edge of the plot (the last point at the axis limit) stays whole.
  const epsX = (xmax - xmin) * 1e-6
  const epsY = (ymax - ymin) * 1e-6
  R.series.forEach((s, i) => {
    if (!s.markers) return
    const col = seriesColor(s, i)
    s.points.forEach((q) => {
      if (q[0] < xmin - epsX || q[0] > xmax + epsX || q[1] < ymin - epsY || q[1] > ymax + epsY) return
      body += `<circle cx="${r1(X(q[0]))}" cy="${r1(Y(q[1]))}" r="3.6" fill="${col}"/>`
    })
  })

  // marked points with labels that avoid each other
  const placed = []
  const shownLabels = []
  const labelAt = (px, py, text, col) => {
    const w = text.length * 6.3 + 6
    const hgt = 14
    // Candidate spots around the point, nearest first, on both sides and at several distances.
    const cands = []
    for (const dy of [-8, 16, -24, 32, -40, 48, -56, 64, 80, -72]) {
      for (const dx of [7, -7 - w, -w / 2, 30, -30 - w, 55, -55 - w, 85, -85 - w, 120, -120 - w]) cands.push([dx, dy, Math.hypot(Math.max(0, Math.abs(dx + (dx < 0 ? w : 0))) , Math.abs(dy))])
    }
    cands.sort((m, n) => m[2] - n[2])
    const inBounds = (bx, by) => !(bx < left + 1 || bx + w > right - 1 || by < top + 1 || by + hgt > bottom - 1)
    const overlaps = (bx, by) => placed.some((q) => bx < q.x + q.w && bx + w > q.x && by < q.y + q.h && by + hgt > q.y)
    const hits = (bx, by) => {
      let n = 0
      for (let i = 0; i < obstacles.length; i++) {
        const o = obstacles[i]
        if (o[0] >= bx - 1 && o[0] <= bx + w + 1 && o[1] >= by - 1 && o[1] <= by + hgt + 1) n++
      }
      return n
    }
    // Best position: inside the plot, not on another label, touching as little of the drawn lines as possible, and as close to the point as that allows.
    let at = null
    let best = Infinity
    for (const [dx, dy, dist] of cands) {
      const bx = px + dx
      const by = py + dy - 11
      if (!inBounds(bx, by)) continue
      const score = (overlaps(bx, by) ? 1e6 : 0) + hits(bx, by) * 100 + dist * 0.3
      if (score < best) { best = score; at = [bx, by] }
    }
    // A label that overlaps something is better than a label that is missing.
    if (!at) return null
    placed.push({ x: at[0], y: at[1], w, h: hgt })
    // A label placed away from its point gets a thin leader line.
    const cx = Math.min(Math.max(px, at[0]), at[0] + w)
    const cy = Math.min(Math.max(py, at[1]), at[1] + hgt)
    const far = Math.hypot(px - cx, py - cy) > 22
    const leader = far ? `<line x1="${r1(px)}" y1="${r1(py)}" x2="${r1(cx)}" y2="${r1(cy)}" stroke="${p.sub}" stroke-width="0.9"/>` : ''
    return `${leader}<text x="${r1(at[0] + 3)}" y="${r1(at[1] + 11)}" font-size="11" font-weight="600" fill="${col}" font-family="${FONT}" paint-order="stroke" stroke="${p.bg}" stroke-width="3" stroke-linejoin="round">${esc(text)}</text>`
  }
  const inside = (px, py) => px >= left - 0.5 && px <= right + 0.5 && py >= top - 0.5 && py <= bottom + 0.5
  if (spec.markers !== false && R.curves.length <= 3) {
    const found = []
    R.curves.forEach((c, i) => {
      const col = curveColor(c, i)
      const seen = []
      findSpecial(c, view).forEach((sp) => {
        const px = X(sp.x)
        const py = Y(sp.y)
        if (!inside(px, py)) return
        if (seen.some(([qx, qy]) => Math.abs(qx - px) < 4 && Math.abs(qy - py) < 4)) return
        seen.push([px, py])
        found.push({ sp, px, py, col })
      })
    })
    // Too many marked points (waves, many roots) would just be clutter.
    if (found.length <= 8) {
      const rank = { turn: 0, yint: 1, root: 2 }
      found.sort((m, n) => rank[m.sp.kind] - rank[n.sp.kind])
      found.forEach(({ sp, px, py, col }) => {
        body += `<circle cx="${r1(px)}" cy="${r1(py)}" r="4" fill="${p.bg}" stroke="${col}" stroke-width="2"/>`
        const t = labelAt(px, py, `(${fmtVal(sp.x)}, ${fmtVal(sp.y)})`, p.text)
        if (t) body += t
      })
    }
  }
  R.points.forEach((q) => {
    const px = X(q.x)
    const py = Y(q.y)
    if (!inside(px, py)) {
      renderProblems.push(`Point "${q.label || fmtVal(q.x) + ', ' + fmtVal(q.y)}" is outside the axes, so it is not shown.`)
      return
    }
    body += `<circle cx="${r1(px)}" cy="${r1(py)}" r="4.4" fill="${p.accent}" stroke="${p.bg}" stroke-width="1.5"/>`
    const text = q.label || `(${fmtVal(q.x)}, ${fmtVal(q.y)})`
    const t = labelAt(px, py, text, p.text)
    if (t) { body += t; shownLabels.push({ text, x: q.x, y: q.y }) } else renderProblems.push(`The label "${text}" does not fit inside the plot.`)
  })

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" role="img" font-family="${FONT}">${body}</svg>`
  return {
    svg, width: W, height: H, plot: { x: left, y: top, w: pw, h: ph }, view, notes: R.notes.map((t) => String(t).replace(/\s*\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim()),
    caption: describeGraph(R, view, shownLabels),
    problems: [...R.problems, ...renderProblems],
    fixes: R.fixes,
    resolved: R,
  }
}
