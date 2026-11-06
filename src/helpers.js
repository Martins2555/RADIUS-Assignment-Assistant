import { fixText } from './textFix.js'
import { normalizeDrawings, stripDiagrams } from './DiagramBlock.jsx'
import { tidyStreaming } from './streamClean.js'

// While a reply is streaming in, hide the hidden type tag at the start and the
// Study Pack JSON block at the end so the student never sees them flash by.
export function cleanStreamText(raw, live = false) {
  let t = raw || ''
  t = t.replace(/^\s*\[TYPE:(ASSIGNMENT|GENERAL)\]\s*/i, '')
  if (/^\s*\[[A-Za-z:]*$/.test(t)) return ''
  const idx = t.indexOf('<study_data>')
  if (idx !== -1) t = t.slice(0, idx)
  else t = t.replace(/<[a-z_]{0,11}$/, '')
  // Live preview only: hide drawing code and unfinished formulas until the checked reply replaces it.
  if (live) t = tidyStreaming(t)
  return t.trim() ? t : ''
}

// Study Pack replies carry their flashcards/quiz as a hidden marker at the end
// of the message text. It is stripped before display, copy, share and before
// the history is sent back to the model.
const STUDY_RE = /\n*<!--STUDY:([\s\S]*?)-->/

const SRC_RE = /\n*<!--SRC:([\s\S]*?)-->/

// Explain and Show solution replies are saved with a small leading marker so
// they show as labelled cards, also after the chat is reopened.
const KIND_RE = /^\s*<!--KIND:(\w+)-->\n?/

// Saved (hidden) when the student presses Stop before any text arrived, so the
// server knows not to finish and announce that answer in the background.
export const STOP_MARKER = '<!--STOPPED-->'

export const visibleRows = (rows) => (rows || []).filter((m) => m.content !== STOP_MARKER)

export function splitStudy(content) {
  let raw = content || ''
  let sources = []
  let kind = null
  const km = raw.match(KIND_RE)
  if (km) {
    kind = km[1]
    raw = raw.replace(KIND_RE, '')
  }
  const sm = raw.match(SRC_RE)
  if (sm) {
    try { sources = JSON.parse(decodeURIComponent(sm[1])) } catch (e) { sources = [] }
    raw = raw.replace(SRC_RE, '')
  }
  const m = raw.match(STUDY_RE)
  if (!m) return { text: fixText(normalizeDrawings(raw.trim())), deck: null, sources, kind }
  let deck = null
  try { deck = JSON.parse(decodeURIComponent(m[1])) } catch (e) { deck = null }
  return { text: fixText(normalizeDrawings(raw.replace(STUDY_RE, '').trim())), deck, sources, kind }
}

// Turns the on-screen messages into the history sent to the model. Hidden
// markers are removed, and two messages in a row from the same side (for
// example an Explain card after a reply) are joined so turns always alternate.
export function buildHistory(msgs) {
  const out = []
  for (const m of msgs || []) {
    const text = stripDiagrams(splitStudy(m.content).text, '[Diagram shown to the student]')
    if (!text) continue
    const last = out[out.length - 1]
    if (last && last.role === m.role) last.content += '\n\n' + text
    else out.push({ role: m.role, content: text })
  }
  return out
}

// Pulls the attached images/PDFs back out of a saved user message so a
// regenerated answer can read them again.
export function extractFilesFromContent(content) {
  const files = []
  const re = /(!?)\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g
  let m
  while ((m = re.exec(content || '')) !== null) {
    const url = m[2]
    if (!url.includes('/storage/v1/')) continue
    const path = url.split('?')[0].toLowerCase()
    let mimeType = null
    if (path.endsWith('.pdf')) mimeType = 'application/pdf'
    else if (/\.jpe?g$/.test(path)) mimeType = 'image/jpeg'
    else if (path.endsWith('.png')) mimeType = 'image/png'
    else if (path.endsWith('.webp')) mimeType = 'image/webp'
    else if (m[1] === '!') mimeType = 'image/jpeg'
    if (mimeType) files.push({ url, mimeType })
  }
  return files.slice(0, 10)
}

// The student's own words from a saved user message: no quoted reply block
// and no attachment links.
export function stripAttachmentMarkdown(content) {
  return (content || '')
    .replace(/^(?:>.*\n)+\n*/, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[\u{1F4C4} [^\]]*\]\([^)]*\)/gu, '')
    .trim()
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const maxDim = 1600
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          } else {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
        const base64 = dataUrl.split(',')[1]
        resolve({ base64, mimeType: 'image/jpeg', preview: dataUrl })
      }
      img.onerror = reject
      img.src = e.target.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ---- Project mode ---------------------------------------------------------------
export function fileIsStale(f) {
  return (f.status === 'pending' || f.status === 'processing') && Date.now() - new Date(f.created_at).getTime() > 4 * 60 * 1000
}

// ---- Notifications (Settings card) ------------------------------------------------
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}
