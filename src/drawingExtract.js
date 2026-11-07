// One place that turns whatever the AI wrote for a drawing into a clean,
// canonical block, and makes sure the student NEVER sees raw JSON, a stuck
// "Drawing..." card or an error message. It runs on the server (final pass,
// before the reply is sent) and in the app (while the reply streams in).
//
// It finds the drawing however it was written: a ```diagram fence, a fence
// with another language name, single backticks, a leading word "diagram",
// no wrapper at all, pretty-printed, one line, or cut off half way. Every
// drawing is checked by really drawing it. The output is always:
//     ```diagram  <one line of valid JSON>  ```      (or ```graph)
//
// Final pass extras (the server):
//   - a cut-off drawing is repaired when possible;
//   - a drawing that cannot be drawn is replaced by a safe one worked out from
//     the question (a Miller plane, a plotted equation) or removed quietly;
//   - if the student asked for a drawing and none came, one is added when it
//     can be worked out exactly (see autoDraw).
import { inferType, DIAGRAM_TYPES, renderDiagram } from './diagrams.js'
import { renderGraph, compileExpr } from './graphs.js'
import { parseLoose } from './jsonLoose.js'

const KNOWN = new Set([...DIAGRAM_TYPES, 'miller', 'free_body', 'graph'])
const PLAIN = new Set(['', 'json', 'jsonc', 'json5', 'javascript', 'js', 'text', 'plaintext', 'txt', 'diagram', 'graph', 'draw', 'drawing'])
const CODE_LANGS = new Set(['python', 'py', 'java', 'c', 'cpp', 'c++', 'csharp', 'cs', 'go', 'rust', 'php', 'ruby', 'sql', 'bash', 'sh', 'shell', 'html', 'css', 'xml', 'yaml', 'yml', 'matlab', 'r', 'kotlin', 'swift', 'latex', 'tex', 'markdown', 'md', 'ts', 'typescript', 'tsx', 'jsx', 'scala', 'dart', 'lua', 'perl'])
const KEYS = 'type|layout|parts|source|supports|loads|forces|curves|series|functions'
const DRAWING_START = new RegExp('["\']?(?:' + KEYS + ')["\']?\\s*:')
// Same colours the exported image uses; only used to test that a drawing works.
const CHECK_PAL = { text: '#111827', sub: '#4b5563', accent: '#16a34a', bg: '#ffffff', grid: '#d1d5db' }

export function isDrawingSpec(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return false
  return KNOWN.has(inferType(o))
}

// ---------------------------------------------------------------------------
// Reading a spec: friendly names and shapes the AI sometimes uses
// ---------------------------------------------------------------------------
const toBar = (s) => String(s)
  .replace(/\\(?:bar|overline|underline)\s*\{\s*(\d)\s*\}/g, '-$1')
  .replace(/(\d)\u0305/g, '-$1')

// "(3 2 3)", "323", "3,-2,3", "3\;2\;\bar{3}" -> [3, 2, 3]
export function parseTriplet(str) {
  let t = toBar(str)
    .replace(/\\(?:left|right|quad|qquad|;|,|:|!|\s)/g, ' ')
    .replace(/[~{}()[\]]/g, ' ')
    .replace(/[\u2212\u2013\u2014]/g, '-')
    .trim()
  if (!t || /[/.]/.test(t)) return null
  let parts = t.split(/[\s,;]+/).filter(Boolean)
  if (parts.length === 1 && /^-?\d{3}$/.test(parts[0])) parts = parts[0].split('')
  if (parts.length === 1 && /^\d{3}$/.test(parts[0]) === false && /^(?:-?\d){3}$/.test(parts[0])) parts = parts[0].match(/-?\d/g)
  if (parts.length !== 3 || !parts.every((x) => /^-?\d$/.test(x))) return null
  const v = parts.map(Number)
  if (v.every((n) => n === 0)) return null
  return v
}

