// RADIUS maths guard. Plain code, runs in a few milliseconds, never calls the AI,
// so it adds no thinking time.
//
//  1. verifiedFacts(question): for problems where the maths is fixed (Miller
//     indices from intercepts, thin lens, simply supported beam, resistors in
//     series or parallel) it works out the exact answer from the student's own
//     numbers. The text goes into the AI's instructions, so every run gives the
//     same correct numbers. It returns '' unless it is sure of what it read.
//  2. auditArithmetic(reply): re-calculates the plain number lines in a worked
//     solution (like "13.75 x 6 = 82.4") and reports the ones that do not add up.

const num = (s) => Number(String(s).replace(/,/g, ''))
const fmt = (n, dp = 2) => {
  if (!Number.isFinite(n)) return String(n)
  const r = Math.round(n * 10 ** dp) / 10 ** dp
  return String(Object.is(r, -0) ? 0 : r)
}
const sig = (n, s = 4) => String(Number(n.toPrecision(s)))
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a))
const lcm = (a, b) => Math.abs(a * b) / gcd(a, b)

// ---------------------------------------------------------------------------
// 1. Exact answers
// ---------------------------------------------------------------------------
function toFraction(x) {
  // x is a finite number such as 0.5 or 1.5; returns [numerator, denominator]
  for (let d = 1; d <= 1000; d++) {
    const n = Math.round(x * d)
    if (Math.abs(n / d - x) < 1e-9) return [n, d]
  }
  return null
}

function parseIntercept(tok) {
  const t = String(tok).trim().replace(/[a-c]$/i, '').replace(/\s+/g, '')
  if (/^(?:\\infty|\u221E|inf|infinity)$/i.test(t)) return Infinity
  const f = /^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/.exec(t)
  if (f) return Number(f[1]) / Number(f[2])
  if (/^-?\d+(?:\.\d+)?$/.test(t)) return Number(t)
  return NaN
}

function millerFacts(q) {
  if (!/miller|crystal|lattice|unit cell|\bplanes?\b/i.test(q) || !/intercept/i.test(q)) return null
  const lines = []
  const TOK = '(-?[\\d./]+\\s*[a-c]?|\\\\infty|\\u221E|infinity|inf)'
  const re = new RegExp('intercepts?[^.\\n]{0,80}?(?:at|of|are|=|:|\\()\\s*\\(?\\s*' + TOK + '\\s*(?:,|and|;)\\s*' + TOK + '\\s*(?:,|and|;)\\s*' + TOK, 'i')
  const m = re.exec(q)
  if (m) {
    const v = [m[1], m[2], m[3]].map(parseIntercept)
    if (v.every((x) => !Number.isNaN(x)) && v.some((x) => Number.isFinite(x) && x !== 0) && v.every((x) => x !== 0)) {
      const recips = v.map((x) => (x === Infinity ? 0 : 1 / x))
      const fr = recips.map((x) => toFraction(x))
      if (fr.every(Boolean)) {
        const L = fr.reduce((a, [, d]) => lcm(a, d), 1)
        let ints = fr.map(([n, d]) => (n * L) / d)
        const g = ints.reduce((a, b) => gcd(a, b), 0) || 1
        ints = ints.map((x) => x / g)
        lines.push(`The plane's Miller indices are (hkl) = (${ints.join(' ')}). Intercept reciprocals are (${recips.map((x) => fmt(x, 4)).join(', ')}) before clearing fractions. Any diagram must use h=${ints[0]}, k=${ints[1]}, l=${ints[2]}.`)
        const a = /(?:lattice (?:parameter|constant)|\ba\b)\s*(?:=|of|is)?\s*(\d+(?:\.\d+)?)\s*(\u00C5|A\b|\u00E5|nm|pm)/i.exec(q)
        if (a && /cubic|cube|sc\b|fcc|bcc/i.test(q + ' ')) {
          const dsp = Number(a[1]) / Math.sqrt(ints.reduce((s, x) => s + x * x, 0))
          lines.push(`For a cubic lattice with a = ${a[1]} ${a[2]}, the spacing d_hkl = a / sqrt(h^2 + k^2 + l^2) = ${sig(dsp)} ${a[2]}.`)
        }
      }
    }
  }
  return lines.length ? lines : null
}

