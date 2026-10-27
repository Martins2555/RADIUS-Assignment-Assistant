// Small text repairs applied to every reply before it is shown.

// Some AI models write maths as \[ ... \] and \( ... \), or as a bare [ ... ]
// line. The markdown reader turns \[ into a plain "[" (that is where stray
// brackets and "random jargon" come from). Convert all of these to $$ ... $$
// and $ ... $, which the maths renderer understands.
// Inside a formula ";:;" is never intended (it comes from lost \; \: spacing).
const tidyMath = (x) => x.trim().replace(/\s*;:;\s*/g, ' \\quad ')

export function fixMath(text) {
  const src = String(text || '')
  if (!/\\[[(]|^\s*\[/m.test(src)) return src
  // Never touch code: split it out and put it back unchanged.
  const parts = src.split(/(```[\s\S]*?(?:```|$)|`[^`\n]*`)/g)
  return parts
    .map((p, i) => {
      if (i % 2 === 1) return p
      return p
        .replace(/(^|[^\\])\\\[([\s\S]*?)\\\]/g, (m, pre, x) => `${pre}\n\n$$\n${tidyMath(x)}\n$$\n\n`)
        .replace(/(^|[^\\])\\\(([\s\S]*?)\\\)/g, (m, pre, x) => `${pre}$${tidyMath(x)}$`)
        // a whole line, or a few lines, wrapped in bare [ ] that contain LaTeX commands
        .replace(/^[ \t]*\[[ \t]*\n([\s\S]*?\\[a-zA-Z]+[\s\S]*?)\n[ \t]*\][ \t]*$/gm, (m, x) => `\n$$\n${tidyMath(x)}\n$$\n`)
        .replace(/^[ \t]*\[[ \t]*([^\n\]]*\\[a-zA-Z]+[^\n]*?)[ \t]*\][ \t]*$/gm, (m, x) => `\n$$\n${tidyMath(x)}\n$$\n`)
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
