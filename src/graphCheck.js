// Checks a graph spec before it is shown. Used by the server (which asks the
// model to fix a spec once if problems remain) and by the offline tests.
//
//   checkGraph(spec, { question }) -> { spec, problems, fixes, caption }
//     spec     the spec with safe automatic fixes applied (points moved onto the
//              data, axes started at zero when the question asks for it ...)
//     problems things that need the model to redo the graph (empty = good)
//     fixes    what was corrected automatically
import { renderGraph, resolveGraph } from './graphs.js'

const CHECK_PAL = { text: '#111111', sub: '#666666', grid: '#dddddd', bg: '#ffffff', accent: '#2fbf9b', border: '#cccccc', surface: '#ffffff' }
const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'line', 'curve', 'plot', 'graph', 'point', 'data', 'value', 'values', 'label', 'labelled', 'mark', 'marked', 'show', 'draw', 'use', 'that', 'this', 'each', 'both'])
const ZERO_RULE = /(start|begin|originat)\w*[^.]{0,40}\bzero\b|from zero|no negative|non-?negative|both axes start at zero/i

const words = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9.% ]+/g, ' ').split(/\s+/).filter((w) => w.length >= 2 && !STOP.has(w))
const stem = (w) => (w.length > 5 ? w.slice(0, 5) : w)

// Is the thing the student asked for (one short phrase) named somewhere in the graph?
function isDrawn(item, haystack) {
  const ws = words(item)
  if (!ws.length) return true
  const hit = ws.filter((w) => haystack.includes(stem(w))).length
  return hit / ws.length >= 0.6
}

export function checkGraph(spec, { question = '' } = {}) {
  const fixed = JSON.parse(JSON.stringify(spec || {}))
  const problems = []
  const fixes = []
  let out
  let ctx
  try {
    out = renderGraph(spec, CHECK_PAL)
    ctx = resolveGraph(spec)
  } catch (e) {
    return { spec: fixed, problems: [e.message || 'The graph cannot be drawn.'], fixes, caption: '' }
  }
  const { R, view } = ctx
  problems.push(...out.problems)
  fixes.push(...out.fixes)

  // Axes start at zero when the question says so and no data is negative.
  if (ZERO_RULE.test(question)) {
    const xs = R.series.flatMap((s) => s.points.map((q) => q[0]))
    const ys = R.series.filter((s) => !s.right).flatMap((s) => s.points.map((q) => q[1]))
    if (xs.length && Math.min(...xs) >= 0 && Number.isFinite(Number(fixed.xmin)) && Number(fixed.xmin) !== 0) { fixed.xmin = 0; fixes.push('Started the x-axis at zero.') }
    if (ys.length && Math.min(...ys) >= 0 && Number.isFinite(Number(fixed.ymin)) && Number(fixed.ymin) !== 0) { fixed.ymin = 0; fixes.push('Started the y-axis at zero.') }
  }

  // Everything the model said it would draw must really be in the graph.
  if (R.expect.length) {
    const hay = [
      fixed.title,
      ...R.curves.map((c) => c.label),
      ...R.series.map((s) => s.name),
      ...R.lines.map((l) => l.rawLabel || l.label),
      ...R.points.map((q) => q.rawLabel || q.label),
      ...R.vlines.map((v) => v.label),
      ...R.hlines.map((h) => h.label),
    ].join(' ').toLowerCase()
    R.expect.forEach((item) => { if (!isDrawn(item, hay)) problems.push(`"${item}" was expected in the graph, but nothing drawn is named or labelled like that.`) })
  }

  // Safe fixes: labelled points sit exactly on the data, series keep only what is inside the axes.
  if (R.pointSpecs.length) {
    fixed.points = R.points.map((q) => (q.right
      ? { series: q.seriesName, at: 'x', x: Number(q.x.toPrecision(10)), label: q.rawLabel ?? q.label }
      : { x: Number(q.x.toPrecision(10)), y: Number(q.y.toPrecision(10)), label: q.rawLabel ?? q.label }))
  }
  const eps = 0.02
  const rx = view.xmax - view.xmin
  const ry = view.ymax - view.ymin
  if (Array.isArray(fixed.series) && R.series.length === fixed.series.length) {
    fixed.series.forEach((s, i) => {
      // A right-axis series is checked against its own scale, not the left one.
      const [vlo, vhi] = R.series[i].right && R.y2 ? [R.y2.min, R.y2.max] : [view.ymin, view.ymax]
      const ryS = vhi - vlo
      const keep = R.series[i].points.filter((q) => q[0] >= view.xmin - rx * eps && q[0] <= view.xmax + rx * eps && q[1] >= vlo - ryS * eps && q[1] <= vhi + ryS * eps)
      if (keep.length !== R.series[i].points.length && keep.length >= 2) {
        fixes.push(`Left ${R.series[i].points.length - keep.length} point(s) of "${R.series[i].name || 'series ' + (i + 1)}" out, because they are outside the axes.`)
        s.points = keep
      }
    })
  }
  const after = renderGraph(fixed, CHECK_PAL)
  return { spec: fixed, problems: problems.filter((p, i, a) => a.indexOf(p) === i), fixes, caption: after.caption }
}