export function normalizeSpec(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return spec
  const o = { ...spec }
  if (typeof o.type === 'string') {
    let t = o.type.trim().toLowerCase().replace(/[\s-]+/g, '_')
    if (/^(miller|miller_plane|miller_planes|miller_indices|crystal_plane|crystal|unit_cell|plane|lattice_plane)$/.test(t)) t = 'miller_plane'
    else if (/^(fbd|free_body|free_body_diagram|force_diagram|forces)$/.test(t)) t = 'fbd'
    else if (/^(beam|beam_diagram|loaded_beam|simply_supported_beam|cantilever|cantilever_beam)$/.test(t)) t = 'beam'
    else if (/^(circuit|circuit_diagram|electric_circuit)$/.test(t)) t = 'circuit'
    else if (/^(lens|lens_diagram|ray_diagram|thin_lens|convex_lens|concave_lens)$/.test(t)) t = 'lens'
    else if (/^(wave|waves|wave_diagram|transverse_wave|longitudinal_wave|standing_wave|sine_wave|parts_of_a_wave|wave_parts)$/.test(t)) {
      if (/longitudinal/.test(t) && !o.kind) o.kind = 'longitudinal'
      if (/standing/.test(t) && !o.kind) o.kind = 'standing'
      t = 'wave'
    } else if (/^(projectile|projectile_motion|trajectory|projectile_path)$/.test(t)) t = 'projectile'
    else if (/^(mirror|concave_mirror|convex_mirror|spherical_mirror|mirror_diagram|mirror_ray_diagram)$/.test(t)) {
      if (/convex/.test(t) && !o.kind) o.kind = 'convex'
      t = 'mirror'
    } else if (/^(sketch|drawing|illustration|scene|figure|free_drawing)$/.test(t)) t = 'sketch'
    else if (/^(flow|flowchart|flow_chart|process_flow|algorithm|flow_diagram)$/.test(t)) t = 'flow'
    else if (/^(graph|plot|chart|function|function_plot|line_graph)$/.test(t)) t = 'graph'
    o.type = t
  }
  const isMiller = inferType(o) === 'miller_plane' || inferType(o) === 'miller'
  if (isMiller) {
    let hkl = null
    for (const key of ['indices', 'hkl', 'miller', 'plane']) {
      const v = o[key]
      if (hkl || v == null) continue
      hkl = Array.isArray(v) ? parseTriplet(v.join(' ')) : parseTriplet(String(v))
    }
    if (hkl) { o.h = hkl[0]; o.k = hkl[1]; o.l = hkl[2] }
    for (const key of ['h', 'k', 'l']) if (o[key] != null && o[key] !== '') o[key] = Number(String(o[key]).replace(/[\u2212\u2013]/g, '-'))
  }
  return o
}

// Throws when the drawing cannot really be drawn. Returns the cleaned spec.
function validate(spec) {
  const o = normalizeSpec(spec)
  if (!isDrawingSpec(o)) throw new Error('not a drawing')
  const t = inferType(o)
  // A missing index must never be guessed: that would draw the wrong plane.
  if ((t === 'miller_plane' || t === 'miller') && !['h', 'k', 'l'].every((k) => Number.isFinite(o[k]))) throw new Error('missing index')
  if (t === 'graph') renderGraph(o, CHECK_PAL)
  else renderDiagram(o, CHECK_PAL)
  return o
}

// For the server: returns the cleaned spec, or throws when it cannot be drawn.
export function checkSpec(spec) { return validate(spec) }

const fenceFor = (spec) => (inferType(spec) === 'graph' ? 'graph' : 'diagram')
export const drawingBlock = (spec) => '\n\n```' + fenceFor(spec) + '\n' + JSON.stringify(spec) + '\n```\n\n'

