import { useEffect, useMemo, useRef, useState } from 'react'
import { renderDiagram, prepareFreeSvg, inferType, DIAGRAM_TYPES } from './diagrams.js'
import { renderGraph } from './graphs.js'
import { parseLoose } from './jsonLoose.js'
import { canonicalizeDrawings, normalizeSpec } from './drawingExtract.js'

// Fenced code blocks in a reply (```diagram, ```graph, ```svg) are drawn by
// these components instead of being shown as code.

export const DIAGRAM_FENCE_RE = /```(?:diagram|graph|svg)[^\n]*\n[\s\S]*?(?:```|$)/g


// Puts any drawing the AI wrote (fenced or not, pretty-printed or not) into one
// clean block that is always drawn. The same code runs on the server.
export function normalizeDrawings(text) {
  return canonicalizeDrawings(text)
}

// For copy / share / history: replace each drawing with a short note.
export function stripDiagrams(text, note = '[Diagram]') {
  return String(text || '').replace(DIAGRAM_FENCE_RE, note).replace(/\n{3,}/g, '\n\n')
}

function paletteFrom(c) {
  return { text: c.text, sub: c.subtext, accent: c.accent, bg: c.surfaceAlt, grid: c.border }
}

function looksIncomplete(kind, source) {
  const t = source.trim()
  if (kind === 'svg') return !/<\/svg>\s*$/i.test(t)
  return !t.endsWith('}')
}

// Downloads use a clean white page with dark ink, so the picture is easy to
// read, print or paste into an assignment whatever theme the app is in.
const EXPORT_PAL = { text: '#111827', sub: '#4b5563', accent: '#16a34a', bg: '#ffffff', grid: '#d1d5db' }

// The drawing as a standalone SVG file at a given pixel scale, on a white page.
function exportSvg(out, scale) {
  const w = Math.round(out.width * scale)
  const h = Math.round(out.height * scale)
  let s = String(out.svg)
  const root = /<svg[^>]*>/.exec(s)
  if (!root) throw new Error('no drawing')
  let tag = root[0].replace(/\swidth="[^"]*"/, '').replace(/\sheight="[^"]*"/, '').replace('<svg', `<svg width="${w}" height="${h}"`)
  if (!/\sxmlns=/.test(tag)) tag = tag.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
  s = s.replace(root[0], tag + '<rect width="100%" height="100%" fill="#ffffff"/>')
  return s
}

async function toImageBlob(out, format, scale) {
  const w = Math.round(out.width * scale)
  const h = Math.round(out.height * scale)
  const url = URL.createObjectURL(new Blob([exportSvg(out, scale)], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const img = await new Promise((resolve, reject) => {
      const im = new Image()
      im.onload = () => resolve(im)
      im.onerror = () => reject(new Error('image'))
      im.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, format === 'jpg' ? 'image/jpeg' : 'image/png', 0.95))
    if (!blob) throw new Error('no image')
    return blob
  } finally {
    URL.revokeObjectURL(url)
  }
}

function saveBlob(blob, filename) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

function Frame({ c, children }) {
  return (
    <div data-noswipe="true" style={{ margin: '0.55rem 0 0.7rem', borderRadius: '14px', border: `1px solid ${c.border}`, backgroundColor: c.surfaceAlt, overflow: 'hidden' }}>
      {children}
    </div>
  )
}

function Note({ c, text }) {
  return <Frame c={c}><div style={{ padding: '0.9rem 1rem', fontSize: '0.84rem', color: c.subtext }}>{text}</div></Frame>
}

function Bar({ c, children, status }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.35rem 0.6rem 0.55rem', flexWrap: 'wrap' }}>
      {children}
      {status ? <span style={{ fontSize: '0.74rem', color: c.subtext }}>{status}</span> : null}
    </div>
  )
}

function SmallBtn({ c, onClick, active, children, label }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{ padding: '0.32rem 0.75rem', borderRadius: '16px', border: `1.5px solid ${active ? c.accent : c.border}`, backgroundColor: active ? c.accentSoft : 'transparent', color: c.text, fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', minWidth: '34px' }}
    >
      {children}
    </button>
  )
}