function lensFacts(q) {
  if (!/\blens\b/i.test(q) || /\bmirror\b/i.test(q)) return null
  const f = /\bf\s*=\s*(-?\d+(?:\.\d+)?)\s*(cm|mm|m)\b|focal length[^\d-]{0,25}(-?\d+(?:\.\d+)?)\s*(cm|mm|m)\b/i.exec(q)
  const u = /\bu\s*=\s*(-?\d+(?:\.\d+)?)\s*(cm|mm|m)\b|object (?:distance|is placed|placed)[^\d-]{0,30}(-?\d+(?:\.\d+)?)\s*(cm|mm|m)\b/i.exec(q)
  if (!f || !u) return null
  const unit = (f[2] || f[4]).toLowerCase()
  if (unit !== (u[2] || u[4]).toLowerCase()) return null
  let fv = Math.abs(num(f[1] || f[3]))
  const uv = Math.abs(num(u[1] || u[3]))
  const diverging = /diverging|concave lens/i.test(q) || num(f[1] || f[3]) < 0
  if (diverging) fv = -fv
  if (!fv || !uv) return null
  if (Math.abs(uv - fv) < 1e-9) return [`Object at the focal point: the image forms at infinity.`]
  const v = (fv * uv) / (uv - fv) // real-is-positive: 1/v = 1/f - 1/u
  const m = -v / uv
  const nature = v > 0 ? 'real and inverted' : 'virtual and upright (same side as the object)'
  return [`Thin lens (1/f = 1/v + 1/u, real-is-positive): image distance |v| = ${sig(Math.abs(v))} ${unit}, magnification |m| = ${sig(Math.abs(m))}, image is ${nature}.`]
}

function beamFacts(q) {
  if (!/simply[- ]supported/i.test(q)) return null
  if (/overhang|cantilever|fixed|moment|couple|triangular|varying|uvl|inclined|hinge|continuous|three supports|\bfrom (?:support )?B\b|from the right/i.test(q)) return null
  const L = /(?:span|length|long)\D{0,12}?(\d+(?:\.\d+)?)\s*m\b|(\d+(?:\.\d+)?)\s*m\s*(?:long|span)/i.exec(q)
  if (!L) return null
  const len = num(L[1] || L[2])
  if (!(len > 0)) return null
  const loads = []
  let rest = q
  const udl = /(\d+(?:\.\d+)?)\s*kN\s*\/\s*m/gi
  let um
  while ((um = udl.exec(q))) {
    // the words that describe this load, up to "and", a comma or a full stop
    const tail = q.slice(um.index + um[0].length, um.index + um[0].length + 80).split(/\band\b|[,;]|\.(?!\d)|\n/i)[0]
    const seg = um[0] + tail
    const w = num(um[1])
    let from = 0
    let to = len
    const r = /(?:from|between)\s*(\d+(?:\.\d+)?)\s*m?\s*(?:to|and)\s*(\d+(?:\.\d+)?)\s*m/i.exec(q.slice(um.index, um.index + um[0].length + 80))
    if (r) { from = num(r[1]); to = num(r[2]) } else if (!/entire|whole|full|over the span|across|throughout|total/i.test(seg)) return null
    if (!(to > from) || to > len + 1e-9) return null
    loads.push({ P: w * (to - from), x: (from + to) / 2 })
    rest = rest.replace(seg, ' ')
  }
  const pt = /(\d+(?:\.\d+)?)\s*kN(?!\s*\/|\s*m\b|\s*\.m)[^.\n]{0,40}?(?:at|@)\s*(\d+(?:\.\d+)?)\s*m\b/gi
  let pm
  while ((pm = pt.exec(rest))) {
    const x = num(pm[2])
    if (x < 0 || x > len + 1e-9) return null
    loads.push({ P: num(pm[1]), x })
  }
  if (!loads.length) return null
  // Every kN figure in the text must have been understood, or we stay silent.
  const kn = (q.match(/\d+(?:\.\d+)?\s*kN(?!\s*\/\s*m|\s*m\b)/gi) || []).length
  const knm = (q.match(/\d+(?:\.\d+)?\s*kN\s*\/\s*m/gi) || []).length
  const pointCount = loads.length - (q.match(/\d+(?:\.\d+)?\s*kN\s*\/\s*m/gi) || []).length
  if (pointCount !== kn || knm !== loads.length - pointCount) return null
  const total = loads.reduce((s, l) => s + l.P, 0)
  const RB = loads.reduce((s, l) => s + l.P * l.x, 0) / len
  const RA = total - RB
  return [`Simply supported beam, span ${fmt(len, 3)} m, supports at both ends (A at the left end, B at the right end), loads measured from A. Total load ${fmt(total, 3)} kN. Reactions (upward): R_A = ${fmt(RA, 3)} kN and R_B = ${fmt(RB, 3)} kN. Any diagram must show these loads and supports.`]
}

