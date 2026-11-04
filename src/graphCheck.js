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
    const ys = R.series.flatMap((s) => s.points.map((q) => q[1]))
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
    fixed.points = R.points.map((q) => ({ x: Number(q.x.toPrecision(10)), y: Number(q.y.toPrecision(10)), label: q.label }))
  }
  const eps = 0.02
  const rx = view.xmax - view.xmin
  const ry = view.ymax - view.ymin
  if (Array.isArray(fixed.series) && R.series.length === fixed.series.length) {
    fixed.series.forEach((s, i) => {
      const keep = R.series[i].points.filter((q) => q[0] >= view.xmin - rx * eps && q[0] <= view.xmax + rx * eps && q[1] >= view.ymin - ry * eps && q[1] <= view.ymax + ry * eps)
      if (keep.length !== R.series[i].points.length && keep.length >= 2) {
        fixes.push(`Left ${R.series[i].points.length - keep.length} point(s) of "${R.series[i].name || 'series ' + (i + 1)}" out, because they are outside the axes.`)
        s.points = keep
      }
    })
  }
  const after = renderGraph(fixed, CHECK_PAL)
  return { spec: fixed, problems: problems.filter((p, i, a) => a.indexOf(p) === i), fixes, caption: after.caption }
}
