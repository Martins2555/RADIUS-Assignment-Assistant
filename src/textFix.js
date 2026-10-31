// Small text repairs applied to every reply before it is shown.

// Some AI models write maths as \[ ... \] and \( ... \), or as a bare [ ... ]
// line. The markdown reader turns \[ into a plain "[" (that is where stray
// brackets and "random jargon" come from). Convert all of these to $$ ... $$
// and $ ... $, which the maths renderer understands.
// Inside a formula ";:;" is never intended (it comes from lost \; \: spacing).
const tidyMath = (x) => x.trim().replace(/\s*;:;\s*/g, ' \\quad ')

// KaTeX cannot read a command such as \uparrow inside \text{...} and paints
// it as a yellow error. Swap those for the real symbol.
const TEXT_SYMBOLS = { uparrow: '\u2191', downarrow: '\u2193', rightarrow: '\u2192', leftarrow: '\u2190', circ: '\u00B0', degree: '\u00B0', times: '\u00D7', cdot: '\u00B7', Omega: '\u03A9', mu: '\u00B5', pm: '\u00B1', approx: '\u2248' }
function fixTextCommands(s) {
  return s.replace(/\\(text|mathrm|textrm|mbox)\{([^{}]*)\}/g, (m, cmd, inner) => {
    if (!inner.includes('\\')) return m
    const fixed = inner.replace(/\\([A-Za-z]+)\s?/g, (mm, name) => (TEXT_SYMBOLS[name] ? TEXT_SYMBOLS[name] : mm))
    return fixed.includes('\\') ? m : `\\${cmd}{${fixed}}`
  })
}

// Splits "A = B = C" into aligned lines so each new expression starts on a new
// line. Only touches plain equation chains; anything already laid out is kept.
function splitEquals(x) {
  const body = x.trim()
  if (/\\begin|\\\\|&|\\(?:Rightarrow|implies|therefore|because|quad|qquad|text\{\s*(?:and|or)\b)/.test(body)) return body
  const idx = []
  let depth = 0
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    if (ch === '\\') { i++; continue }
    if ('{(['.includes(ch)) depth++
    else if ('})]'.includes(ch)) depth--
    else if (depth === 0 && ch === ',') return body
    else if (depth === 0 && ch === '=' && body[i - 1] !== '<' && body[i - 1] !== '>' && body[i + 1] !== '=') idx.push(i)
  }
  if (idx.length < 2) return body
  const pieces = []
  let last = 0
  idx.forEach((i) => { pieces.push(body.slice(last, i).trim()); last = i + 1 })
  pieces.push(body.slice(last).trim())
  if (pieces.some((q, k) => !q && k > 0)) return body
  const lines = pieces.map((q, k) => (k === 0 ? `${q} &= ${pieces[1]}` : k === 1 ? null : `&= ${q}`)).filter(Boolean)
  return `\\begin{aligned}\n${lines.join(' \\\\\n')}\n\\end{aligned}`
}

// A line that is only maths ($...$ or $$...$$) becomes its own display
// equation. Markdown joins neighbouring lines into one paragraph, which is
// what ran whole solutions together on one line.
function layoutMath(chunk) {
  let s = chunk
  // $$ ... $$ blocks (one line or many): own paragraph, equals chains split.
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (m, x) => `\n\n$$\n${splitEquals(tidyMath(x))}\n$$\n\n`)
  // A whole line that is a single inline $...$ (optionally ending . or ,)
  s = s.replace(/^[ \t]*\$([^$\n]+)\$[ \t]*[.,;]?[ \t]*$/gm, (m, x) => `\n\n$$\n${splitEquals(tidyMath(x))}\n$$\n\n`)
  return s.replace(/\n{3,}/g, '\n\n')
}

export function fixMath(text) {
  const src = String(text || '')
  // Never touch code: split it out and put it back unchanged.
  const parts = src.split(/(```[\s\S]*?(?:```|$)|`[^`\n]*`)/g)
  return parts
    .map((p, i) => {
      if (i % 2 === 1) return p
      const fixed = p
        .replace(/(^|[^\\])\\\[([\s\S]*?)\\\]/g, (m, pre, x) => `${pre}\n\n$$\n${tidyMath(x)}\n$$\n\n`)
        .replace(/(^|[^\\])\\\(([\s\S]*?)\\\)/g, (m, pre, x) => `${pre}$${tidyMath(x)}$`)
        // a whole line, or a few lines, wrapped in bare [ ] that contain LaTeX commands
        .replace(/^[ \t]*\[[ \t]*\n([\s\S]*?\\[a-zA-Z]+[\s\S]*?)\n[ \t]*\][ \t]*$/gm, (m, x) => `\n$$\n${tidyMath(x)}\n$$\n`)
        .replace(/^[ \t]*\[[ \t]*([^\n\]]*\\[a-zA-Z]+[^\n]*?)[ \t]*\][ \t]*$/gm, (m, x) => `\n$$\n${tidyMath(x)}\n$$\n`)
      return layoutMath(fixTextCommands(fixed))
    })
    .join('')
}

// The hidden [TYPE:...] tag belongs at the very start only. Remove any copy
// that ended up in the middle of a reply.
export function stripStrayTags(text) {
  return String(text || '').replace(/\[TYPE:(ASSIGNMENT|GENERAL)\]\s*/gi, '')
}

export function fixText(text) {
  return fixMath(stripStrayTags(text))
}