function resistorFacts(q) {
  const series = /\bseries\b/i.test(q)
  const parallel = /\bparallel\b/i.test(q)
  if (series === parallel) return null
  if (/internal resistance|emf|capacitor|inductor|bridge|wheatstone|delta|star|\bY\b|and then|connected to|combined with/i.test(q)) return null
  const vals = [...q.matchAll(/(\d+(?:\.\d+)?)\s*(?:\u03A9|\u2126|ohms?|\bR\b)/gi)].map((m) => num(m[1]))
  if (vals.length < 2 || vals.some((v) => !(v > 0))) return null
  const req = series ? vals.reduce((a, b) => a + b, 0) : 1 / vals.reduce((a, b) => a + 1 / b, 0)
  const lines = [`${vals.length} resistors (${vals.join(', ')} ohms) in ${series ? 'series' : 'parallel'}: equivalent resistance R_eq = ${sig(req)} ohms.`]
  const V = /(\d+(?:\.\d+)?)\s*V\b(?!\s*\/)/.exec(q)
  if (V) {
    const v = num(V[1])
    const I = v / req
    lines.push(`With a ${v} V supply the total current is ${sig(I)} A. ${series ? 'Voltage across each resistor: ' + vals.map((r) => `${sig(I * r)} V`).join(', ') : 'Current in each branch: ' + vals.map((r) => `${sig(v / r)} A`).join(', ')} (in the order given).`)
  }
  return lines
}

export function verifiedFacts(question) {
  try {
    const q = String(question || '').replace(/^\[The student is replying to [\s\S]*?"\]\s*/i, '').slice(0, 4000)
    if (!q.trim()) return ''
    const all = []
    for (const fn of [millerFacts, lensFacts, beamFacts, resistorFacts]) {
      try { const r = fn(q); if (r) all.push(...r) } catch (e) { /* skip this one */ }
    }
    if (!all.length) return ''
    return `VERIFIED RESULTS (calculated exactly by RADIUS's own calculator from the numbers in the student's message). These are correct: use them exactly, and make every step, the final answer and any drawing agree with them. Show the method as normal. If the student's problem clearly differs from the assumptions stated here, ignore this block.\n${all.map((l) => '- ' + l).join('\n')}`
  } catch (e) {
    return ''
  }
}

// ---------------------------------------------------------------------------
// 2. Re-checking the number lines of a worked solution
// ---------------------------------------------------------------------------
function evalNumeric(src) {
  const s = String(src).replace(/\s+/g, '')
  let i = 0
  const fail = () => { throw new Error('x') }
  function expr() {
    let v = term()
    while (s[i] === '+' || s[i] === '-') { const op = s[i++]; const r = term(); v = op === '+' ? v + r : v - r }
    return v
  }
  function term() {
    let v = power()
    for (;;) {
      if (s[i] === '*') { i++; v *= power() } else if (s[i] === '/') { i++; v /= power() } else if (s[i] === '(' || s.startsWith('pi', i) || s.startsWith('sqrt', i)) v *= power()
      else return v
    }
  }
  function power() {
    const b = unary()
    if (s[i] === '^') { i++; return Math.pow(b, power()) }
    return b
  }
  function unary() {
    if (s[i] === '-') { i++; return -unary() }
    if (s[i] === '+') { i++; return unary() }
    return atom()
  }
  function atom() {
    if (s[i] === '(') { i++; const v = expr(); if (s[i] !== ')') fail(); i++; return v }
    if (s.startsWith('sqrt', i)) { i += 4; if (s[i] !== '(') fail(); i++; const v = expr(); if (s[i] !== ')') fail(); i++; return Math.sqrt(v) }
    if (s.startsWith('pi', i)) { i += 2; return Math.PI }
    const m = /^(?:\d+\.?\d*|\.\d+)/.exec(s.slice(i))
    if (!m) fail()
    i += m[0].length
    return Number(m[0])
  }
  const v = expr()
  if (i !== s.length || !Number.isFinite(v)) fail()
  return v
}

function topLevelSplit(block) {
  // splits on = and \approx outside braces; returns [{text, op}] where op is the operator before it
  const parts = []
  let depth = 0
  let cur = ''
  let op = ''
  for (let i = 0; i < block.length; i++) {
    const ch = block[i]
    if (ch === '{') depth++
    else if (ch === '}') depth--
    if (depth === 0 && block.startsWith('\\approx', i)) { parts.push({ text: cur, op }); cur = ''; op = '~'; i += 6; continue }
    if (depth === 0 && ch === '\u2248') { parts.push({ text: cur, op }); cur = ''; op = '~'; continue }
    if (depth === 0 && ch === '=' && block[i - 1] !== '\\' && block[i - 1] !== '<' && block[i - 1] !== '>' && block[i - 1] !== '!') { parts.push({ text: cur, op }); cur = ''; op = '='; continue }
    cur += ch
  }
  parts.push({ text: cur, op })
  return parts
}

function cleanSegment(raw) {
  let s = raw
  const units = []
  s = s.replace(/\\(?:text|mathrm|textbf)\{([^}]*)\}(\s*\^\{?-?\d+\}?)?/g, (m, u, p) => { units.push(u + (p || '')); return ' ' })
  const unit = units.join('').replace(/\s+/g, '')
  if (/%|\\%|\\circ|\\degree|\\infty|\\pm|\\mp|\\le|\\ge|\\neq|<|>/.test(s)) return { numeric: false }
  s = s.replace(/\\(?:left|right|quad|qquad|displaystyle|boxed)|\\[,;:!]|~/g, ' ').replace(/\\boxed/g, ' ')
  for (let k = 0; k < 8 && /\\frac\{/.test(s); k++) s = s.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))')
  s = s.replace(/\\sqrt\{([^{}]*)\}/g, 'sqrt($1)')
    .replace(/\\times|\\cdot|\u00D7|\u00B7/g, '*').replace(/\\div|\u00F7/g, '/')
    .replace(/\\pi|\u03C0/g, 'pi').replace(/[\u2212\u2013]/g, '-')
    .replace(/\^\{([^{}]*)\}/g, '^($1)').replace(/[{}]/g, (c) => (c === '{' ? '(' : ')'))
    .replace(/(\d),(\d{3})(?!\d)/g, '$1$2')
  s = s.replace(/\\\s/g, ' ').trim()
  if (!s) return { numeric: false }
  const letters = s.replace(/sqrt|pi/g, '')
  if (/[A-Za-z\\_&]/.test(letters)) return { numeric: false }
  let value
  try { value = evalNumeric(s) } catch (e) { return { numeric: false } }
  const plain = /^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(s.replace(/\s+/g, ''))
  const dp = plain ? (s.split('.')[1] || '').replace(/\D/g, '').length : null
  return { numeric: true, value, unit, plain, dp, hasDec: /\d\.\d/.test(s), text: s.replace(/\s+/g, ' ') }
}