// ---------------------------------------------------------------------------
// Finding drawings in text
// ---------------------------------------------------------------------------
// Index just after the closing brace of the object that starts at s, or -1.
function objectEnd(t, s) {
  let depth = 0
  let q = ''
  for (let i = s; i < t.length; i++) {
    const ch = t[i]
    if (q) {
      if (ch === '\\') i++
      else if (ch === q) q = ''
      continue
    }
    if (ch === '"') q = '"'
    else if (ch === "'" && /[{[,:]\s*$/.test(t.slice(Math.max(0, i - 3), i))) q = "'"
    else if (ch === '{') depth++
    else if (ch === '}') { depth--; if (depth === 0) return i + 1 }
  }
  return -1
}

// Reads a raw JSON-ish string. Returns { spec } | { failed: true } | { other: true }.
function readRegion(raw, ctx, canRepair) {
  let o = null
  try { o = parseLoose(raw) } catch (e) {
    if (canRepair) { try { o = parseLoose(raw, { partial: true }) } catch (e2) { o = null } }
  }
  if (o === null) return DRAWING_START.test(raw.slice(0, 300)) ? { failed: true } : { other: true }
  if (!isDrawingSpec(normalizeSpec(o))) return { other: true }
  if (!ctx.check) return { spec: normalizeSpec(o) }
  try { return { spec: validate(o) } } catch (e) { return { failed: true } }
}

// What goes in the place of a drawing that could not be read or drawn.
function replacement(ctx) {
  if (ctx.fallback && !ctx.usedFallback) {
    try {
      const spec = validate(ctx.fallback)
      ctx.usedFallback = true
      ctx.drawn++
      return drawingBlock(spec)
    } catch (e) { /* fall through */ }
  }
  ctx.dropped++
  return '\n\n'
}

function processFence(seg, ctx) {
  const keep = [seg.open, ...(seg.bodyLines || []), ...(seg.closed ? [seg.close] : [])].join('\n')
  const lang = seg.lang
  // The AI sometimes labels the block with the drawing's own name (```beam, ```circuit...). Any block that
  // really holds a drawing is drawn; real programming code is left alone.
  if (lang === 'svg' || CODE_LANGS.has(lang)) return keep
  const raw = seg.bodyLines.join('\n').trim()
  if (!raw.startsWith('{')) return keep
  const r = readRegion(raw, ctx, ctx.final || seg.closed)
  if (r.spec) { ctx.drawn++; return drawingBlock(r.spec) }
  if (r.failed) {
    if (!ctx.final && !seg.closed) return '\n\n```diagram\n' + raw // still streaming: the app shows a placeholder
    return replacement(ctx)
  }
  return keep
}

const RE_BEFORE_TICK = /`+[ \t]*(?:(?:diagram|graph|json|drawing)\b[ \t]*:?[ \t]*)?$/i
const RE_BEFORE_LINE = /(?:^|\n)[ \t]*(?:diagram|graph|json|drawing)\b[ \t]*:?[ \t]*$/i

function processText(text, ctx) {
  if (!text.includes('{')) return text
  const start = new RegExp('\\{\\s*["\']?(?:' + KEYS + ')["\']?\\s*:', 'g')
  let out = ''
  let pos = 0
  let m
  while ((m = start.exec(text))) {
    const s = m.index
    if (s < pos) continue
    let e = objectEnd(text, s)
    let raw
    let cutOff = false
    if (e < 0) {
      // Never closed. In the final pass, take the paragraph the object sits in.
      if (!ctx.final) {
        const before = text.slice(pos, s)
        const dm = RE_BEFORE_TICK.exec(before) || RE_BEFORE_LINE.exec(before)
        const cut = dm ? dm.index + (dm[0].startsWith('\n') ? 1 : 0) : before.length
        return out + before.slice(0, cut) + '\n\n```diagram\n' + text.slice(s).replace(/`+\s*$/, '')
      }
      const brk = text.indexOf('\n\n', s)
      e = brk < 0 ? text.length : brk
      raw = text.slice(s, e).replace(/[\s`]+$/, '')
      cutOff = true
    } else raw = text.slice(s, e)

    const r = readRegion(raw, ctx, ctx.final || cutOff)
    if (r.other) { out += text.slice(pos, e); pos = e; continue }

    const before = text.slice(pos, s)
    const dm = RE_BEFORE_TICK.exec(before) || RE_BEFORE_LINE.exec(before)
    const cut = dm ? dm.index + (dm[0].startsWith('\n') ? 1 : 0) : before.length
    out += before.slice(0, cut)
    const tail = /^[ \t]*`+/.exec(text.slice(e))
    if (tail) e += tail[0].length
    if (r.spec) { ctx.drawn++; out += drawingBlock(r.spec) } else out += replacement(ctx)
    pos = e
  }
  return out + text.slice(pos)
}

// Splits text into plain stretches and ``` fenced blocks.
function segments(text) {
  const lines = text.split('\n')
  const segs = []
  let buf = []
  const flush = () => { if (buf.length) { segs.push({ fence: false, text: buf.join('\n') }); buf = [] } }
  for (let i = 0; i < lines.length; i++) {
    const m = /^[ \t]*(`{3,}|~{3,})[ \t]*([\w+-]*)(.*)$/.exec(lines[i])
    // A fence that opens and closes on one line is inline code, not a block.
    if (!m || m[3].includes(m[1][0].repeat(3))) { buf.push(lines[i]); continue }
    flush()
    const fence = m[1]
    const bodyLines = []
    const first = m[3].trim()
    if (first) bodyLines.push(first)
    let j = i + 1
    for (; j < lines.length; j++) {
      const c = /^[ \t]*(`{3,}|~{3,})[ \t]*$/.exec(lines[j])
      if (c && c[1][0] === fence[0] && c[1].length >= fence.length) break
      bodyLines.push(lines[j])
    }
    const closed = j < lines.length
    segs.push({ fence: true, lang: m[2].toLowerCase(), open: first ? lines[i].slice(0, lines[i].length - m[3].length).trimEnd() : lines[i], bodyLines, closed, close: closed ? lines[j] : '' })
    i = closed ? j : lines.length
  }
  flush()
  return segs
}

