import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" style={{ marginRight: '10px' }}>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4c-7.4 0-13.8 4.2-17 10.3z"/>
      <path fill="#4CAF50" d="M24 44c5.4 0 10.4-2.1 14.1-5.5l-6.5-5.5C29.5 34.8 26.9 36 24 36c-5.3 0-9.7-3.1-11.3-7.7l-6.6 5.1C9.8 39.8 16.4 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.9 2.5-2.5 4.6-4.7 6l6.5 5.5C40.3 36.9 44 31.1 44 24c0-1.3-.1-2.7-.4-3.5z"/>
    </svg>
  )
}

function MenuIcon({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 6h18M3 12h18M3 18h18" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function NewChatIcon({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function BackIcon({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M15 18l-6-6 6-6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PlusIcon({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" />
      <path d="M12 8v8M8 12h8" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function PhotosIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="16" rx="2.5" stroke={color} strokeWidth="1.7" />
      <circle cx="8.5" cy="9.5" r="1.6" stroke={color} strokeWidth="1.5" />
      <path d="M4 17l5-5 3.5 3.5L17 10l4 4.5" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function FileAttachIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M8 2h6l5 5v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M14 2v5h5" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9 13h6M9 17h6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function CameraIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 8a2 2 0 0 1 2-2h1.5l1-1.6A1.5 1.5 0 0 1 9.8 3.7h4.4a1.5 1.5 0 0 1 1.3.7l1 1.6H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="3.4" stroke={color} strokeWidth="1.7" />
    </svg>
  )
}

