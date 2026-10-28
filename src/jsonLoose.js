// Reads the small drawing specs the AI writes. Models often add tiny mistakes
// (\Omega instead of \u03A9, trailing commas, single quotes, comments). Strict
// JSON.parse then fails and the student sees raw code. This repairs those.
function parseRaw(text) {
  const src = String(text || '').replace(/^\uFEFF/, '').trim()
  try { return JSON.parse(src) } catch (e) { /* try repairs below */ }
  let s = src
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
  // Fix bad backslashes and raw line breaks inside strings only.
  let out = ''
  let inStr = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (!inStr) {
      if (ch === '"') inStr = true
      out += ch
      continue
    }
    if (ch === '"') { inStr = false; out += ch; continue }
    if (ch === '\n' || ch === '\r') { out += ' '; continue }
    if (ch === '\\') {
      const nx = s[i + 1]
      if (nx === 'u' && /^[0-9a-fA-F]{4}$/.test(s.slice(i + 2, i + 6))) { out += '\\u'; i++; continue }
      if (nx && '"\\/bfnrt'.includes(nx)) { out += ch + nx; i++; continue }
      out += '\\\\'
      continue
    }
    out += ch
  }
  s = out.replace(/,\s*([}\]])/g, '$1')
  try { return JSON.parse(s) } catch (e) { /* try single quotes */ }
  s = s.replace(/'([^'\n]*)'/g, (m, x) => `"${x.replace(/"/g, '\\"')}"`)
  return JSON.parse(s)
}

// Labels are plain text in the drawing, so LaTeX names become real symbols.
const SYMBOLS = { Omega: '\u03A9', omega: '\u03C9', mu: '\u00B5', theta: '\u03B8', alpha: '\u03B1', beta: '\u03B2', phi: '\u03C6', lambda: '\u03BB', Delta: '\u0394', pi: '\u03C0', degree: '\u00B0', circ: '\u00B0', times: '\u00D7', cdot: '\u00B7' }
function cleanLabel(s) {
  return s
    .replace(/\\([A-Za-z]+)/g, (m, n) => (SYMBOLS[n] ? SYMBOLS[n] : m))
    .replace(/\$/g, '')
    .replace(/\^\{?\\?(?:circ|degree)\}?/g, '\u00B0')
}
function walk(v) {
  if (typeof v === 'string') return cleanLabel(v)
  if (Array.isArray(v)) return v.map(walk)
  if (v && typeof v === 'object') {
    const o = {}
    Object.keys(v).forEach((k) => { o[k] = k === 'expr' || k === 'x' || k === 'y' ? v[k] : walk(v[k]) })
    return o
  }
  return v
}

export function parseLoose(text) {
  return walk(parseRaw(text))
}
