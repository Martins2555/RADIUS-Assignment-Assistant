// Forgiving JSON reader for drawings and graphs.
// The AI does not always write perfect JSON. This reads what it wrote anyway:
// code fences, // and /* */ comments, trailing commas, single quotes, curly
// quotes, unquoted keys, True/False/None, and words after the closing brace.
// parseLoose(text) returns the value, or throws an Error with a short reason.

const SMART = { '\u201C': '"', '\u201D': '"', '\u201E': '"', '\u2018': "'", '\u2019': "'" }

function stripFence(s) {
  let t = String(s == null ? '' : s).replace(/^\uFEFF/, '').trim()
  const m = /^```[\w-]*[ \t]*\r?\n?([\s\S]*?)(?:\r?\n?```[\s\S]*)?$/.exec(t)
  if (m && t.startsWith('```')) t = m[1].trim()
  return t
}

export function parseLoose(input) {
  const src = stripFence(input)
  let i = src.search(/[{[]/)
  if (i < 0) throw new Error('no JSON found')
  const n = src.length

  const fail = (msg) => { throw new Error(msg || 'bad JSON') }
  const isWs = (ch) => ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t' || ch === '\u00A0'

  function skip() {
    for (;;) {
      while (i < n && isWs(src[i])) i++
      if (src[i] === '/' && src[i + 1] === '/') {
        while (i < n && src[i] !== '\n') i++
      } else if (src[i] === '/' && src[i + 1] === '*') {
        const end = src.indexOf('*/', i + 2)
        if (end < 0) fail('unfinished comment')
        i = end + 2
      } else return
    }
  }

  function str() {
    let q = src[i]
    if (SMART[q]) q = SMART[q]
    const closers = q === '"' ? ['"', '\u201C', '\u201D', '\u201E'] : ["'", '\u2018', '\u2019']
    i++
    let out = ''
    while (i < n) {
      const ch = src[i]
      if (ch === '\\') {
        const nx = src[i + 1]
        i += 2
        if (nx === 'n') out += '\n'
        else if (nx === 't') out += '\t'
        else if (nx === 'r') out += '\r'
        else if (nx === 'b') out += '\b'
        else if (nx === 'f') out += '\f'
        else if (nx === 'u') {
          const hex = src.slice(i, i + 4)
          if (/^[0-9a-fA-F]{4}$/.test(hex)) { out += String.fromCharCode(parseInt(hex, 16)); i += 4 } else out += '\\u'
        } else if (nx === undefined) fail('unfinished text')
        else if (nx === '\n') { /* line continuation */ }
        // An unknown escape such as \Omega or \( keeps its backslash, so maths survives.
        else if ('"\'\\/'.includes(nx)) out += nx
        else out += '\\' + nx
        continue
      }
      if (closers.includes(ch)) { i++; return out }
      out += ch
      i++
    }
    return fail('unfinished text')
  }

  function num() {
    const m = /^[+-]?(?:Infinity|NaN|0[xX][0-9a-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/.exec(src.slice(i))
    if (!m) fail('bad number')
    i += m[0].length
    const v = Number(m[0])
    return Number.isFinite(v) ? v : null
  }

  function word() {
    const m = /^[A-Za-z_$][\w$-]*/.exec(src.slice(i))
    if (!m) fail('unexpected "' + (src[i] || 'end') + '"')
    i += m[0].length
    const w = m[0]
    if (w === 'true' || w === 'True') return true
    if (w === 'false' || w === 'False') return false
    if (w === 'null' || w === 'None' || w === 'undefined' || w === 'NaN') return null
    if (w === 'Infinity') return null
    return w
  }

  function value() {
    skip()
    const ch = src[i]
    if (ch === undefined) fail('unfinished JSON')
    if (ch === '{') return obj()
    if (ch === '[') return arr()
    if (ch === '"' || ch === "'" || SMART[ch]) return str()
    if (/[-+.\d]/.test(ch)) return num()
    return word()
  }

  function key() {
    skip()
    const ch = src[i]
    if (ch === '"' || ch === "'" || SMART[ch]) return str()
    const m = /^[A-Za-z_$][\w$]*|^\d+/.exec(src.slice(i))
    if (!m) fail('bad key')
    i += m[0].length
    return m[0]
  }

  function obj() {
    const o = {}
    i++
    for (;;) {
      skip()
      if (i >= n) fail('unfinished JSON')
      if (src[i] === '}') { i++; return o }
      if (src[i] === ',') { i++; continue }
      const k = key()
      skip()
      if (src[i] !== ':') fail('missing ":"')
      i++
      o[k] = value()
      skip()
      if (src[i] === ',') i++
      else if (src[i] !== '}') {
        if (i >= n) fail('unfinished JSON')
        fail('missing ","')
      }
    }
  }

  function arr() {
    const a = []
    i++
    for (;;) {
      skip()
      if (i >= n) fail('unfinished JSON')
      if (src[i] === ']') { i++; return a }
      if (src[i] === ',') { i++; continue }
      a.push(value())
      skip()
      if (src[i] === ',') i++
      else if (src[i] !== ']') {
        if (i >= n) fail('unfinished JSON')
        fail('missing ","')
      }
    }
  }

  return value()
}

export default parseLoose