function SendIcon({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M4 12l16-7-6 16-2.5-6.5L4 12z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}

function CopyIcon({ color }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <rect x="9" y="9" width="12" height="12" rx="2" stroke={color} strokeWidth="1.8" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function ThumbsUpIcon({ color, filled }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? color : 'none'}>
      <path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3zm0 0l4.5-8a2 2 0 0 1 3.4 1.9L13.8 9H19a2 2 0 0 1 1.9 2.7l-2.6 7A2 2 0 0 1 16.4 20H10a3 3 0 0 1-3-3" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}

function ThumbsDownIcon({ color, filled }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? color : 'none'} style={{ transform: 'rotate(180deg)' }}>
      <path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3zm0 0l4.5-8a2 2 0 0 1 3.4 1.9L13.8 9H19a2 2 0 0 1 1.9 2.7l-2.6 7A2 2 0 0 1 16.4 20H10a3 3 0 0 1-3-3" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}

function TrashIcon({ color }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0v13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PencilIcon({ color }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M4 20l1-4L16 5l3 3L8 19l-4 1z" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PinIcon({ color, filled }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? color : 'none'}>
      <path d="M12 2l2 6 6 2-6 4-1 8-1-8-6-4 6-2z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}

// Free color choices for the chat accent. Kept simple and all-unlocked for now —
// this is where a "premium" lock would slot in later once payment is wired up.
const accentColors = {
  green: { dark: '#22c55e', light: '#16a34a' },
  blue: { dark: '#3b82f6', light: '#2563eb' },
  purple: { dark: '#a855f7', light: '#9333ea' },
  pink: { dark: '#ec4899', light: '#db2777' },
  orange: { dark: '#f97316', light: '#ea580c' },
}
const accentOrder = ['green', 'blue', 'purple', 'pink', 'orange']

const modeBase = {
  dark: { bg: '#0f0f0f', surface: '#1a1a1a', border: '#333', text: '#ffffff', subtext: '#888' },
  light: { bg: '#ffffff', surface: '#f0f0f0', border: '#ddd', text: '#111111', subtext: '#666' },
}

function getPalette(theme, accentColor) {
  const base = modeBase[theme] || modeBase.dark
  const ac = accentColors[accentColor] || accentColors.green
  return {
    ...base,
    accent: ac[theme] || ac.dark,
    accentText: theme === 'light' ? '#ffffff' : '#000000',
  }
}

function Logo({ small }) {
  return (
    <div className={small ? '' : 'fade-in-1 logo-pulse'} style={small ? styles.logoWrapperSmall : styles.logoWrapper}>
      <img src="/logo.png" alt="RADIUS" style={styles.logo} />
    </div>
  )
}

function AuthScreen() {
  const [isSignUp, setIsSignUp] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetMessage, setResetMessage] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setMessage(error.message)
      } else if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setMessage('This email has already been registered to RADIUS. Please log in, or use "Forgot password?" if you don\'t remember your password.')
      } else {
        setMessage('Check your email to confirm your account.')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage(error.message)
    }
    setLoading(false)
  }

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google' })
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setResetLoading(true)
    setResetMessage('')
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: window.location.origin,
    })
    if (error) setResetMessage(error.message)
    else setResetMessage('Check your email for a password reset link.')
    setResetLoading(false)
  }

  if (showForgotPassword) {
    return (
      <div style={styles.container}>
        <Logo />
        <p className="fade-in-2" style={styles.subtitle}>Reset your password</p>
        <form onSubmit={handleForgotPassword} className="fade-in-3" style={styles.form}>
          <input
            type="email"
            placeholder="Email"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            required
            style={styles.input}
          />
          <button type="submit" disabled={resetLoading} style={styles.button}>
            {resetLoading ? 'Please wait...' : 'Send Reset Link'}
          </button>
        </form>
        <p
          className="fade-in-3"
          style={styles.toggle}
          onClick={() => {
            setShowForgotPassword(false)
            setResetMessage('')
          }}
        >
          Back to log in
        </p>
        {resetMessage && <p style={styles.message}>{resetMessage}</p>}
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <Logo />
      <p className="fade-in-2" style={styles.subtitle}>All-Round Assignment and Task Assistant</p>
      <form onSubmit={handleAuth} className="fade-in-3" style={styles.form}>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required style={styles.input} />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required style={styles.input} />
        <button type="submit" disabled={loading} style={styles.button}>
          {loading ? 'Please wait...' : isSignUp ? 'Sign Up' : 'Log In'}
        </button>
      </form>
      {!isSignUp && (
        <p className="fade-in-3" style={styles.toggle} onClick={() => setShowForgotPassword(true)}>
          Forgot password?
        </p>
      )}
      <button onClick={handleGoogleLogin} className="fade-in-3" style={styles.googleButton}>
        <GoogleIcon />
        Continue with Google
      </button>
      <p className="fade-in-3" style={styles.toggle} onClick={() => setIsSignUp(!isSignUp)}>
        {isSignUp ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
      </p>
      {message && <p style={styles.message}>{message}</p>}
    </div>
  )
}

function SettingsScreen({ session, theme, setTheme, accentColor, setAccentColor, onBack }) {
  const c = getPalette(theme, accentColor)
  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div style={{ ...styles.settingsContainer, backgroundColor: c.bg, color: c.text }}>
      <div style={styles.topBar}>
        <button onClick={onBack} style={styles.iconBtn}><BackIcon color={c.text} /></button>
        <span style={{ fontWeight: 'bold' }}>Settings</span>
        <div style={{ width: '22px' }} />
      </div>
      <p style={{ color: c.subtext, marginTop: '1.5rem' }}>{session.user.email}</p>
      <div style={{ marginTop: '2rem' }}>
        <p style={{ color: c.subtext, fontSize: '0.85rem', marginBottom: '0.6rem' }}>APPEARANCE</p>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button onClick={() => setTheme('dark')} style={{ ...styles.themeBtn, borderColor: theme === 'dark' ? c.accent : c.border, color: c.text }}>Dark</button>
          <button onClick={() => setTheme('light')} style={{ ...styles.themeBtn, borderColor: theme === 'light' ? c.accent : c.border, color: c.text }}>Light</button>
        </div>
      </div>
      <div style={{ marginTop: '2rem' }}>
        <p style={{ color: c.subtext, fontSize: '0.85rem', marginBottom: '0.6rem' }}>CHAT COLOR</p>
        <div style={{ display: 'flex', gap: '0.7rem' }}>
          {accentOrder.map((key) => (
            <button
              key={key}
              onClick={() => setAccentColor(key)}
              aria-label={key}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                border: accentColor === key ? `2.5px solid ${c.text}` : '2.5px solid transparent',
                padding: 0,
                cursor: 'pointer',
                backgroundColor: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: accentColors[key][theme] || accentColors[key].dark, display: 'block' }} />
            </button>
          ))}
        </div>
        <p style={{ color: c.subtext, fontSize: '0.75rem', marginTop: '0.6rem' }}>More colors and custom backgrounds are coming with premium.</p>
      </div>
      <div style={{ marginTop: '2rem' }}>
        <p style={{ color: c.subtext, fontSize: '0.85rem', marginBottom: '0.6rem' }}>MEMBERSHIP</p>
        <button
          onClick={() => alert('Payment methods incoming — RADIUS Plus will be available soon!')}
          style={{
            width: '100%',
            padding: '0.9rem 1rem',
            borderRadius: '12px',
            border: `1.5px solid ${c.accent}`,
            background: `linear-gradient(135deg, ${c.accent}22, transparent)`,
            color: c.text,
            fontWeight: 'bold',
            fontSize: '0.95rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>✨ Upgrade to RADIUS Plus</span>
          <span style={{ fontSize: '0.75rem', color: c.subtext, fontWeight: 'normal' }}>Coming soon</span>
        </button>
      </div>
      <button onClick={handleLogout} style={{ ...styles.logoutBtn, borderColor: c.border, color: '#ef4444', marginTop: '2.5rem' }}>Log Out</button>
    </div>
  )
}