// "Download" opens a small choice of file types. getOut() draws the picture
// again in the printable colours and returns { svg, width, height }.
function DownloadControl({ c, name, getOut }) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState('')
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  const run = async (format) => {
    setStatus('Preparing...')
    try {
      const out = getOut()
      const file = `${name}-${new Date().toISOString().slice(0, 10)}.${format}`
      const blob = format === 'svg'
        ? new Blob([exportSvg(out, 1)], { type: 'image/svg+xml' })
        : await toImageBlob(out, format, Math.max(2, Math.min(4, 1800 / out.width)))
      saveBlob(blob, file)
      setStatus(`Downloaded ${format.toUpperCase()}`)
      setOpen(false)
    } catch (e) {
      setStatus('Please try again')
    }
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setStatus(''), 2500)
  }
  return (
    <>
      <SmallBtn c={c} active={open} label="Download this picture" onClick={() => setOpen((v) => !v)}>Download</SmallBtn>
      {open && ['png', 'jpg', 'svg'].map((f) => <SmallBtn key={f} c={c} label={`Download as ${f.toUpperCase()}`} onClick={() => run(f)}>{f.toUpperCase()}</SmallBtn>)}
      {status ? <span style={{ fontSize: '0.74rem', color: c.subtext }}>{status}</span> : null}
    </>
  )
}

function DiagramView({ out, c, name, print, getOut }) {
  return (
    <Frame c={c}>
      <div style={{ padding: '0.6rem 0.4rem 0' }} dangerouslySetInnerHTML={{ __html: out.svg }} />
      {!print && (
        <Bar c={c}>
          <DownloadControl c={c} name={name} getOut={getOut} />
        </Bar>
      )}
    </Frame>
  )
}

