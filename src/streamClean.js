// Tidies the text of a reply WHILE it is still being written, so the student never sees
// half-finished code on screen. Used only for the live preview: the finished reply is
// always drawn from the full, checked text.
//
//   - Drawings (```diagram, ```graph, ```svg and raw JSON drawings) are replaced by one
//     short line until the final version is ready.
//   - A formula that is still being typed is held back until it is complete, because a
//     half-written formula is shown by the maths renderer as raw amber code.
//
// Pure text in, text out. No speed cost: it runs on the phone, on text already received.

const DRAW_NOTE = '\n\n_Drawing the figure..._\n\n'
const DRAW_LIKE = /"(?:type|kind|series|curves|lines|points|xlabel|ylabel|x_axis|y_axis|elements|title)"\s*:/

function noteFor(lang) {
  return lang === 'graph' ? '\n\n_Drawing the graph..._\n\n' : DRAW_NOTE
}

// ```diagram / ```graph / ```svg blocks, finished or not. A ```json block only counts when
// it looks like a drawing, so real JSON examples are left alone.
function hideFences(t) {
  let out = t.replace(/```(diagram|graph|svg|json)[^\n]*\n([\s\S]*?)(```|$)/g, (m, lang, body) => {
    if (lang === 'json' && !DRAW_LIKE.test(body)) return m
    return noteFor(lang)
  })
  // A fence whose language word is still being typed: "```", "```gra"
  out = out.replace(/```[a-z]{0,8}$/i, (m) => (/^```(d|di|dia|diag|diagr|diagra|g|gr|gra|grap|s|sv|js|jso|json)?$/i.test(m) ? '' : m))
  return out
}

// A drawing the model wrote without any fence: a line that starts with { and a drawing key.
function hideLooseJson(t) {
  const re = /(^|\n)[ \t]*\{[ \t\r\n]*"(?:type|kind|diagram|graph|series|title)"/g
  let m
  let out = ''
  let last = 0
  while ((m = re.exec(t)) !== null) {
    const start = m.index + (m[1] ? m[1].length : 0)
    const braceAt = t.indexOf('{', start)
    let depth = 0
    let inStr = false
    let esc = false
    let end = -1
    for (let i = braceAt; i < t.length; i++) {
      const ch = t[i]
      if (inStr) {
        if (esc) esc = false
        else if (ch === '\\') esc = true
        else if (ch === '"') inStr = false
        continue
      }
      if (ch === '"') inStr = true
      else if (ch === '{') depth++
      else if (ch === '}') { depth--; if (depth === 0) { end = i + 1; break } }
    }
    out += t.slice(last, start) + DRAW_NOTE
    if (end === -1) { last = t.length; break } // still being written: hide everything to the end
    last = end
    re.lastIndex = end
  }
  return out + t.slice(last)
}

// Cuts the text back to just before a formula that has not been closed yet.
function holdBackOpenMath(t) {
  const noCode = t.replace(/```[\s\S]*?```/g, (m) => ' '.repeat(m.length))
  // Same length as t, so positions found here are valid in t.
  const dd = []
  for (let i = 0; i < noCode.length - 1; i++) if (noCode[i] === '$' && noCode[i + 1] === '$') { dd.push(i); i++ }
  if (dd.length % 2 === 1) return t.slice(0, dd[dd.length - 1]).trimEnd()

  const count = (re) => (noCode.match(re) || []).length
  if (count(/\\\[/g) > count(/\\\]/g)) return t.slice(0, noCode.lastIndexOf('\\[')).trimEnd()
  if (count(/\\\(/g) > count(/\\\)/g)) return t.slice(0, noCode.lastIndexOf('\\(')).trimEnd()

  // Single $ ... $ inside a sentence. Only hold back when the open part is short, so a
  // price such as "$50" never hides a long stretch of text.
  const singles = []
  for (let i = 0; i < noCode.length; i++) {
    if (noCode[i] === '$' && noCode[i - 1] !== '$' && noCode[i + 1] !== '$' && noCode[i - 1] !== '\\') singles.push(i)
  }
  if (singles.length % 2 === 1) {
    const at = singles[singles.length - 1]
    if (noCode.length - at < 300) return t.slice(0, at).trimEnd()
  }
  return t
}

export function tidyStreaming(text) {
  let t = String(text || '')
  t = hideFences(t)
  t = hideLooseJson(t)
  t = holdBackOpenMath(t)
  return t
}
