import { useState } from 'react'
import { getPalette } from './theme.js'
import { BookmarkIcon, CopyIcon, DownloadIcon, PencilIcon, ReplyIcon, ShareIcon, ThumbsDownIcon, ThumbsUpIcon } from './icons.jsx'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { diagramComponents } from './DiagramBlock.jsx'
import { splitStudy } from './helpers.js'
import { noSelectStyle, useLongPress, useSwipeReply } from './gestures.js'
import { styles } from './styles.js'
import { StudyDeck } from './study.jsx'

// Small site-logo chips shown under a reply that used web search results.
function SourceChips({ sources, c }) {
  const [failed, setFailed] = useState({})
  const list = Array.isArray(sources) ? sources.filter((s) => s && s.u) : []
  if (!list.length) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '0.5rem 0 0.1rem 0.2rem', flexWrap: 'wrap' }}>
      <span style={{ fontSize: '0.7rem', color: c.subtext, fontWeight: 600, marginRight: '2px' }}>Sources</span>
      {list.map((s, i) => {
        let host = ''
        try { host = new URL(s.u).hostname.replace(/^www\./, '') } catch (e) { host = '' }
        return (
          <a
            key={i}
            href={s.u}
            target="_blank"
            rel="noopener noreferrer"
            title={host || s.t}
            aria-label={host || s.t}
            style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: c.surfaceAlt, border: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', textDecoration: 'none', color: c.text, fontSize: '0.72rem', fontWeight: 700 }}
          >
            {failed[i] || !host ? (
              (host[0] || '?').toUpperCase()
            ) : (
              <img src={`https://www.google.com/s2/favicons?domain=${host}&sz=64`} alt="" width="16" height="16" onError={() => setFailed((f) => ({ ...f, [i]: true }))} style={{ borderRadius: '4px', display: 'block' }} />
            )}
          </a>
        )
      })}
    </div>
  )
}