function GraphView({ spec, c, print }) {
  const pal = useMemo(() => paletteFrom(c), [c.text, c.subtext, c.accent, c.surfaceAlt, c.border])
  const [view, setView] = useState(null)
  const [explore, setExplore] = useState(false)
  const boxRef = useRef(null)
  const viewRef = useRef(null)
  const ptrs = useRef(new Map())
  const pinch = useRef(0)

  const out = useMemo(() => {
    try { return { ok: renderGraph(spec, pal, view) } } catch (e) { return { err: e.message } }
  }, [spec, pal, view])
  viewRef.current = out.ok ? out.ok.view : null
  const geom = out.ok

  const zoomAt = (factor, fx = 0.5, fy = 0.5) => {
    const v = viewRef.current
    if (!v) return
    const rx = v.xmax - v.xmin
    const ry = v.ymax - v.ymin
    const x0 = v.xmin + fx * rx
    const y0 = v.ymax - fy * ry
    const nrx = rx * factor
    const nry = ry * factor
    const ymax = y0 + fy * nry
    setView({ xmin: x0 - fx * nrx, xmax: x0 - fx * nrx + nrx, ymax, ymin: ymax - nry })
  }

  // Mouse wheel zoom needs a non-passive listener to stop the page scrolling.
  useEffect(() => {
    const el = boxRef.current
    if (!el || !explore) return undefined
    const onWheel = (e) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const g = viewRef.current && geom
      if (!g) return
      const sc = r.width / g.width
      const fx = Math.min(1, Math.max(0, ((e.clientX - r.left) / sc - g.plot.x) / g.plot.w))
      const fy = Math.min(1, Math.max(0, ((e.clientY - r.top) / sc - g.plot.y) / g.plot.h))
      zoomAt(Math.exp(e.deltaY * 0.0015), fx, fy)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [explore, geom && geom.width])

  const onDown = (e) => {
    if (!explore) return
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch (err) { /* ignore */ }
    if (ptrs.current.size === 2) {
      const [a, b] = Array.from(ptrs.current.values())
      pinch.current = Math.hypot(a.x - b.x, a.y - b.y)
    }
  }
  const onMove = (e) => {
    if (!explore || !ptrs.current.has(e.pointerId) || !geom) return
    const prev = ptrs.current.get(e.pointerId)
    const r = boxRef.current.getBoundingClientRect()
    const sc = r.width / geom.width
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (ptrs.current.size >= 2) {
      const [a, b] = Array.from(ptrs.current.values())
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      if (pinch.current > 0 && dist > 0) {
        const mx = (a.x + b.x) / 2
        const my = (a.y + b.y) / 2
        const fx = Math.min(1, Math.max(0, ((mx - r.left) / sc - geom.plot.x) / geom.plot.w))
        const fy = Math.min(1, Math.max(0, ((my - r.top) / sc - geom.plot.y) / geom.plot.h))
        zoomAt(pinch.current / dist, fx, fy)
      }
      pinch.current = dist
      return
    }
    const v = viewRef.current
    const dx = ((e.clientX - prev.x) / sc / geom.plot.w) * (v.xmax - v.xmin)
    const dy = ((e.clientY - prev.y) / sc / geom.plot.h) * (v.ymax - v.ymin)
    setView({ xmin: v.xmin - dx, xmax: v.xmax - dx, ymin: v.ymin + dy, ymax: v.ymax + dy })
  }
  const onUp = (e) => {
    ptrs.current.delete(e.pointerId)
    pinch.current = 0
  }

  if (out.err) return null
  return (
    <Frame c={c}>
      <div
        ref={boxRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{ padding: '0.6rem 0.4rem 0', touchAction: explore ? 'none' : 'auto', cursor: explore ? 'grab' : 'default', userSelect: 'none' }}
        dangerouslySetInnerHTML={{ __html: out.ok.svg }}
      />
      {out.ok.caption && <div style={{ padding: '0.15rem 0.8rem 0.55rem', fontSize: '0.74rem', lineHeight: 1.45, color: c.subtext }}>{out.ok.caption}</div>}
      {!print && <Bar c={c} status={explore ? 'Drag to move, pinch to zoom' : ''}>
        <SmallBtn c={c} active={explore} onClick={() => setExplore((v) => !v)}>{explore ? 'Done' : 'Explore'}</SmallBtn>
        {explore && <SmallBtn c={c} label="Zoom in" onClick={() => zoomAt(0.7)}>+</SmallBtn>}
        {explore && <SmallBtn c={c} label="Zoom out" onClick={() => zoomAt(1 / 0.7)}>{'\u2212'}</SmallBtn>}
        {explore && view && <SmallBtn c={c} onClick={() => setView(null)}>Reset</SmallBtn>}
        <DownloadControl c={c} name="radius-graph" getOut={() => renderGraph(spec, EXPORT_PAL, view)} />
      </Bar>}
      {out.ok.notes.length > 0 && <div style={{ padding: '0 0.8rem 0.6rem', fontSize: '0.74rem', color: c.subtext }}>Not drawn: {out.ok.notes.slice(0, 4).join(' ')}</div>}
    </Frame>
  )
}

// Reads and draws one block. partial: also repair a block that was cut off.
function build(kind, source, pal, partial) {
  if (kind === 'svg') {
    try { return { svg: prepareFreeSvg(source, pal), free: true } } catch (e) { return { err: e.message || 'error' } }
  }
  try {
    const spec = normalizeSpec(parseLoose(source, partial ? { partial: true } : undefined))
    const isGraph = kind === 'graph' || inferType(spec) === 'graph' || (spec && !spec.type && spec.points && !spec.parts)
    if (isGraph) {
      renderGraph(spec, pal) // throws when there is nothing to plot
      return { graph: spec }
    }
    return { diagram: renderDiagram(spec, pal), spec }
  } catch (e) {
    return { err: e.message || 'error' }
  }
}

// One drawing from a fenced block. kind: 'diagram' | 'graph' | 'svg' | 'json'
// The student never sees an error here: a drawing is either shown, or (while
// the reply is still arriving) a short "Drawing..." card, or nothing at all.
export function DiagramBlock({ kind, source, c, print }) {
  const pal = useMemo(() => paletteFrom(c), [c.text, c.subtext, c.accent, c.surfaceAlt, c.border])
  const parsed = useMemo(() => build(kind, source, pal, false), [kind, source, pal])
  const incomplete = !!parsed.err && looksIncomplete(kind, source)

  // A block that stays unfinished (old chats, replies that were cut off) is
  // repaired after a few seconds instead of waiting forever.
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    setSettled(false)
    if (!incomplete) return undefined
    const t = setTimeout(() => setSettled(true), 4000)
    return () => clearTimeout(t)
  }, [source, incomplete])
  const healed = useMemo(() => (settled && parsed.err && kind !== 'svg' ? build(kind, source, pal, true) : null), [settled, parsed, kind, source, pal])
  const shown = parsed.err ? (healed && !healed.err ? healed : null) : parsed

  if (!shown) {
    if (incomplete && !settled) return <Note c={c} text="Drawing..." />
    return null
  }
  if (shown.graph) return <GraphView spec={shown.graph} c={c} print={print} />
  const out = shown.svg || shown.diagram
  const exportOut = () => (shown.free ? prepareFreeSvg(source, EXPORT_PAL) : renderDiagram(shown.spec, EXPORT_PAL))
  return <DiagramView out={out} c={c} name={`radius-${kind === 'svg' ? 'drawing' : 'diagram'}`} print={print} getOut={exportOut} />
}