// ---------------------------------------------------------------------------
// Values in the written reply must agree with the graph.
//
// A labelled point such as "Proof stress {y} MPa" or a fitted line such as
// "E = {slope/1000} GPa" is worked out by the app from the data. If the reply
// states the same quantity with a number that is a little off (the model's own
// arithmetic), the number is replaced with the graph's. Only near misses are
// touched (between 1% and 10% off), so a different quantity on the same line,
// for example "true stress at UTS", is left alone.
// ---------------------------------------------------------------------------
const NEAR_MAX = 0.10
const STATES_MAX = 0.5
const escRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const decimals = (t) => (String(t).split('.')[1] || '').length
// Not after "true": "true stress at UTS" is a different quantity.
const UTS_NAME = '(?<!true\\s+(?:stress\\s+)?(?:at\\s+)?)(?:ultimate\\s+tensile\\s+(?:strength|stress)|tensile\\s+strength|UTS)'
const E_NAME = "(?:Young['\\u2019]?s\\s+modulus|elastic\\s+modulus|modulus\\s+of\\s+elasticity)"

function readingsFromGraph(spec) {
  const out = []
  let ctx
  try { ctx = resolveGraph(spec) } catch (e) { return out }
  ctx.R.points.forEach((q) => {
    const raw = String(q.rawLabel || '')
    const m = raw.match(/^(.*?)[\s:=,(-]*\{y\}\s*([A-Za-z%\u00b0\u03a9\/\u00b7^0-9-]*)/)
    if (!m) return
    const name = m[1].replace(/[\s:=,(-]+$/g, '').replace(/\s*=\s*$/, '').trim()
    if (name.length >= 3 && /[A-Za-z]/.test(name)) out.push({ name, unit: m[2] || '', value: q.y })
  })
  ctx.R.lines.forEach((l) => {
    const m = String(l.rawLabel || '').match(/([A-Za-z][A-Za-z_]{0,3})\s*=\s*\{slope(?:\/([0-9.]+))?\}\s*([A-Za-z%\/]*)/)
    if (!m) return
    const div = m[2] ? Number(m[2]) : 1
    const value = l.slope / div
    out.push({ symbol: m[1], unit: m[3] || '', value })
    // "Young's modulus ... 198.8 GPa" in the text is the same quantity as "E = ..." on the graph
    if (m[1] === 'E') out.push({ name: "Young's modulus", pattern: E_NAME, unit: m[3] || '', value })
  })
  // Recipe: a stress-strain graph. The ultimate tensile strength is the highest stress on the
  // engineering curve, so it is read from the data even if the model did not label that point.
  // Only used when no labelled UTS exists, and "true stress at UTS" lines are never touched.
  try {
    const xl = String(spec.xlabel || '')
    const yl = String(spec.ylabel || '')
    const unit = ((yl.match(/\(([^)]*)\)/) || [])[1] || '').trim()
    if (/strain/i.test(xl) && /stress/i.test(yl) && /^(MPa|GPa|kPa)$/i.test(unit) && !out.some((r) => /UTS|ultimate/i.test(r.name || ''))) {
      const eng = ctx.R.series.find((q) => !q.right && !/true/i.test(q.name || ''))
      if (eng && eng.points.length >= 3) {
        const value = Math.max(...eng.points.map((q) => q[1]))
        if (Number.isFinite(value) && value > 0) out.push({ name: 'UTS', pattern: UTS_NAME, unit, value })
      }
    }
  } catch (e) { /* no recipe, no change */ }
  return out
}

// Brackets and symbols may sit between a name and its number: "Proof stress (0.2% offset): 360 MPa".
const GAP = '(?:\\([^)\\n]{0,30}\\)|\\u03c3[_0-9.]*|[^0-9\\n]){0,40}?'
// The unit may be written plainly, in a table cell, or in LaTeX: "370.0 MPa", "| MPa", "\\text{ MPa}".
const unitSrc = (u) => `(?:\\s|\\\\[,;!]|\\\\(?:text|mathrm|rm)\\s*\\{|[{|])*${escRe(u)}\\b`

export function reconcileValues(text, specs) {
  const readings = (specs || []).flatMap(readingsFromGraph)
  if (!readings.length) return { text, changes: [] }
  const changes = []
  const NUM = '(-?[0-9]+(?:[ \\u202f,][0-9]{3})*(?:\\.[0-9]+)?)'
  const clean = (t) => String(t).replace(/[ \u202f,]/g, '')
  // A number is "the same" when the graph value, rounded the way the text rounds it, gives that number.
  const decide = (numText, r, reach) => {
    const c = clean(numText)
    const n = Number(c)
    const d = decimals(c)
    if (Number(r.value.toFixed(d)) === n) return null
    const rel = Math.abs(n - r.value) / Math.abs(r.value || 1)
    if (rel > reach) return null
    return r.value.toFixed(d)
  }
  // never edit inside code blocks
  const parts = String(text).split(/(```[\s\S]*?```)/g)
  // A table row: "| Proof stress | 260 | MPa |". The number and its unit are in neighbouring cells.
  const fixRow = (line) => {
    const cells = line.split('|')
    if (cells.length < 4) return line
    let changed = false
    readings.forEach((r) => {
      if (r.symbol || !r.unit) return
      if (!new RegExp(`^\\s*[*_]*${r.pattern || escRe(r.name)}`, 'i').test(cells[1] || '')) return
      for (let i = 2; i < cells.length - 1; i++) {
        if (cells[i + 1].trim().toLowerCase() !== r.unit.toLowerCase()) continue
        const m = cells[i].match(/^(\s*)(-?[0-9]+(?:[ \u202f,][0-9]{3})*(?:\.[0-9]+)?)(\s*)$/)
        if (!m) continue
        const fixedNum = decide(m[2], r, STATES_MAX)
        if (fixedNum !== null) {
          cells[i] = `${m[1]}${fixedNum}${m[3]}`
          changes.push(`${r.name}: ${clean(m[2])} -> ${fixedNum}`)
          changed = true
        }
        break
      }
    })
    return changed ? cells.join('|') : line
  }
  const fixLine = (line) => {
    if (line.length > 300) return line
    if (/^\s*\|/.test(line)) return fixRow(line)
    let out = line
    readings.forEach((r) => {
      if (!r.unit && !r.symbol) return
      const unit = r.unit ? unitSrc(r.unit) : ''
      const nameRe = r.pattern || (r.symbol ? null : escRe(r.name))
      const re = r.symbol
        ? new RegExp(`(\\b${escRe(r.symbol)}\\s*(?:=|\\u2248|~)\\s*\\$?\\s*)${NUM}(${unit})`, 'i')
        : new RegExp(`(\\b${nameRe}\\b${GAP})${NUM}(${unit})`, 'i')
      // A line that begins by naming the quantity states that quantity, so a bigger miss is also a miss.
      const states = !r.symbol && new RegExp(`^[\\s|>*#_.)(0-9%-]*${nameRe}`, 'i').test(out)
      const reach = states ? STATES_MAX : NEAR_MAX
      out = out.replace(re, (whole, pre, num, post) => {
        const fixedNum = decide(num, r, reach)
        if (fixedNum === null) return whole
        changes.push(`${r.name || r.symbol}: ${clean(num)} -> ${fixedNum}`)
        return `${pre}${fixedNum}${post}`
      })
    })
    return out
  }
  const fixed = parts.map((part, i) => (i % 2 === 1 ? part : part.split('\n').map(fixLine).join('\n'))).join('')
  return { text: fixed, changes }
}

// ---------------------------------------------------------------------------
// Missing plots. A question that asks for "Plot A" and "Plot B" needs two graph
// blocks. A reply with fewer has silently dropped a plot.
// ---------------------------------------------------------------------------
export function requiredPlots(question) {
  const found = new Set(((String(question || '').match(/\bplots?\s+([A-D])\b/gi)) || []).map((m) => m.trim().slice(-1).toUpperCase()))
  return found.size >= 2 ? [...found].sort() : []
}

// Puts one graph block under each "Plot X" heading of the reply (existing blocks are replaced).
export function placePlots(text, specs, letters) {
  const stripped = String(text).replace(/\n*```graph[^\n]*\n[\s\S]*?```[ \t]*\n*/g, '\n\n')
  const block = (sp) => '```graph\n' + JSON.stringify(sp) + '\n```'
  const placed = new Set()
  const out = []
  let inFence = false
  stripped.split('\n').forEach((line) => {
    if (/^\s*```/.test(line)) inFence = !inFence
    out.push(line)
    if (inFence) return
    const m = line.match(/^[\s#>*_-]*plot\s+([A-D])\b/i)
    if (!m) return
    const i = letters.indexOf(m[1].toUpperCase())
    if (i < 0 || placed.has(i) || !specs[i]) return
    placed.add(i)
    out.push('', block(specs[i]), '')
  })
  let result = out.join('\n').replace(/\n{3,}/g, '\n\n')
  specs.forEach((sp, i) => { if (sp && !placed.has(i)) result = result.trimEnd() + '\n\n' + block(sp) + '\n' })
  return result
}
