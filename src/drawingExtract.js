// One place that turns whatever the AI wrote for a drawing into a clean,
// canonical block. It runs on the server (before the reply is sent) and again
// in the app (while the reply streams in), so the screen never depends on the
// AI formatting its JSON perfectly. Whatever the model does (no fence, a
// ```json fence, indented, pretty-printed, a stray comma, \Omega...), the
// output is always:   ```diagram  <one line of valid JSON>  ```
import { inferType, DIAGRAM_TYPES } from './diagrams.js'
import { parseLoose } from './jsonLoose.js'

const KNOWN = new Set([...DIAGRAM_TYPES, 'miller', 'free_body', 'graph'])
const PLAIN = new Set(['', 'json', 'jsonc', 'json5', 'javascript', 'js', 'text', 'plaintext', 'txt', 'diagram', 'graph'])
const DRAWING_START = /"(type|layout|parts|source|supports|loads|forces|curves|series|functions)"\s*:/
const MID_LINE_START = /\{\s*"(?:type|layout|parts|source|supports|loads|forces|curves|series|functions)"\s*:/

export function isDrawingSpec(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return false
  return KNOWN.has(inferType(o))
}

function braceDelta(line) {
  let d = 0
  let inStr = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inStr) {
      if (ch === '\\') i++
      else if (ch === '"') inStr = false
    } else if (ch === '"') inStr = true
    else if (ch === '{') d++
    else if (ch === '}') d--
  }
  return d
}

// Index just after the closing brace of the first { ... } object in a string.
function objectEnd(s) {
  let depth = 0
  let inStr = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inStr) {
      if (ch === '\\') i++
      else if (ch === '"') inStr = false
    } else if (ch === '"') inStr = true
    else if (ch === '{') depth++
    else if (ch === '}') { depth--; if (depth === 0) return i + 1 }
  }
  return -1
}

const fenceFor = (spec) => (inferType(spec) === 'graph' ? 'graph' : 'diagram')

export function canonicalizeDrawings(text) {
  const src = String(text || '')
  if (!src.includes('{')) return src
  const lines = src.split('\n')
  const out = []
  const emit = (spec) => out.push('', '```' + fenceFor(spec), JSON.stringify(spec), '```', '')

  // The model sometimes wraps one-line drawing JSON in single backticks, which
  // shows it as a bit of code. Take the backticks off so it is drawn.
  const WRAPPED = /`+\s*(\{\s*"(?:type|layout|parts|source|supports|loads|forces|curves|series|functions)"\s*:[^`\n]*\})\s*`+/g
  for (let k = 0; k < lines.length; k++) {
    if (!/^\s*```/.test(lines[k]) && lines[k].includes('`')) lines[k] = lines[k].replace(WRAPPED, '$1')
  }

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]

    // 1. A fenced block of any plain language that holds a drawing.
    const fo = /^\s*```\s*([\w-]*)[^\n]*$/.exec(line)
    if (fo) {
      const lang = fo[1].toLowerCase()
      let j = i + 1
      const body = []
      while (j < lines.length && !/^\s*```\s*$/.test(lines[j])) { body.push(lines[j]); j++ }
      const closed = j < lines.length
      const keep = () => {
        out.push(line, ...body)
        if (closed) out.push(lines[j])
        i = closed ? j : lines.length
      }
      if (lang === 'svg' || !PLAIN.has(lang)) { keep(); continue }
      const raw = body.join('\n').trim()
      if (raw.startsWith('{')) {
        if (closed) {
          try {
            const o = parseLoose(raw)
            if (isDrawingSpec(o)) { emit(o); i = j; continue }
          } catch (e) { /* not a drawing, keep as written */ }
        } else if (DRAWING_START.test(raw.slice(0, 300))) {
          // Still streaming in: the app shows a "Drawing..." card until it closes.
          out.push('', '```diagram', raw)
          i = lines.length
          continue
        }
      }
      keep()
      continue
    }

    // 2. Drawing JSON with no fence at all, at the start of a line or after a
    //    few words ("Here is the diagram: {...").
    let prefix = ''
    const mid = line.search(MID_LINE_START)
    if (mid > 0) { prefix = line.slice(0, mid).trimEnd(); line = line.slice(mid) }
    if (/^\s*\{\s*("|$)/.test(line)) {
      let depth = 0
      let j = i
      let closed = false
      const buf = []
      for (; j < lines.length; j++) {
        const l = j === i ? line : lines[j]
        buf.push(l)
        depth += braceDelta(l)
        if (depth <= 0) { closed = true; break }
      }
      let raw = buf.join('\n')
      let rest = ''
      if (closed && j === i) {
        // Words after the closing brace on the same line stay as normal text.
        const end = objectEnd(raw)
        if (end > 0 && end < raw.length) { rest = raw.slice(end).trim(); raw = raw.slice(0, end) }
      }
      if (closed) {
        try {
          const o = parseLoose(raw)
          if (isDrawingSpec(o)) {
            if (prefix) out.push(prefix)
            emit(o)
            if (rest) out.push(rest)
            i = j
            continue
          }
        } catch (e) { /* plain text that happens to use braces */ }
      } else if (DRAWING_START.test(raw.slice(0, 240))) {
        if (prefix) out.push(prefix)
        out.push('', '```diagram', raw)
        break
      }
    }
    out.push(lines[i])
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n')
}
