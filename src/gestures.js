import { useRef } from 'react'

// Shared long-press detection for touch (mobile) and mouse (desktop), plus a
// right-click fallback. Cancels if the finger/mouse moves, so it doesn't fight
// with scrolling. Kept separate from any native text-selection popup by the
// caller setting userSelect: 'none' on the pressed element.
export function useLongPress(onLongPress, ms = 480) {
  const timerRef = useRef(null)
  const startRef = useRef(null)

  const clear = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const start = (e) => {
    const point = e.touches ? e.touches[0] : e
    startRef.current = { x: point.clientX, y: point.clientY }
    clear()
    timerRef.current = setTimeout(() => {
      onLongPress(point.clientX, point.clientY)
    }, ms)
  }

  const move = (e) => {
    if (!startRef.current) return
    const point = e.touches ? e.touches[0] : e
    const dx = Math.abs(point.clientX - startRef.current.x)
    const dy = Math.abs(point.clientY - startRef.current.y)
    if (dx > 10 || dy > 10) clear()
  }

  return {
    onTouchStart: start,
    onTouchMove: move,
    onTouchEnd: clear,
    onTouchCancel: clear,
    onMouseDown: start,
    onMouseMove: move,
    onMouseUp: clear,
    onMouseLeave: clear,
    onContextMenu: (e) => {
      e.preventDefault()
      onLongPress(e.clientX, e.clientY)
    },
  }
}

export const noSelectStyle = { userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }

// Swipe a message bubble to the right to reply to it (like WhatsApp/Telegram).
// Only reacts to a mostly-horizontal rightward drag, so normal scrolling and
// tables that scroll sideways (marked data-noswipe) are left alone.
const SWIPE_TRIGGER = 56

export function useSwipeReply(onReply) {
  // The drag is applied straight to the DOM (no React state), so a long
  // answer is not re-rendered on every finger movement. That re-rendering is
  // what made the bubbles feel stuck.
  const bubbleRef = useRef(null)
  const iconRef = useRef(null)
  const startRef = useRef(null)
  const lockRef = useRef(null)
  const firedRef = useRef(false)

  const apply = (dx, animate) => {
    const b = bubbleRef.current
    if (b) {
      b.style.transition = animate ? 'transform 0.18s ease' : 'none'
      b.style.transform = dx ? `translateX(${dx}px)` : 'none'
    }
    const ic = iconRef.current
    if (ic) {
      ic.style.opacity = dx > 8 ? String(Math.min(1, dx / SWIPE_TRIGGER)) : '0'
      ic.style.transform = `scale(${dx >= SWIPE_TRIGGER ? 1.1 : 0.85})`
    }
  }

  const reset = () => {
    startRef.current = null
    lockRef.current = null
    firedRef.current = false
    const b = bubbleRef.current
    if (b) b.style.userSelect = ''
    apply(0, true)
  }

  const onTouchStart = (e) => {
    if (e.target && e.target.closest && e.target.closest('[data-noswipe]')) {
      startRef.current = null
      return
    }
    // A wide equation or code block that scrolls sideways: the finger is
    // scrolling it, not replying. Equations that fit still swipe-to-reply.
    const wide = e.target && e.target.closest ? e.target.closest('.katex-display, pre') : null
    if (wide && wide.scrollWidth > wide.clientWidth + 1) {
      startRef.current = null
      return
    }
    const t = e.touches[0]
    startRef.current = { x: t.clientX, y: t.clientY }
    lockRef.current = null
    firedRef.current = false
  }

  const onTouchMove = (e) => {
    const start = startRef.current
    if (!start) return
    const t = e.touches[0]
    const ddx = t.clientX - start.x
    const ddy = t.clientY - start.y
    const ax = Math.abs(ddx)
    const ay = Math.abs(ddy)
    if (lockRef.current === null && (ax > 12 || ay > 12)) {
      // Decided after a little movement, and lenient on purpose: a slightly
      // diagonal swipe to the right still counts.
      lockRef.current = ddx > 0 && ax >= ay * 0.7 ? 'h' : 'v'
      if (lockRef.current === 'h' && bubbleRef.current) bubbleRef.current.style.userSelect = 'none'
    }
    if (lockRef.current === 'h') {
      const next = Math.max(0, Math.min(ddx, 80))
      apply(next, false)
      if (next >= SWIPE_TRIGGER && !firedRef.current) {
        firedRef.current = true
        try { navigator.vibrate?.(12) } catch (err) { /* ignore */ }
      } else if (next < SWIPE_TRIGGER - 12) {
        firedRef.current = false
      }
    }
  }

  const onTouchEnd = () => {
    if (lockRef.current === 'h' && firedRef.current) onReply()
    reset()
  }

  return { bubbleRef, iconRef, handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: reset } }
}