export function auditArithmetic(reply) {
  const out = []
  try {
    const noCode = String(reply || '').replace(/```[\s\S]*?```/g, ' ')
    const blocks = [...noCode.matchAll(/\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]/g)].map((m) => (m[1] != null ? m[1] : m[2])).slice(0, 80)
    for (const block of blocks) {
      const segs = topLevelSplit(block.replace(/\\\\/g, ' ')).map((p) => ({ ...p, c: cleanSegment(p.text) }))
      for (let i = 1; i < segs.length; i++) {
        const a = segs[i - 1].c
        const b = segs[i].c
        if (!a.numeric || !b.numeric) continue
        if (a.unit && b.unit && a.unit !== b.unit) continue // e.g. 5 km = 5000 m
        const approx = segs[i].op === '~'
        let tol = Math.max(Math.abs(a.value), Math.abs(b.value)) * 1e-6 + 1e-9
        for (const s of [a, b]) if (s.plain) tol = Math.max(tol, 0.5 * 10 ** -s.dp * 1.0001)
        // Rounded decimals in working (80.86 - 3.32 - 18.77 = 58.77, or 6.67 x 10^-4) are not mistakes: allow 0.3%.
        if (a.hasDec || b.hasDec) tol = Math.max(tol, Math.max(Math.abs(a.value), Math.abs(b.value)) * 0.003)
        if (approx) tol = Math.max(tol, Math.max(Math.abs(a.value), Math.abs(b.value)) * 0.011)
        if (Math.abs(a.value - b.value) > tol) {
          out.push({ line: `${a.text} = ${b.text}`, stated: b.text, computed: sig(a.value, 6), statedValue: sig(b.value, 6) })
        }
      }
    }
  } catch (e) { return [] }
  return out
}

// One short, friendly line for the student, or '' when everything adds up.
export function arithmeticNote(slips) {
  if (!slips || !slips.length) return ''
  const s = slips[0]
  const plain = !/[()]{2}/.test(s.line) && s.line.length <= 40
  const detail = plain
    ? `${s.line.replace(/\s*\*\s*/g, ' \u00D7 ')} works out to ${sig(Number(s.computed), 4)}`
    : `one line says ${s.stated} but its own numbers give ${sig(Number(s.computed), 4)}`
  return `\n\n_Quick check: ${detail}${slips.length > 1 ? ' (and one more step to check)' : ''}. If the final answer looks off, tap Regenerate._`
}