export function MessageBubble({ id, role, content, theme, accentColor, feedback, defaultOpen, onLongPress, onCopy, onFeedback, onShare, onExportPdf, onReply, onSaveLibrary }) {
  const c = getPalette(theme, accentColor)
  const isUser = role === 'user'
  const { text: displayText, deck, sources, kind } = isUser ? { text: content, deck: null, sources: [], kind: null } : splitStudy(content)
  const [solutionOpen, setSolutionOpen] = useState(!!defaultOpen)
  const collapsed = !isUser && kind === 'solution' && !solutionOpen
  // Only user messages get the custom long-press menu (copy/edit) — they have
  // no action buttons below them. AI replies already have copy/feedback
  // buttons right underneath, so long-pressing one falls through to normal
  // native text selection (highlight a word/phrase, drag handles, the OS's
  // own copy popup) instead of our menu intercepting the gesture and only
  // offering a whole-bubble copy.
  const longPress = useLongPress((x, y) => onLongPress(x, y, { id, role, content }))
  const pressHandlers = isUser ? longPress : {}
  const swipe = useSwipeReply(() => onReply(role, displayText))

  return (
    <div {...swipe.handlers} style={{ touchAction: 'pan-y', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', marginBottom: '0.35rem' }}>
      <div ref={swipe.iconRef} style={{ position: 'absolute', left: '6px', top: '14px', width: '30px', height: '30px', borderRadius: '50%', backgroundColor: c.surface, border: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transform: 'scale(0.85)', pointerEvents: 'none' }}>
        <ReplyIcon color={c.text} />
      </div>
      {!isUser && (kind === 'explain' || kind === 'solution') && (
        <button
          type="button"
          onClick={() => kind === 'solution' && setSolutionOpen((v) => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: '0 0 0.25rem 0.2rem', background: 'none', border: 'none', padding: 0, color: c.accent, fontSize: '0.74rem', fontWeight: 800, cursor: kind === 'solution' ? 'pointer' : 'default' }}
        >
          {kind === 'solution' ? `Full solution ${solutionOpen ? '▾' : '▸'}` : 'Explanation'}
        </button>
      )}
      {collapsed ? (
        <button
          type="button"
          onClick={() => setSolutionOpen(true)}
          style={{ ...styles.chipBtn, borderColor: c.border, color: c.text, borderStyle: 'dashed', padding: '0.7rem 1.1rem' }}
        >
          Tap to reveal the full solution
        </button>
      ) : (
      <div
        ref={swipe.bubbleRef}
        {...pressHandlers}
        style={{
          maxWidth: '85%',
          padding: '0.7rem 1rem',
          borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          backgroundColor: isUser ? c.accent : c.surface,
          backgroundImage: isUser ? c.accentGrad : 'none',
          boxShadow: isUser ? `0 6px 16px ${c.accentSoft}` : '0 2px 10px rgba(0,0,0,0.12)',
          color: isUser ? c.accentText : c.text,
          border: isUser ? 'none' : `1px solid ${c.border}`,
          ...(isUser ? noSelectStyle : {}),
        }}
      >
        <div style={{ lineHeight: '1.6' }} className="radius-markdown">
          <ReactMarkdown
            remarkPlugins={[[remarkGfm, { singleTilde: false }], remarkMath]}
            rehypePlugins={[[rehypeKatex, { errorColor: c.warn }]]}
            components={{
              ...diagramComponents(c),
              blockquote: ({ node, ...rest }) => (
                <blockquote {...rest} className="reply-quote" style={{ margin: '0 0 0.55rem 0', padding: '0.45rem 0.7rem', borderLeft: `4px solid ${isUser ? 'rgba(255,255,255,0.75)' : c.accent}`, backgroundColor: isUser ? 'rgba(0,0,0,0.14)' : c.surfaceAlt, borderRadius: '10px', fontSize: '0.82rem', lineHeight: 1.4 }} />
              ),
              table: ({ node, ...rest }) => (
                <div data-noswipe="true" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', margin: '0.5rem 0 0.8rem', borderRadius: '10px', border: `1px solid ${isUser ? 'rgba(0,0,0,0.2)' : c.border}` }}>
                  <table {...rest} style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.85rem' }} />
                </div>
              ),
              th: ({ node, ...rest }) => (
                <th {...rest} style={{ textAlign: 'left', padding: '0.5rem 0.7rem', fontWeight: 'bold', minWidth: '90px', backgroundColor: isUser ? 'rgba(0,0,0,0.12)' : c.bg, borderBottom: `1px solid ${isUser ? 'rgba(0,0,0,0.2)' : c.border}` }} />
              ),
              td: ({ node, ...rest }) => (
                <td {...rest} style={{ textAlign: 'left', padding: '0.5rem 0.7rem', verticalAlign: 'top', minWidth: '90px', borderBottom: `1px solid ${isUser ? 'rgba(0,0,0,0.2)' : c.border}` }} />
              ),
              img: (props) => (
                <a href={props.src} target="_blank" rel="noreferrer">
                  <img
                    {...props}
                    style={{
                      width: '104px',
                      height: '104px',
                      objectFit: 'cover',
                      borderRadius: '10px',
                      margin: '3px',
                      display: 'inline-block',
                      verticalAlign: 'middle',
                      border: `1px solid ${isUser ? 'rgba(0,0,0,0.15)' : c.border}`,
                    }}
                  />
                </a>
              ),
              a: (props) => {
                const raw = Array.isArray(props.children) ? props.children.join('') : String(props.children ?? '')
                if (raw.startsWith('📄 ')) {
                  const label = raw.slice(2).trim()
                  const ext = (label.includes('.') ? label.split('.').pop() : 'FILE').toUpperCase().slice(0, 4)
                  return (
                    <a
                      href={props.href}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        textDecoration: 'none',
                        color: 'inherit',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.45rem 0.7rem',
                        borderRadius: '10px',
                        border: '1.5px solid currentColor',
                        opacity: 0.95,
                        maxWidth: '190px',
                        margin: '3px',
                        verticalAlign: 'middle',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.6rem',
                          fontWeight: 'bold',
                          padding: '2px 5px',
                          borderRadius: '4px',
                          backgroundColor: 'currentColor',
                          color: isUser ? c.accent : c.bg,
                          flexShrink: 0,
                        }}
                      >
                        {ext}
                      </span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.82rem' }}>{label}</span>
                    </a>
                  )
                }
                return (
                  <a href={props.href} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
                    {props.children}
                  </a>
                )
              },
              p: (props) => <p {...props} style={{ margin: '0 0 0.5rem 0' }} />,
            }}
          >
            {displayText}
          </ReactMarkdown>
        </div>
      </div>
      )}
      {!isUser && deck && <StudyDeck deck={deck} c={c} />}
      {!isUser && sources.length > 0 && <SourceChips sources={sources} c={c} />}
      {!isUser && (
        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.3rem', paddingLeft: '0.2rem' }}>
          <button type="button" onClick={() => onReply(role, displayText)} style={styles.msgFeedbackBtn} aria-label="Reply">
            <ReplyIcon color={c.subtext} />
          </button>
          <button type="button" onClick={() => onCopy(displayText)} style={styles.msgFeedbackBtn} aria-label="Copy">
            <CopyIcon color={c.subtext} />
          </button>
          <button type="button" onClick={() => onShare(displayText)} style={styles.msgFeedbackBtn} aria-label="Share">
            <ShareIcon color={c.subtext} />
          </button>
          <button type="button" onClick={() => onExportPdf(displayText)} style={styles.msgFeedbackBtn} aria-label="Save as PDF">
            <DownloadIcon color={c.subtext} />
          </button>
          {onSaveLibrary && (
            <button type="button" onClick={() => onSaveLibrary(displayText, kind, deck)} style={styles.msgFeedbackBtn} aria-label="Save to Study Library">
              <BookmarkIcon color={c.subtext} />
            </button>
          )}
          <button
            type="button"
            onClick={() => onFeedback(id, feedback === 'up' ? null : 'up')}
            style={styles.msgFeedbackBtn}
            aria-label="Good response"
          >
            <ThumbsUpIcon color={feedback === 'up' ? c.accent : c.subtext} filled={feedback === 'up'} />
          </button>
          <button
            type="button"
            onClick={() => onFeedback(id, feedback === 'down' ? null : 'down')}
            style={styles.msgFeedbackBtn}
            aria-label="Bad response"
          >
            <ThumbsDownIcon color={feedback === 'down' ? '#ef4444' : c.subtext} filled={feedback === 'down'} />
          </button>
        </div>
      )}
    </div>
  )
}