// Shared long-press detection for touch (mobile) and mouse (desktop), plus a
// right-click fallback. Cancels if the finger/mouse moves, so it doesn't fight
// with scrolling. Kept separate from any native text-selection popup by the
// caller setting userSelect: 'none' on the pressed element.
function useLongPress(onLongPress, ms = 480) {
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

const noSelectStyle = { userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }

function MessageBubble({ id, role, content, theme, accentColor, feedback, onLongPress, onCopy, onFeedback }) {
  const c = getPalette(theme, accentColor)
  const isUser = role === 'user'
  const longPress = useLongPress((x, y) => onLongPress(x, y, { id, role, content }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', marginBottom: '0.35rem' }}>
      <div
        {...longPress}
        style={{
          maxWidth: '85%',
          padding: '0.7rem 1rem',
          borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          backgroundColor: isUser ? c.accent : c.surface,
          color: isUser ? c.accentText : c.text,
          border: isUser ? 'none' : `1px solid ${c.border}`,
          ...noSelectStyle,
        }}
      >
        <div style={{ lineHeight: '1.6' }} className="radius-markdown">
          <ReactMarkdown
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
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
            {content}
          </ReactMarkdown>
        </div>
      </div>
      {!isUser && (
        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.3rem', paddingLeft: '0.2rem' }}>
          <button type="button" onClick={() => onCopy(content)} style={styles.msgFeedbackBtn} aria-label="Copy">
            <CopyIcon color={c.subtext} />
          </button>
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

function LongPressMenu({ menu, onClose, theme, accentColor, onCopy, onEdit }) {
  const c = getPalette(theme, accentColor)
  if (!menu) return null
  const isUser = menu.role === 'user'
  const top = typeof window !== 'undefined' ? Math.min(menu.y, window.innerHeight - 110) : menu.y
  const left = typeof window !== 'undefined' ? Math.min(menu.x, window.innerWidth - 170) : menu.x

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 65 }} />
      <div style={{ ...styles.attachMenu, position: 'fixed', top, left, zIndex: 70, backgroundColor: c.surface, borderColor: c.border }}>
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

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function compressImage(file) {
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

function ConversationRow({ conv, isActive, c, onSelect, onLongPress, isRenaming, renameValue, onRenameChange, onRenameCommit }) {
  const longPress = useLongPress((x, y) => onLongPress(x, y, conv))

  if (isRenaming) {
    return (
      <input
        autoFocus
        value={renameValue}
        onChange={(e) => onRenameChange(e.target.value)}
        onBlur={onRenameCommit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); onRenameCommit() }
        }}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '0.65rem 0.8rem',
          borderRadius: '8px',
          border: `1px solid ${c.accent}`,
          backgroundColor: c.bg,
          color: c.text,
          fontSize: '0.9rem',
          marginBottom: '0.2rem',
          outline: 'none',
        }}
      />
    )
  }

  return (
    <div
      {...longPress}
      onClick={onSelect}
      style={{
        padding: '0.7rem 0.8rem',
        borderRadius: '8px',
        cursor: 'pointer',
        backgroundColor: isActive ? c.bg : 'transparent',
        color: c.text,
        fontSize: '0.9rem',
        marginBottom: '0.2rem',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        ...noSelectStyle,
      }}
    >
      {conv.is_pinned && <PinIcon color={c.accent} filled />}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{conv.title || 'New chat'}</span>
    </div>
  )
}

function Sidebar({ open, onClose, conversations, activeConversationId, onSelectConversation, onNewChat, onOpenSettings, onRenameConversation, onDeleteConversation, onTogglePin, theme, accentColor, session }) {
  const c = getPalette(theme, accentColor)
  const [rowMenu, setRowMenu] = useState(null)
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')

  if (!open) return null

  const startRename = (conv) => {
    setRenamingId(conv.id)
    setRenameValue(conv.title || '')
    setRowMenu(null)
  }
  const commitRename = () => {
    const title = renameValue.trim()
    if (title && renamingId) onRenameConversation(renamingId, title)
    setRenamingId(null)
  }
  const confirmDelete = (conv) => {
    setRowMenu(null)
    if (window.confirm('Delete this chat? This cannot be undone.')) {
      onDeleteConversation(conv.id)
    }
  }
  const togglePin = (conv) => {
    setRowMenu(null)
    onTogglePin(conv.id, !conv.is_pinned)
  }

  const menuTop = rowMenu && typeof window !== 'undefined' ? Math.min(rowMenu.y, window.innerHeight - 150) : rowMenu?.y
  const menuLeft = rowMenu && typeof window !== 'undefined' ? Math.min(rowMenu.x, window.innerWidth - 170) : rowMenu?.x

  const pinnedConvs = conversations.filter((cv) => cv.is_pinned)
  const recentConvs = conversations.filter((cv) => !cv.is_pinned)

  const renderRow = (conv) => (
    <ConversationRow
      key={conv.id}
      conv={conv}
      isActive={conv.id === activeConversationId}
      c={c}
      onSelect={() => onSelectConversation(conv)}
      onLongPress={(x, y, conv) => setRowMenu({ x, y, conv })}
      isRenaming={renamingId === conv.id}
      renameValue={renameValue}
      onRenameChange={setRenameValue}
      onRenameCommit={commitRename}
    />
  )

  return (
    <>
      <div onClick={onClose} style={styles.sidebarOverlay} />
      <div style={{ ...styles.sidebarPanel, backgroundColor: c.surface, borderColor: c.border }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Logo small />
            <span style={{ fontWeight: 'bold', color: c.text }}>RADIUS</span>
          </div>
          <button onClick={onClose} style={styles.iconBtn}><BackIcon color={c.text} /></button>
        </div>

        <button onClick={onNewChat} style={{ ...styles.newChatSidebarBtn, borderColor: c.border, color: c.text }}>
          <NewChatIcon color={c.text} />
          New chat
        </button>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 0.6rem' }}>
          {pinnedConvs.length > 0 && (
            <>
              <p style={{ color: c.subtext, fontSize: '0.75rem', margin: '1rem 0.4rem 0.4rem' }}>PINNED</p>
              {pinnedConvs.map(renderRow)}
            </>
          )}

          <p style={{ color: c.subtext, fontSize: '0.75rem', margin: '1rem 0.4rem 0.4rem' }}>RECENT</p>
          {recentConvs.length === 0 && pinnedConvs.length === 0 && (
            <p style={{ color: c.subtext, fontSize: '0.85rem', padding: '0.6rem' }}>No chats yet</p>
          )}
          {recentConvs.map(renderRow)}
        </div>

        <div
          onClick={onOpenSettings}
          style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '1rem', borderTop: `1px solid ${c.border}`, cursor: 'pointer' }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: c.accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: c.accentText,
              fontSize: '0.8rem',
              fontWeight: 'bold',
              flexShrink: 0,
            }}
          >
            {(session.user.email || '?')[0].toUpperCase()}
          </div>
          <span style={{ color: c.text, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {session.user.email}
          </span>
        </div>
      </div>

      {rowMenu && (
        <>
          <div onClick={() => setRowMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 65 }} />
          <div style={{ ...styles.attachMenu, position: 'fixed', top: menuTop, left: menuLeft, zIndex: 70, backgroundColor: c.bg, borderColor: c.border }}>
            <button
              type="button"
              style={{ ...styles.attachMenuItem, color: c.text, background: 'none', border: 'none', textAlign: 'left', width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              onClick={() => togglePin(rowMenu.conv)}
            >
              <PinIcon color={c.text} /> {rowMenu.conv.is_pinned ? 'Unpin' : 'Pin'}
            </button>
            <button
              type="button"
              style={{ ...styles.attachMenuItem, color: c.text, background: 'none', border: 'none', textAlign: 'left', width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              onClick={() => startRename(rowMenu.conv)}
            >
              <PencilIcon color={c.text} /> Rename
            </button>
            <button
              type="button"
              style={{ ...styles.attachMenuItem, color: '#ef4444', background: 'none', border: 'none', textAlign: 'left', width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              onClick={() => confirmDelete(rowMenu.conv)}
            >
              <TrashIcon color="#ef4444" /> Delete
            </button>
          </div>
        </>
      )}
    </>
  )
}

function Dashboard({ session }) {
  const [view, setView] = useState('main')
  const [theme, setTheme] = useState(() => localStorage.getItem('radius-theme') || 'dark')
  const [accentColor, setAccentColor] = useState(() => localStorage.getItem('radius-accent') || 'green')
  const [mode, setMode] = useState('calculative')
  const [subject, setSubject] = useState('')
  const [assignmentText, setAssignmentText] = useState('')
  const [attachedFiles, setAttachedFiles] = useState([])
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [conversations, setConversations] = useState([])
  const [activeConversationId, setActiveConversationId] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [attachMenuOpen, setAttachMenuOpen] = useState(false)
  const [longPressMenu, setLongPressMenu] = useState(null)

  const c = getPalette(theme, accentColor)
  const displayName = session.user.user_metadata?.full_name || session.user.email.split('@')[0]
  const messagesEndRef = useRef(null)
  const textAreaRef = useRef(null)
  const photosInputRef = useRef(null)
  const filesInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  useEffect(() => {
    loadConversations()
  }, [])

  useEffect(() => {
    localStorage.setItem('radius-theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('radius-accent', accentColor)
  }, [accentColor])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function handleCopyText(text) {
    navigator.clipboard?.writeText(text || '')
  }

  function handleEditMessage(text) {
    setAssignmentText(text || '')
    requestAnimationFrame(() => textAreaRef.current?.focus())
  }

  async function handleSetFeedback(messageId, value) {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, feedback: value } : m)))
    // Best-effort only: skips messages that haven't round-tripped to the DB yet
    // (temp- ids), and silently no-ops if the `feedback` column doesn't exist
    // yet on the messages table.
    if (typeof messageId === 'string' && messageId.startsWith('temp-')) return
    try {
      await supabase.from('messages').update({ feedback: value }).eq('id', messageId)
    } catch (e) {
      // ignore — see comment above
    }
  }

  async function handleRenameConversation(id, title) {
    setConversations((prev) => prev.map((cv) => (cv.id === id ? { ...cv, title } : cv)))
    await supabase.from('conversations').update({ title }).eq('id', id)
  }

  async function handleDeleteConversation(id) {
    setConversations((prev) => prev.filter((cv) => cv.id !== id))
    if (activeConversationId === id) {
      handleNewChat()
    }
    await supabase.from('messages').delete().eq('conversation_id', id)
    await supabase.from('conversations').delete().eq('id', id)
  }

  async function loadConversations() {
    let { data, error } = await supabase
      .from('conversations')
      .select('id, title, mode, subject, updated_at, is_pinned')
      .order('updated_at', { ascending: false })
    if (error) {
      // `is_pinned` likely doesn't exist on the live table yet — fall back
      // so the whole history list doesn't silently disappear because of it.
      const fallback = await supabase
        .from('conversations')
        .select('id, title, mode, subject, updated_at')
        .order('updated_at', { ascending: false })
      data = fallback.data
      error = fallback.error
    }
    if (!error) {
      const sorted = [...(data || [])].sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0))
      setConversations(sorted)
    }
  }

  async function handleTogglePin(id, pinned) {
    setConversations((prev) => {
      const updated = prev.map((cv) => (cv.id === id ? { ...cv, is_pinned: pinned } : cv))
      return [...updated].sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0))
    })
    // Best-effort: no-ops quietly if the `is_pinned` column doesn't exist yet
    try {
      await supabase.from('conversations').update({ is_pinned: pinned }).eq('id', id)
    } catch (e) {
      // ignore — see comment above
    }
  }

  async function openConversation(conv) {
    setSidebarOpen(false)
    setActiveConversationId(conv.id)
    setMode(conv.mode || 'calculative')
    setSubject(conv.subject || '')
    setError('')
    const { data, error } = await supabase
      .from('messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true })
    if (!error) setMessages(data || [])
  }

  function handleNewChat() {
    setActiveConversationId(null)
    setMessages([])
    setAssignmentText('')
    setAttachedFiles([])
    setError('')
    setSubject('')
    setSidebarOpen(false)
  }

  const MAX_FILES = 10

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const room = MAX_FILES - attachedFiles.length
    if (room <= 0) {
      setError(`You can attach up to ${MAX_FILES} files at once.`)
      e.target.value = ''
      return
    }
    const filesToAdd = files.slice(0, room)
    if (files.length > filesToAdd.length) {
      setError(`Only added ${filesToAdd.length} file(s) — the ${MAX_FILES}-file limit was reached.`)
    }

    try {
      const processed = await Promise.all(
        filesToAdd.map(async (file) => {
          if (file.type.startsWith('image/')) {
            return await compressImage(file)
          }
          const base64 = await fileToBase64(file)
          return { base64, mimeType: file.type || 'application/pdf', preview: null, name: file.name }
        })
      )
      setAttachedFiles((prev) => [...prev, ...processed])
    } catch (err) {
      setError('Could not process one of those files. Please try again.')
    }
    e.target.value = ''
  }

  const handleRemoveFile = (index) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!assignmentText.trim() && attachedFiles.length === 0) return

    setLoading(true)
    setError('')

    const userText = assignmentText
    const filesToSend = attachedFiles
    setAssignmentText('')
    setAttachedFiles([])
    if (textAreaRef.current) textAreaRef.current.style.height = 'auto'

    try {
      let conversationId = activeConversationId

      if (!conversationId) {
        const title = (userText || 'Image assignment').slice(0, 60)
        const { data: newConv, error: convError } = await supabase
          .from('conversations')
          .insert({ user_id: session.user.id, title, mode, subject: subject || null })
          .select()
          .single()
        if (convError) throw new Error(convError.message)
        conversationId = newConv.id
        setActiveConversationId(conversationId)
        setConversations((prev) => [newConv, ...prev])
      }

      const attachmentMarkdownParts = []
      const filesForApi = []
      for (const file of filesToSend) {
        const ext = file.mimeType === 'application/pdf' ? 'pdf' : (file.mimeType.split('/')[1] || 'dat')
        const path = `${session.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        const blob = await (await fetch(`data:${file.mimeType};base64,${file.base64}`)).blob()
        const { error: uploadError } = await supabase.storage
          .from('assignment-images')
          .upload(path, blob, { contentType: file.mimeType })
        if (!uploadError) {
          // Signed URL instead of a public one — the bucket is private, so this is
          // required for the link to work at all. Expiry is set very long (10 years)
          // because the URL gets baked into the stored message content in Supabase;
          // once a message is saved, there's no later point to re-sign it.
          const { data: urlData, error: signError } = await supabase.storage
            .from('assignment-images')
            .createSignedUrl(path, 60 * 60 * 24 * 365 * 10)
          if (!signError && urlData) {
            const isImageAttachment = file.mimeType.startsWith('image/')
            attachmentMarkdownParts.push(
              isImageAttachment
                ? `![assignment image](${urlData.signedUrl})`
                : `[📄 ${file.name || 'attached file'}](${urlData.signedUrl})`
            )
            // Sent to /api/generate as a URL, not base64 — the backend fetches
            // it server-side. Keeps the request tiny regardless of file size,
            // which is what was breaking PDF uploads (Vercel's 4.5MB body cap).
            filesForApi.push({ url: urlData.signedUrl, mimeType: file.mimeType })
          }
        }
      }

      // Joined with a single space (not a blank-line paragraph break) so multiple
      // attachments render inline together in one row instead of stacking full-width.
      const userContent = attachmentMarkdownParts.length
        ? `${attachmentMarkdownParts.join(' ')}${userText ? '\n\n' + userText : ''}`
        : userText

      setMessages((prev) => [...prev, { id: `temp-u-${Date.now()}`, role: 'user', content: userContent }])
      await supabase.from('messages').insert({ conversation_id: conversationId, role: 'user', content: userContent })

      const history = messages.map((m) => ({ role: m.role, content: m.content }))

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          subject,
          mode,
          assignmentText: userText,
          history,
          images: filesForApi,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Something went wrong.')
      } else {
        setMessages((prev) => [...prev, { id: `temp-a-${Date.now()}`, role: 'assistant', content: data.result }])
        await supabase.from('messages').insert({ conversation_id: conversationId, role: 'assistant', content: data.result })
        loadConversations()
      }
    } catch (err) {
      setError(err.message || 'Network error. Please try again.')
    }
    setLoading(false)
  }

  if (view === 'settings') {
    return (
      <SettingsScreen
        session={session}
        theme={theme}
        setTheme={setTheme}
        accentColor={accentColor}
        setAccentColor={setAccentColor}
        onBack={() => setView('main')}
      />
    )
  }

  return (
    <div className="radius-app-shell" style={{ ...styles.dashboardContainer, backgroundColor: c.bg, color: c.text }}>
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={openConversation}
        onNewChat={handleNewChat}
        onOpenSettings={() => { setSidebarOpen(false); setView('settings') }}
        onRenameConversation={handleRenameConversation}
        onDeleteConversation={handleDeleteConversation}
        onTogglePin={handleTogglePin}
        theme={theme}
        accentColor={accentColor}
        session={session}
      />

      <LongPressMenu
        menu={longPressMenu}
        onClose={() => setLongPressMenu(null)}
        theme={theme}
        accentColor={accentColor}
        onCopy={handleCopyText}
        onEdit={handleEditMessage}
      />

      <div style={styles.topBar}>
        <button onClick={() => setSidebarOpen(true)} style={styles.iconBtn}><MenuIcon color={c.text} /></button>
        <div style={styles.modeToggle}>
          <button onClick={() => setMode('calculative')} style={{ ...styles.modeBtn, backgroundColor: mode === 'calculative' ? c.accent : 'transparent', color: mode === 'calculative' ? c.accentText : c.subtext, borderColor: c.border }}>Calculative</button>
          <button onClick={() => setMode('non-calculative')} style={{ ...styles.modeBtn, backgroundColor: mode === 'non-calculative' ? c.accent : 'transparent', color: mode === 'non-calculative' ? c.accentText : c.subtext, borderColor: c.border }}>Non-Calculative</button>
        </div>
        <button onClick={handleNewChat} style={styles.iconBtn}><NewChatIcon color={c.text} /></button>
      </div>

      <div style={styles.messagesArea}>
        {messages.length === 0 && !loading && (
          <div key={activeConversationId || 'new'} className="radius-entrance" style={{ textAlign: 'center', margin: 'auto' }}>
            <p style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>Welcome, {displayName}</p>
            <p style={{ color: c.subtext, marginTop: '0.4rem' }}>What assignment are we tackling today?</p>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className="radius-entrance">
            <MessageBubble
              id={m.id}
              role={m.role}
              content={m.content}
              theme={theme}
              accentColor={accentColor}
              feedback={m.feedback}
              onLongPress={(x, y, msg) => setLongPressMenu({ x, y, ...msg })}
              onCopy={handleCopyText}
              onFeedback={handleSetFeedback}
            />
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: c.subtext, padding: '0.4rem 0' }}>
            <span className="radius-spinner" style={{ color: c.accent }} />
            Thinking...
          </div>
        )}
        {error && <p style={{ color: '#ef4444', padding: '0.4rem 0', textAlign: 'center' }}>{error}</p>}

        <div ref={messagesEndRef} />
      </div>

      <input
        type="text"
        placeholder="Subject (optional, e.g. Physics)"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        style={{ ...styles.subjectInput, backgroundColor: c.surface, borderColor: c.border, color: c.text }}
      />

      {attachedFiles.length > 0 && (
        <div style={{ margin: '0 1rem 0.6rem 1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {attachedFiles.map((file, index) => (
            <div key={index} style={{ position: 'relative', width: '70px' }}>
              {file.preview ? (
                <img src={file.preview} alt="attachment preview" style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '10px', border: `1px solid ${c.border}` }} />
              ) : (
                <div style={{ width: '70px', height: '70px', borderRadius: '10px', border: `1px solid ${c.border}`, backgroundColor: c.surface, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '4px', overflow: 'hidden' }}>
                  <span style={{ fontSize: '0.6rem', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', backgroundColor: c.accent, color: c.accentText }}>
                    {(file.name?.split('.').pop() || 'FILE').toUpperCase().slice(0, 4)}
                  </span>
                  <span style={{ fontSize: '0.6rem', color: c.subtext, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                    {file.name || 'File'}
                  </span>
                </div>
              )}
              <button
                onClick={() => handleRemoveFile(index)}
                type="button"
                style={{ position: 'absolute', top: '-6px', right: '-6px', width: '20px', height: '20px', borderRadius: '50%', border: 'none', backgroundColor: '#ef4444', color: '#fff', fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ ...styles.bottomBar, backgroundColor: c.surface, borderColor: c.border }}>
        <input ref={photosInputRef} type="file" accept="image/*" multiple onChange={handleFileChange} style={{ display: 'none' }} />
        <input ref={filesInputRef} type="file" accept="application/pdf,image/*" multiple onChange={handleFileChange} style={{ display: 'none' }} />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} style={{ display: 'none' }} />
        <div style={{ position: 'relative' }}>
          {attachMenuOpen && (
            <div onClick={() => setAttachMenuOpen(false)} style={styles.attachMenuOverlay} />
          )}
          <button type="button" onClick={() => setAttachMenuOpen((v) => !v)} style={styles.attachBtn}>
            <PlusIcon color={c.text} />
          </button>
          {attachMenuOpen && (
            <div style={{ ...styles.attachMenu, backgroundColor: c.surface, borderColor: c.border, minWidth: '190px', padding: '0.5rem' }}>
              <button
                type="button"
                style={{ ...styles.attachMenuItem, color: c.text, background: 'none', border: 'none', textAlign: 'left', width: '100%' }}
                onClick={() => { setAttachMenuOpen(false); photosInputRef.current?.click() }}
              >
                <span style={{ ...styles.attachMenuIconWrap, backgroundColor: c.bg }}>
                  <PhotosIcon color={c.text} />
                </span>
                Photos
              </button>
              <button
                type="button"
                style={{ ...styles.attachMenuItem, color: c.text, background: 'none', border: 'none', textAlign: 'left', width: '100%' }}
                onClick={() => { setAttachMenuOpen(false); filesInputRef.current?.click() }}
              >
                <span style={{ ...styles.attachMenuIconWrap, backgroundColor: c.bg }}>
                  <FileAttachIcon color={c.text} />
                </span>
                Files
              </button>
              <button
                type="button"
                style={{ ...styles.attachMenuItem, color: c.text, background: 'none', border: 'none', textAlign: 'left', width: '100%' }}
                onClick={() => { setAttachMenuOpen(false); cameraInputRef.current?.click() }}
              >
                <span style={{ ...styles.attachMenuIconWrap, backgroundColor: c.bg }}>
                  <CameraIcon color={c.text} />
                </span>
                Camera
              </button>
            </div>
          )}
        </div>
        <textarea
          ref={textAreaRef}
          rows={1}
          placeholder="Type your assignment here..."
          value={assignmentText}
          onChange={(e) => {
            setAssignmentText(e.target.value)
            const el = e.target
            el.style.height = 'auto'
            el.style.height = Math.min(el.scrollHeight, 150) + 'px'
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              e.currentTarget.form?.requestSubmit()
            }
          }}
          style={{ ...styles.bottomInput, color: c.text }}
        />
        <button type="submit" disabled={loading} style={styles.sendBtn}>
          <SendIcon color={c.accent} />
        </button>
      </form>
    </div>
  )
}

function ResetPasswordScreen({ onDone }) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage('')
    if (newPassword !== confirmPassword) {
      setMessage('Passwords do not match.')
      return
    }
    if (newPassword.length < 6) {
      setMessage('Password must be at least 6 characters.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setLoading(false)
    if (error) {
      setMessage(error.message)
    } else {
      onDone()
    }
  }

  return (
    <div style={styles.container}>
      <Logo />
      <p className="fade-in-2" style={styles.subtitle}>Set a new password</p>
      <form onSubmit={handleSubmit} className="fade-in-3" style={styles.form}>
        <input
          type="password"
          placeholder="New password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          style={styles.input}
        />
        <input
          type="password"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          style={styles.input}
        />
        <button type="submit" disabled={loading} style={styles.button}>
          {loading ? 'Please wait...' : 'Update Password'}
        </button>
      </form>
      {message && <p style={styles.message}>{message}</p>}
    </div>
  )
}

function App() {
  const [session, setSession] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setCheckingSession(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true)
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  if (checkingSession) {
    return <div style={styles.container}><p>Loading...</p></div>
  }

  if (passwordRecovery) {
    return <ResetPasswordScreen onDone={() => setPasswordRecovery(false)} />
  }

  if (session) {
    return <Dashboard session={session} />
  }

  return <AuthScreen />
}

const styles = {
  container: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', fontFamily: 'sans-serif', textAlign: 'center', backgroundColor: '#0f0f0f', color: '#fff' },
  dashboardContainer: { display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', maxWidth: '640px', margin: '0 auto', width: '100%' },
  settingsContainer: { minHeight: '100vh', padding: '1.2rem', fontFamily: 'sans-serif', maxWidth: '640px', margin: '0 auto', width: '100%' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.2rem' },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '0.3rem' },
  logoWrapper: { width: '160px', height: '160px', borderRadius: '16px', border: '3px solid #ffffff', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', backgroundColor: '#0f0f0f' },
  logoWrapperSmall: { width: '36px', height: '36px', borderRadius: '8px', border: '1.5px solid #fff', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f0f0f', flexShrink: 0 },
  logo: { width: '100%', height: '100%', objectFit: 'cover' },
  subtitle: { color: '#aaa', marginBottom: '2rem' },
  form: { display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '320px', gap: '0.8rem' },
  input: { padding: '0.8rem', borderRadius: '8px', border: '1px solid #333', backgroundColor: '#1a1a1a', color: '#fff', fontSize: '1rem' },
  button: { padding: '0.8rem', borderRadius: '8px', border: 'none', backgroundColor: '#ffffff', color: '#000', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' },
  googleButton: { marginTop: '1rem', padding: '0.8rem', borderRadius: '8px', border: '1px solid #333', backgroundColor: 'transparent', color: '#fff', width: '100%', maxWidth: '320px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  toggle: { marginTop: '1.2rem', color: '#888', cursor: 'pointer', fontSize: '0.9rem' },
  message: { marginTop: '1rem', color: '#4ade80' },
  modeToggle: { display: 'flex', gap: '0.4rem' },
  modeBtn: { padding: '0.4rem 0.8rem', borderRadius: '20px', border: '1px solid', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' },
  messagesArea: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '1rem', overflowY: 'auto', WebkitOverflowScrolling: 'touch' },
  subjectInput: { margin: '0 1rem 0.6rem 1rem', padding: '0.6rem 1rem', borderRadius: '20px', border: '1px solid', fontSize: '0.85rem', outline: 'none' },
  bottomBar: { display: 'flex', alignItems: 'flex-end', gap: '0.6rem', padding: '0.6rem', margin: '0 1rem 1rem 1rem', borderRadius: '24px', border: '1px solid' },
  attachBtn: { display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '0.3rem', background: 'none', border: 'none' },
  attachMenuOverlay: { position: 'fixed', inset: 0, zIndex: 55 },
  attachMenu: { position: 'absolute', bottom: '48px', left: 0, borderRadius: '12px', border: '1px solid', padding: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.2rem', zIndex: 60, minWidth: '150px' },
  attachMenuItem: { display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.55rem 0.5rem', borderRadius: '10px', cursor: 'pointer', fontSize: '0.9rem' },
  attachMenuIconWrap: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0 },
  bottomInput: { flex: 1, border: 'none', outline: 'none', backgroundColor: 'transparent', fontSize: '1rem', fontFamily: 'inherit', resize: 'none', overflowY: 'auto', maxHeight: '150px', lineHeight: '1.4', padding: '0.4rem 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  sendBtn: { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0.3rem' },
  themeBtn: { flex: 1, padding: '0.6rem', borderRadius: '8px', border: '1.5px solid', backgroundColor: 'transparent', cursor: 'pointer', fontSize: '0.9rem' },
  logoutBtn: { width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1.5px solid', backgroundColor: 'transparent', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 'bold' },
  sidebarOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 40 },
  sidebarPanel: { position: 'fixed', top: 0, left: 0, bottom: 0, width: '80%', maxWidth: '300px', borderRight: '1px solid', zIndex: 50, display: 'flex', flexDirection: 'column' },
  newChatSidebarBtn: { display: 'flex', alignItems: 'center', gap: '0.6rem', margin: '0 1rem', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1.5px solid', backgroundColor: 'transparent', cursor: 'pointer', fontSize: '0.9rem' },
  msgFeedbackBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' },
}

export default App