// True when a block of JSON is really a diagram or graph spec.
export function jsonIsDrawing(source) {
  try {
    const o = normalizeSpec(parseLoose(source))
    const t = inferType(o)
    return t === 'graph' || DIAGRAM_TYPES.includes(t)
  } catch (e) {
    return false
  }
}

// Languages the AI sometimes puts on a drawing block instead of "diagram".
const CODE_LANGS = new Set(['python', 'py', 'java', 'c', 'cpp', 'c++', 'csharp', 'cs', 'go', 'rust', 'php', 'ruby', 'sql', 'bash', 'sh', 'shell', 'html', 'css', 'xml', 'yaml', 'yml', 'matlab', 'r', 'kotlin', 'swift', 'latex', 'tex', 'markdown', 'md', 'ts', 'typescript', 'tsx', 'jsx', 'scala', 'dart', 'lua', 'perl'])
const PLAIN_LANGS = new Set(['', 'json', 'jsonc', 'json5', 'javascript', 'js', 'text', 'plaintext', 'txt'])
const DRAWING_START = /"(type|layout|parts|source|supports|loads|forces|curves|series|functions)"\s*:/

// react-markdown component overrides. Merge into the existing `components`.
export function diagramComponents(c, print = false) {
  const langOf = (cls) => {
    const m = /language-([\w-]+)/.exec(cls || '')
    return m ? m[1].toLowerCase() : ''
  }
  const textOf = (ch) => (Array.isArray(ch) ? ch.join('') : String(ch ?? ''))
  // Returns 'diagram' | 'graph' | 'svg' | 'json' when this code block is a drawing.
  const drawingKind = (lang, raw) => {
    const src = raw.trim()
    if (lang === 'diagram' || lang === 'graph' || lang === 'svg') return lang
    if ((PLAIN_LANGS.has(lang) || !CODE_LANGS.has(lang)) && src.startsWith('{') && (jsonIsDrawing(src) || (!src.endsWith('}') && DRAWING_START.test(src.slice(0, 300))))) return 'json'
    return null
  }
  return {
    pre: ({ node, children, ...rest }) => {
      const child = Array.isArray(children) ? children[0] : children
      const props = child && child.props ? child.props : {}
      if (drawingKind(langOf(props.className), typeof props.children === 'string' ? props.children : textOf(props.children))) return <>{children}</>
      return <pre {...rest} style={{ overflowX: 'auto', maxWidth: '100%' }}>{children}</pre>
    },
    code: ({ node, className, children, ...rest }) => {
      const lang = langOf(className)
      const src = textOf(children).replace(/\n$/, '')
      const kind = drawingKind(lang, src)
      if (kind) return <DiagramBlock kind={kind} source={src} c={c} print={print} />
      return <code className={className} {...rest}>{children}</code>
    },
  }
}