export function LongPressMenu({ menu, onClose, theme, accentColor, onCopy, onEdit, onReply }) {
  const c = getPalette(theme, accentColor)
  if (!menu) return null
  const isUser = menu.role === 'user'
  const top = typeof window !== 'undefined' ? Math.min(menu.y, window.innerHeight - 170) : menu.y
  const left = typeof window !== 'undefined' ? Math.min(menu.x, window.innerWidth - 170) : menu.x

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 65 }} />
      <div style={{ ...styles.attachMenu, position: 'fixed', top, left, zIndex: 70, backgroundColor: c.surface, borderColor: c.border }}>
        <button
          type="button"
          style={{ ...styles.attachMenuItem, color: c.text, background: 'none', border: 'none', textAlign: 'left', width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          onClick={() => { onReply(menu.role, splitStudy(menu.content).text); onClose() }}
        >
          <ReplyIcon color={c.text} /> Reply
        </button>
        <button
          type="button"
          style={{ ...styles.attachMenuItem, color: c.text, background: 'none', border: 'none', textAlign: 'left', width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          onClick={() => { onCopy(menu.content); onClose() }}
        >
          <CopyIcon color={c.text} /> Copy
        </button>
        {isUser && (
          <button
            type="button"
            style={{ ...styles.attachMenuItem, color: c.text, background: 'none', border: 'none', textAlign: 'left', width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            onClick={() => { onEdit(menu.content); onClose() }}
          >
            <PencilIcon color={c.text} /> Edit &amp; resend
          </button>
        )}
      </div>
    </>
  )
}