// opts: { final, check, fallback, stats }
//  final    - the reply is complete: repair or quietly remove anything unreadable
//  check    - really draw each drawing to be sure it works (default: same as final)
//  fallback - spec used in place of the first drawing that cannot be drawn
//  stats    - object that receives { drawn, dropped }
export function canonicalizeDrawings(text, opts = {}) {
  const src = String(text || '')
  if (!src.includes('{')) { if (opts.stats) { opts.stats.drawn = 0; opts.stats.dropped = 0 } return src }
  const ctx = { final: !!opts.final, check: opts.check != null ? !!opts.check : !!opts.final, fallback: opts.fallback || null, usedFallback: false, drawn: 0, dropped: 0 }
  const out = segments(src).map((seg) => (seg.fence ? processFence(seg, ctx) : processText(seg.text, ctx))).join('\n')
  if (opts.stats) { opts.stats.drawn = ctx.drawn; opts.stats.dropped = ctx.dropped }
  return out.replace(/\n{3,}/g, '\n\n')
}

// ---------------------------------------------------------------------------
// Safety net: drawings that can be worked out exactly from the words
// ---------------------------------------------------------------------------
const ASK = /\b(draw|sketch|diagram|plot|graph|illustrate|visuali[sz]e|depict|represent)\b|unit cell/i
const REPLY_SAYS = /^\W*diagram\b|\bdiagram\b\s*[-:\u2013\u2014]|(?:here(?:'s| is)|see|below is|shown (?:in|below))\s+(?:the|a)\s+(?:\w+\s+){0,4}(?:diagram|graph|plot|sketch|figure|drawing)/im

export function wantsDrawing(question, reply, tool) {
  return tool === 'graph' || ASK.test(String(question || '')) || REPLY_SAYS.test(String(reply || ''))
}

function millerFrom(question, reply) {
  const r = toBar(reply || '').replace(/\\(?:left|right)/g, '')
  // The answer's own line, e.g. "(hkl) = (3 2 3)" (last one wins: it is the final answer)
  const fin = [...r.matchAll(/\(\s*h\s*k\s*l\s*\)\s*(?:=|:|\\to|\\rightarrow|is|are)\s*\\?\(?\s*([^()$\n]{3,24}?)\s*\\?\)/g)]
  for (let i = fin.length - 1; i >= 0; i--) { const v = parseTriplet(fin[i][1]); if (v) return v }
  const mi = [...r.matchAll(/miller\s+indices?[^()\n]{0,40}\(\s*([^()$\n]{3,24}?)\s*\)/gi)]
  for (let i = mi.length - 1; i >= 0; i--) { const v = parseTriplet(mi[i][1]); if (v) return v }
  const q = toBar(question || '')
  const a = /\(\s*([^()\n]{3,16}?)\s*\)\s*(?:plane|planes|miller)/i.exec(q) || /miller\s+indices?\s*(?:of|for|are|is|=|:)?\s*\(\s*([^()\n]{3,16}?)\s*\)/i.exec(q)
  return a ? parseTriplet(a[1]) : null
}

function cleanExpr(s) {
  return String(s)
    .replace(/\$/g, '')
    .replace(/[\u2212\u2013\u2014]/g, '-')
    .replace(/[\u00D7\u00B7]/g, '*').replace(/\u00F7/g, '/')
    .replace(/\u00B2/g, '^2').replace(/\u00B3/g, '^3').replace(/\u03C0/g, 'pi')
    .replace(/\\left|\\right/g, '')
    .replace(/\\cdot|\\times/g, '*').replace(/\\pi/g, 'pi')
    .replace(/\\(sin|cos|tan|ln|log|exp|sqrt)/g, '$1')
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))')
    .replace(/\{/g, '(').replace(/\}/g, ')')
    .replace(/(\d)\s*(x|sin|cos|tan|ln|log|exp|sqrt)\b/gi, '$1*$2')
    .replace(/\)\s*(\(|x\b)/g, ')*$1')
    .replace(/\bx\s*\(/g, 'x*(')
    .trim()
}

function curvesFrom(question) {
  const q = String(question || '').replace(/^\[The student is replying to [\s\S]*?"\]\s*/i, '')
  const out = []
  const seen = new Set()
  for (const m of q.matchAll(/(?:^|[\s(,;:])(?:y|f\s*\(\s*x\s*\)|g\s*\(\s*x\s*\))\s*=\s*([^\n]+)/gi)) {
    let e = m[1].split(/\s*(?:,\s|;|\bfor\b|\bwhere\b|\bon\b|\bfrom\b|\bbetween\b|\bover\b|\band\b|\bthen\b|\bwith\b|\bwhen\b|\bat\b|\bin the\b|\bshow\b|\bdraw\b|\bplot\b|\bsketch\b|\bfind\b|\bidentify\b|\blabel\b|\bmark\b|\bincluding\b)/i)[0]
    e = cleanExpr(e.replace(/[.?!:\s]+$/, ''))
    if (!e || seen.has(e)) continue
    try { compileExpr(e, 'x') } catch (err) { continue }
    seen.add(e)
    out.push({ expr: e, label: 'y = ' + e.replace(/\*/g, '') })
    if (out.length >= 3) break
  }
  return out
}

// Returns a drawing spec that is certain to match the question, or null.
// needIntent: only answer when the student asked for (or the reply promised) a drawing.
export function autoDraw(question, reply, tool, needIntent = true) {
  try {
    const q = String(question || '')
    if (needIntent && !wantsDrawing(q, reply, tool)) return null
    if (/miller|\(\s*h\s*k\s*l\s*\)|unit cell|crystal/i.test(q + ' ' + (reply || '').slice(0, 4000))) {
      const hkl = millerFrom(q, reply)
      if (hkl && hkl.every((n) => Math.abs(n) <= 6)) return { type: 'miller_plane', h: hkl[0], k: hkl[1], l: hkl[2] }
    }
    if (tool === 'graph' || ASK.test(q)) {
      const curves = curvesFrom(q)
      if (curves.length) return { type: 'graph', title: curves.map((c) => c.label).join(' and '), xlabel: 'x', ylabel: 'y', curves }
    }
  } catch (e) { /* no safety net this time */ }
  return null
}

// The server's last step. Returns { text, drawn, wanted }.
//  drawn  - how many drawings the final text holds
//  wanted - the student wanted a drawing but there is none (the server may try once more)
export function finalizeDrawings(text, { question = '', tool = '' } = {}) {
  const stats = {}
  const loose = autoDraw(question, text, tool, false) // used in place of a broken drawing
  let out = canonicalizeDrawings(text, { final: true, fallback: loose, stats })
  let drawn = stats.drawn
  if (!drawn) {
    const sure = autoDraw(question, out, tool, true)
    if (sure) { out = out.trimEnd() + drawingBlock(sure); drawn = 1 }
  }
  const wanted = drawn === 0 && wantsDrawing(question, out, tool) && (stats.dropped > 0 || ASK.test(String(question || '')) || tool === 'graph')
  return { text: out.replace(/\n{3,}/g, '\n\n'), drawn, wanted }
}
