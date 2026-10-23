import { useEffect, useMemo, useRef, useState } from 'react'
import { renderDiagram, prepareFreeSvg, DIAGRAM_TYPES } from './diagrams.js'
import { renderGraph } from './graphs.js'

// Fenced code blocks in a reply (```diagram, ```graph, ```svg) are drawn by
// these components instead of being shown as code.

export const DIAGRAM_FENCE_RE = /```(?:diagram|graph|svg)[^\n]*\n[\s\S]*?(?:```|$)/g

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

// Turns the drawing into a PNG and shares it (phones) or downloads it.
async function saveAsPng(svgMarkup, width, height, bg, name) {
  const scale = Math.min(3, 1600 / width)
  const w = Math.round(width * scale)
  const h = Math.round(height * scale)
  const sized = svgMarkup.replace('width="100%"', `width="${w}" height="${h}"`)
  const url = URL.createObjectURL(new Blob([sized], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const img = await new Promise((resolve, reject) => {
      const im = new Image()
      im.onload = () => resolve(im)
      im.onerror = reject
      im.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('no image')
    const file = new File([blob], `${name}.png`, { type: 'image/png' })
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'RADIUS' }); return 'Shared' } catch (e) { if (e && e.name === 'AbortError') return '' }
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
    return 'Saved'
  } finally {
    URL.revokeObjectURL(url)
  }
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

function useSave(c, name) {
  const [status, setStatus] = useState('')
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  const save = async (out) => {
    try {
      const msg = await saveAsPng(out.svg, out.width, out.height, c.surfaceAlt, name)
      setStatus(msg)
    } catch (e) {
      setStatus('Could not save')
    }
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setStatus(''), 2500)
  }
  return [status, save]
}

function DiagramView({ out, c, name, print }) {
  const [status, save] = useSave(c, name)
  return (
    <Frame c={c}>
      <div style={{ padding: '0.6rem 0.4rem 0' }} dangerouslySetInnerHTML={{ __html: out.svg }} />
      {!print && (
        <Bar c={c} status={status}>
          <SmallBtn c={c} onClick={() => save(out)}>Save image</SmallBtn>
        </Bar>
      )}
    </Frame>
  )
}

function GraphView({ spec, c, print }) {
  const pal = useMemo(() => paletteFrom(c), [c.text, c.subtext, c.accent, c.surfaceAlt, c.border])
  const [view, setView] = useState(null)
  const [explore, setExplore] = useState(false)
  const [status, save] = useSave(c, 'radius-graph')
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

  if (out.err) return <Note c={c} text={`I could not draw this graph (${out.err}). Try asking again.`} />
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
      {!print && <Bar c={c} status={status || (explore ? 'Drag to move, pinch to zoom' : '')}>
        <SmallBtn c={c} active={explore} onClick={() => setExplore((v) => !v)}>{explore ? 'Done' : 'Explore'}</SmallBtn>
        {explore && <SmallBtn c={c} label="Zoom in" onClick={() => zoomAt(0.7)}>+</SmallBtn>}
        {explore && <SmallBtn c={c} label="Zoom out" onClick={() => zoomAt(1 / 0.7)}>{'\u2212'}</SmallBtn>}
        {explore && view && <SmallBtn c={c} onClick={() => setView(null)}>Reset</SmallBtn>}
        <SmallBtn c={c} onClick={() => save(out.ok)}>Save image</SmallBtn>
      </Bar>}
      {out.ok.notes.length > 0 && <div style={{ padding: '0 0.8rem 0.6rem', fontSize: '0.74rem', color: c.subtext }}>Skipped: {out.ok.notes.join('; ')}</div>}
    </Frame>
  )
}

// One drawing from a fenced block. kind: 'diagram' | 'graph' | 'svg' | 'json'
export function DiagramBlock({ kind, source, c, print }) {
  const pal = useMemo(() => paletteFrom(c), [c.text, c.subtext, c.accent, c.surfaceAlt, c.border])
  const parsed = useMemo(() => {
    if (kind === 'svg') {
      try { return { svg: prepareFreeSvg(source, pal) } } catch (e) { return { err: e.message } }
    }
    try {
      const spec = JSON.parse(source.replace(/^\uFEFF/, ''))
      const isGraph = kind === 'graph' || (spec && (spec.curves || spec.series || spec.functions || spec.points) && !spec.type)
      if (isGraph) return { graph: spec }
      return { diagram: renderDiagram(spec, pal) }
    } catch (e) {
      return { err: e.message || 'error' }
    }
  }, [kind, source, pal])

  if (parsed.err) {
    if (looksIncomplete(kind, source)) return <Note c={c} text="Drawing..." />
    return <Note c={c} text={`I could not draw this one (${parsed.err}). Ask RADIUS to try again.`} />
  }
  if (parsed.graph) return <GraphView spec={parsed.graph} c={c} print={print} />
  const out = parsed.svg || parsed.diagram
  return <DiagramView out={out} c={c} name={`radius-${kind === 'svg' ? 'drawing' : 'diagram'}`} print={print} />
}

// True when a ```json block is really a diagram or graph spec.
export function jsonIsDrawing(source) {
  try {
    const o = JSON.parse(source)
    return !!o && typeof o === 'object' && (DIAGRAM_TYPES.includes(String(o.type || '').toLowerCase()) || (!o.type && (o.curves || o.series || o.functions)))
  } catch (e) {
    return false
  }
}

// react-markdown component overrides. Merge into the existing `components`.
export function diagramComponents(c, print = false) {
  const langOf = (cls) => {
    const m = /language-([\w-]+)/.exec(cls || '')
    return m ? m[1].toLowerCase() : ''
  }
  const isDrawing = (lang, src) => lang === 'diagram' || lang === 'graph' || lang === 'svg' || (lang === 'json' && jsonIsDrawing(src))
  return {
    pre: ({ node, children, ...rest }) => {
      const child = Array.isArray(children) ? children[0] : children
      const props = child && child.props ? child.props : {}
      const lang = langOf(props.className)
      const src = typeof props.children === 'string' ? props.children : Array.isArray(props.children) ? props.children.join('') : ''
      if (isDrawing(lang, src.trim())) return <>{children}</>
      return <pre {...rest} style={{ overflowX: 'auto', maxWidth: '100%' }}>{children}</pre>
    },
    code: ({ node, className, children, ...rest }) => {
      const lang = langOf(className)
      const src = (Array.isArray(children) ? children.join('') : String(children ?? '')).replace(/\n$/, '')
      if (lang && isDrawing(lang, src.trim())) return <DiagramBlock kind={lang === 'json' ? 'json' : lang} source={src} c={c} print={print} />
      return <code className={className} {...rest}>{children}</code>
    },
  }
}
