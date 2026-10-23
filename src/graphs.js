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
// ---------------------------------------------------------------------------
function readSpec(spec) {
  const notes = []
  const curves = []
  const list = Array.isArray(spec.curves) ? spec.curves : Array.isArray(spec.functions) ? spec.functions : []
  list.slice(0, 6).forEach((c, i) => {
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
      }
    } catch (e) {
      notes.push(`Curve ${i + 1}: ${e.message}`)
    }
  })
  const series = (Array.isArray(spec.series) ? spec.series : []).slice(0, 4).map((s) => ({
    name: s.name || '',
    points: (Array.isArray(s.points) ? s.points : []).map((q) => [Number(q[0]), Number(q[1])]).filter((q) => isNum(q[0]) && isNum(q[1])).slice(0, 400),
    line: !!s.line,
  })).filter((s) => s.points.length)
  const points = (Array.isArray(spec.points) ? spec.points : []).map((q) => ({ x: Number(q.x), y: Number(q.y), label: q.label || '' })).filter((q) => isNum(q.x) && isNum(q.y)).slice(0, 30)
  const vlines = (Array.isArray(spec.vlines) ? spec.vlines : []).map((q) => ({ x: Number(q.x), label: q.label || '' })).filter((q) => isNum(q.x)).slice(0, 6)
  const hlines = (Array.isArray(spec.hlines) ? spec.hlines : []).map((q) => ({ y: Number(q.y), label: q.label || '' })).filter((q) => isNum(q.y)).slice(0, 6)
  if (!curves.length && !series.length && !points.length) {
    throw new Error(notes.length ? `I could not read the equation (${notes[0]}).` : 'Nothing to plot.')
  }
  return { curves, series, points, vlines, hlines, notes }
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
  const R = readSpec(spec || {})
  const W = 380
  const colors = CURVE_COLORS(p)
  const view = viewOverride && isNum(viewOverride.xmin) ? { ...viewOverride } : autoView(R, spec || {})
  const legend = []

  R.curves.forEach((c, i) => { if (c.label) legend.push({ label: c.label, color: c.color || colors[i % colors.length], dashed: c.dashed, kind: 'line' }) })
  R.series.forEach((s, i) => { if (s.name) legend.push({ label: s.name, color: colors[(R.curves.length + i) % colors.length], kind: 'dot' }) })
  const showLegend = legend.length > 1 || (legend.length === 1 && legend[0].label !== spec.title)
  const title = spec.title ? String(spec.title) : ''
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
      else body += `<line x1="${left}" y1="${y - 3}" x2="${left + 18}" y2="${y - 3}" stroke="${lg.color}" stroke-width="2.4"${lg.dashed ? ' stroke-dasharray="5 3"' : ''} stroke-linecap="round"/>`
      body += `<text x="${left + 26}" y="${y}" font-size="12" fill="${p.text}" font-family="${FONT}">${esc(lg.label)}</text>`
    })
  }

  // grid + tick labels on the border of the plot
  const sx = niceStep(xmax - xmin)
  const sy = niceStep(ymax - ymin)
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
    const col = c.color || colors[i % colors.length]
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
  })
  // data series
  R.series.forEach((s, i) => {
    const col = colors[(R.curves.length + i) % colors.length]
    if (s.line) body += `<polyline points="${s.points.map((q) => `${r1(X(q[0]))},${r1(Y(q[1]))}`).join(' ')}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round"/>`
    s.points.forEach((q) => { body += `<circle cx="${r1(X(q[0]))}" cy="${r1(Y(q[1]))}" r="3.6" fill="${col}"/>` })
  })
  body += '</g>'

  // marked points with labels that avoid each other
  const placed = []
  const labelAt = (px, py, text, col) => {
    const w = text.length * 6.3 + 6
    const hgt = 14
    const cands = [[7, -8], [-7 - w, -8], [7, 16], [-7 - w, 16], [-w / 2, 22], [-w / 2, -14]]
    for (const [dx, dy] of cands) {
      const bx = px + dx
      const by = py + dy - 11
      if (bx < left + 1 || bx + w > right - 1 || by < top + 1 || by + hgt > bottom - 1) continue
      if (placed.some((q) => bx < q.x + q.w && bx + w > q.x && by < q.y + q.h && by + hgt > q.y)) continue
      placed.push({ x: bx, y: by, w, h: hgt })
      return `<text x="${r1(bx + 3)}" y="${r1(by + 11)}" font-size="11" font-weight="600" fill="${col}" font-family="${FONT}" paint-order="stroke" stroke="${p.bg}" stroke-width="3" stroke-linejoin="round">${esc(text)}</text>`
    }
    return ''
  }
  const inside = (px, py) => px >= left && px <= right && py >= top && py <= bottom
  if (spec.markers !== false && R.curves.length <= 3) {
    const found = []
    R.curves.forEach((c, i) => {
      const col = c.color || colors[i % colors.length]
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
        body += labelAt(px, py, `(${fmtVal(sp.x)}, ${fmtVal(sp.y)})`, p.text)
      })
    }
  }
  R.points.forEach((q) => {
    const px = X(q.x)
    const py = Y(q.y)
    if (!inside(px, py)) return
    body += `<circle cx="${r1(px)}" cy="${r1(py)}" r="4.4" fill="${p.accent}" stroke="${p.bg}" stroke-width="1.5"/>`
    body += labelAt(px, py, q.label || `(${fmtVal(q.x)}, ${fmtVal(q.y)})`, p.text)
  })

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" role="img" font-family="${FONT}">${body}</svg>`
  return { svg, width: W, height: H, plot: { x: left, y: top, w: pw, h: ph }, view, notes: R.notes }
}
