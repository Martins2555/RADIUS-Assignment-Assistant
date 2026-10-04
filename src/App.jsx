import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'
import { renderToStaticMarkup } from 'react-dom/server'
import 'katex/dist/katex.min.css'

// ---- PWA install prompt -----------------------------------------------------
// The browser fires this event once, early, so it is captured at module level
// and handed to the Settings "Install" card whenever that is on screen.
let deferredInstallPrompt = null
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredInstallPrompt = e
    window.dispatchEvent(new Event('radius-install-ready'))
  })
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null
    window.dispatchEvent(new Event('radius-install-ready'))
  })
}

// While a reply is streaming in, hide the hidden type tag at the start and the
// Study Pack JSON block at the end so the student never sees them flash by.
function cleanStreamText(raw) {
  let t = raw || ''
  t = t.replace(/^\s*\[TYPE:(ASSIGNMENT|GENERAL)\]\s*/i, '')
  if (/^\s*\[[A-Za-z:]*$/.test(t)) return ''
  const idx = t.indexOf('<study_data>')
  if (idx !== -1) t = t.slice(0, idx)
  else t = t.replace(/<[a-z_]{0,11}$/, '')
  return t.trim() ? t : ''
}

function MicIcon({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="9" y="3" width="6" height="11" rx="3" stroke={color} strokeWidth="1.8" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function SearchIcon({ color }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="6.5" stroke={color} strokeWidth="1.8" />
      <path d="M16 16l4.5 4.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function InstallCard({ c }) {
  const [canPrompt, setCanPrompt] = useState(!!deferredInstallPrompt)
  useEffect(() => {
    const sync = () => setCanPrompt(!!deferredInstallPrompt)
    window.addEventListener('radius-install-ready', sync)
    return () => window.removeEventListener('radius-install-ready', sync)
  }, [])

  const standalone =
    typeof window !== 'undefined' &&
    ((window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true)
  if (standalone) return null

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const install = async () => {
    if (!deferredInstallPrompt) return
    deferredInstallPrompt.prompt()
    try { await deferredInstallPrompt.userChoice } catch (e) { /* ignore */ }
    deferredInstallPrompt = null
    setCanPrompt(false)
  }

  return (
    <SettingsCard c={c}>
      <p style={{ color: c.subtext, fontSize: '0.78rem', fontWeight: 'bold', letterSpacing: '0.04em', margin: '0 0 0.6rem' }}>INSTALL APP</p>
      <p style={{ margin: '0 0 0.7rem', fontSize: '0.88rem', lineHeight: '1.5', color: c.text }}>
        Add RADIUS to your home screen to open it full-screen like a normal app.
      </p>
      {canPrompt ? (
        <button
          type="button"
          onClick={install}
          style={{ padding: '0.65rem 1rem', borderRadius: '10px', border: 'none', backgroundColor: c.accent, backgroundImage: c.accentGrad, color: c.accentText, fontWeight: 'bold', fontSize: '0.88rem', cursor: 'pointer' }}
        >
          Install RADIUS
        </button>
      ) : (
        <p style={{ margin: 0, fontSize: '0.8rem', color: c.subtext, lineHeight: '1.5' }}>
          {isIOS
            ? 'On iPhone: tap the Share button in Safari, then "Add to Home Screen".'
            : 'Open your browser menu (the three dots) and tap "Install app" or "Add to Home screen".'}
        </p>
      )}
    </SettingsCard>
  )
}

function EyeIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.7" />
    </svg>
  )
}

function EyeOffIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M3 3l18 18M9.9 9.9a3 3 0 0 0 4.2 4.2M6.2 6.5C3.9 8 1.5 12 1.5 12s3.5 7 10.5 7c1.9 0 3.5-.5 4.9-1.2M17 16.2C20 14.5 22.5 12 22.5 12s-1-2-3-3.8" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

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

function StopIcon({ color }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect x="5" y="5" width="14" height="14" rx="2.5" fill={color} />
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

function XSocialIcon({ color }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={color}>
      <path d="M18.9 2.4h3.3l-7.2 8.2 8.5 11h-6.6l-5.2-6.8-5.9 6.8H2.4l7.7-8.8L2 2.4h6.8l4.7 6.2zM17.7 19.6h1.8L7.4 4.3H5.5z" />
    </svg>
  )
}

function FlameIcon({ color }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={color}>
      <path d="M12 2c1 3-3 4.5-3 8a3 3 0 0 0 6 0c0-1-.4-1.8-1-2.5 2 1 3.5 3.3 3.5 5.8a5.5 5.5 0 0 1-11 0C6.5 9 9 6.5 12 2z" />
    </svg>
  )
}

// Chat accent colours. Each has a main shade and a slightly deeper second
// shade (used for the soft gradient on buttons and bubbles), for dark and
// light mode, plus the text colour that reads best on top of it.
// All unlocked for now; this is where a premium lock would slot in later.
const accentColors = {
  green:   { dark: '#34d27b', dark2: '#1fb862', light: '#16a34a', light2: '#12853b', onDark: '#052412', onLight: '#ffffff', label: 'Emerald' },
  blue:    { dark: '#5b9bff', dark2: '#3a7cf5', light: '#2563eb', light2: '#1d4fd8', onDark: '#ffffff', onLight: '#ffffff', label: 'Ocean' },
  purple:  { dark: '#a877f7', dark2: '#8b4fe6', light: '#9333ea', light2: '#7a24cc', onDark: '#ffffff', onLight: '#ffffff', label: 'Violet' },
  pink:    { dark: '#f45fa8', dark2: '#e03c8d', light: '#db2777', light2: '#bf1d65', onDark: '#ffffff', onLight: '#ffffff', label: 'Rose' },
  orange:  { dark: '#fb923c', dark2: '#f97316', light: '#ea580c', light2: '#cf4a09', onDark: '#1c0b01', onLight: '#ffffff', label: 'Sunset' },
  teal:    { dark: '#2dd4bf', dark2: '#14b8a6', light: '#0d9488', light2: '#0b7a70', onDark: '#022b27', onLight: '#ffffff', label: 'Teal' },
  cyan:    { dark: '#38d4f5', dark2: '#1fb6e0', light: '#0891b2', light2: '#0a7893', onDark: '#03242d', onLight: '#ffffff', label: 'Cyan' },
  indigo:  { dark: '#7c83fd', dark2: '#5b63f0', light: '#4f46e5', light2: '#4038c7', onDark: '#ffffff', onLight: '#ffffff', label: 'Indigo' },
  red:     { dark: '#f5636b', dark2: '#e63946', light: '#dc2626', light2: '#b91c1c', onDark: '#ffffff', onLight: '#ffffff', label: 'Crimson' },
  amber:   { dark: '#fbbf24', dark2: '#f59e0b', light: '#d97706', light2: '#b45309', onDark: '#2b1700', onLight: '#ffffff', label: 'Amber' },
  lime:    { dark: '#a3e635', dark2: '#84cc16', light: '#65a30d', light2: '#4d7c0f', onDark: '#122004', onLight: '#ffffff', label: 'Lime' },
  magenta: { dark: '#e879f9', dark2: '#d946ef', light: '#c026d3', light2: '#a21caf', onDark: '#2b0530', onLight: '#ffffff', label: 'Orchid' },
}
const accentOrder = ['green', 'blue', 'purple', 'pink', 'orange', 'teal', 'cyan', 'indigo', 'red', 'amber', 'lime', 'magenta']

// Quick follow-up actions shown after an assignment-type reply.
const STUDY_ACTIONS = [
  { label: 'Explain this', prompt: 'Explain this topic clearly, from the basics up, with one worked example.' },
  { label: 'Give me a hint', prompt: "Don't give the answer. Give me one hint for the next step only." },
  { label: 'Quiz me', prompt: 'Quiz me with 5 questions on this topic, one at a time. Wait for my answer before revealing the next.' },
  { label: 'Summarize', prompt: 'Summarize this topic into short revision notes I can memorise.' },
  { label: 'Show solution', prompt: 'Now show the complete worked solution with every step and the final answer.' },
]

const RESPONSE_STYLES = [
  { value: 'concise', label: 'Concise — straight to the point' },
  { value: 'balanced', label: 'Balanced — clear steps' },
  { value: 'detailed', label: 'Detailed — full reasoning' },
]

const SUBJECTS = [
  { value: 'auto', label: 'Auto detect' },
  { value: 'Mathematics', label: 'Mathematics' },
  { value: 'Physics', label: 'Physics' },
  { value: 'Chemistry', label: 'Chemistry' },
  { value: 'Engineering', label: 'Engineering' },
  { value: 'Computer Science', label: 'Computer Science' },
  { value: 'Programming', label: 'Programming' },
  { value: 'Biology', label: 'Biology' },
  { value: 'Economics', label: 'Economics' },
  { value: 'Business', label: 'Business' },
  { value: 'English', label: 'English' },
  { value: 'General', label: 'General' },
]

const modeBase = {
  dark: { bg: '#0a0c12', surface: '#121622', surfaceAlt: '#1a2030', border: '#262d42', text: '#eef1f8', subtext: '#8f98ae' },
  light: { bg: '#f3f5fa', surface: '#ffffff', surfaceAlt: '#eaeef6', border: '#dde2ee', text: '#0f1320', subtext: '#586179' },
}

function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

function getPalette(theme, accentColor) {
  const base = modeBase[theme] || modeBase.dark
  const ac = accentColors[accentColor] || accentColors.green
  const light = theme === 'light'
  const a1 = light ? ac.light : ac.dark
  const a2 = light ? ac.light2 : ac.dark2
  return {
    ...base,
    accent: a1,
    accent2: a2,
    accentGrad: `linear-gradient(135deg, ${a1}, ${a2})`,
    accentText: light ? ac.onLight : ac.onDark,
    accentSoft: hexToRgba(a1, light ? 0.16 : 0.22),
    accentGlow: hexToRgba(a1, light ? 0.28 : 0.34),
    bgGlow: `radial-gradient(900px 480px at 100% -5%, ${hexToRgba(a1, light ? 0.1 : 0.13)}, transparent 62%), radial-gradient(700px 420px at -10% 105%, ${hexToRgba(a2, light ? 0.07 : 0.09)}, transparent 62%)`,
  }
}

const HERO_PARTICLES = [
  { left: '8%', top: '30%', size: 5, delay: '0s' },
  { left: '88%', top: '24%', size: 4, delay: '1.2s' },
  { left: '16%', top: '78%', size: 6, delay: '2.1s' },
  { left: '82%', top: '74%', size: 5, delay: '0.6s' },
  { left: '50%', top: '4%', size: 4, delay: '1.8s' },
  { left: '60%', top: '94%', size: 4, delay: '2.6s' },
  { left: '30%', top: '10%', size: 3, delay: '3.1s' },
]

// 3D hero: orbiting rings around the floating logo. The whole scene tilts
// with your finger or mouse, and with the phone itself on Android.
function Hero3D({ size = 230 }) {
  const stageRef = useRef(null)

  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const el = stageRef.current
    if (!el) return undefined
    let raf = 0
    const apply = (rx, ry) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        el.style.setProperty('--tilt-x', `${rx}deg`)
        el.style.setProperty('--tilt-y', `${ry}deg`)
      })
    }
    const onPointer = (e) => {
      const nx = e.clientX / window.innerWidth - 0.5
      const ny = e.clientY / window.innerHeight - 0.5
      apply(-ny * 26, nx * 34)
    }
    const onOrient = (e) => {
      if (e.gamma == null) return
      const ry = Math.max(-25, Math.min(25, e.gamma)) * 0.9
      const rx = Math.max(-25, Math.min(25, (e.beta || 45) - 45)) * -0.9
      apply(rx, ry)
    }
    window.addEventListener('pointermove', onPointer, { passive: true })
    window.addEventListener('deviceorientation', onOrient, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('deviceorientation', onOrient)
    }
  }, [])

  return (
    <div style={{ width: size, height: size, flexShrink: 0 }}>
      <div className="r3d-scene" style={{ transform: `scale(${size / 230})`, transformOrigin: 'top left' }}>
        <div className="r3d-glow" />
        <div className="r3d-stage" ref={stageRef}>
          <span className="r3d-ring r3d-ring-a" />
          <span className="r3d-ring r3d-ring-b" />
          <span className="r3d-ring r3d-ring-c" />
          {HERO_PARTICLES.map((d, i) => (
            <span key={i} className="r3d-dot" style={{ left: d.left, top: d.top, width: d.size, height: d.size, animationDelay: d.delay }} />
          ))}
          <div className="r3d-core">
            <img src="/logo.png" alt="RADIUS" />
          </div>
        </div>
      </div>
    </div>
  )
}

// Small spinning 3D cube, used as the loading indicator.
function Cube3D({ size = 20 }) {
  return (
    <span className="cube3d-wrap" style={{ width: size + 10, height: size + 10, perspective: `${size * 7}px` }}>
      <span className="cube3d" style={{ '--s': `${size}px` }}>
        <i className="cf-front" />
        <i className="cf-back" />
        <i className="cf-right" />
        <i className="cf-left" />
        <i className="cf-top" />
        <i className="cf-bottom" />
      </span>
    </span>
  )
}

function Logo({ small }) {
  if (!small) return <Hero3D />
  return (
    <div style={styles.logoWrapperSmall}>
      <img src="/logo.png" alt="RADIUS" style={styles.logo} />
    </div>
  )
}

function AuthScreen({ initialSignUp = true }) {
  const [isSignUp, setIsSignUp] = useState(initialSignUp)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
    // Without this, Google silently reuses whatever account is already
    // signed in on the device instead of showing the account picker -
    // exactly the "it just opens my old account" symptom reported.
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { queryParams: { prompt: 'select_account' } },
    })
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
        <div style={{ position: 'relative' }}>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ ...styles.input, width: '100%', boxSizing: 'border-box', paddingRight: '2.6rem' }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            style={{ position: 'absolute', right: '0.7rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex' }}
          >
            {showPassword ? <EyeOffIcon color="#888" /> : <EyeIcon color="#888" />}
          </button>
        </div>
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

function LandingScreen({ onGetStarted, onSignIn }) {
  const points = [
    { title: 'Step-by-step solutions', body: 'Every calculation shown, with the final answer stated clearly at the end.' },
    { title: 'Photo a question', body: 'Upload a picture of a printed or handwritten question and get it worked through.' },
    { title: 'Private history', body: 'Your conversations and uploads are saved and private to your account.' },
  ]
  return (
    <div style={{ ...styles.container, justifyContent: 'flex-start', paddingTop: '3rem' }}>
      <Logo />
      <p style={{ color: '#5eead4', fontSize: '0.8rem', fontWeight: 'bold', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '1.2rem 0 0.6rem' }}>
        Academic Assistant
      </p>
      <h1 className="fade-in-2" style={{ fontSize: '1.7rem', fontWeight: 'bold', lineHeight: '1.25', margin: '0 0 0.8rem' }}>
        Understand your assignment, don't just finish it.
      </h1>
      <p className="fade-in-3" style={{ color: '#aaa', lineHeight: '1.6', maxWidth: '340px', margin: '0 0 1.6rem' }}>
        RADIUS explains your assignment questions step by step, checks work you've already done, and turns hard topics into something you can revise from.
      </p>
      <div className="fade-in-3" style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', width: '100%', maxWidth: '320px' }}>
        <button onClick={onGetStarted} style={styles.button}>Get Started</button>
        <p style={{ ...styles.toggle, marginTop: 0 }} onClick={onSignIn}>Already have an account? Log in</p>
      </div>

      <div style={{ marginTop: '2.5rem', width: '100%', maxWidth: '360px', textAlign: 'left' }}>
        {points.map((p, i) => (
          <div key={p.title} className="card3d-in" style={{ border: '1px solid #262d42', borderRadius: '16px', padding: '1rem', marginBottom: '0.8rem', backgroundColor: '#121622', boxShadow: '0 10px 26px rgba(0,0,0,0.25)', animationDelay: `${0.35 + i * 0.15}s` }}>
            <p style={{ fontWeight: 'bold', margin: '0 0 0.3rem' }}>{p.title}</p>
            <p style={{ color: '#aaa', fontSize: '0.85rem', margin: 0, lineHeight: '1.5' }}>{p.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function AboutScreen({ theme, accentColor, onBack }) {
  const c = getPalette(theme, accentColor)
  const points = [
    { title: 'Understand, then answer', body: 'Every reply separates the explanation from the final answer, so you can follow the method before you read the result.' },
    { title: 'Quick follow-ups after every answer', body: 'Ask for a hint, a quiz, a summary, or the full solution with one tap - no need to retype your question.' },
    { title: 'Photograph your question', body: 'Upload a picture of a printed or handwritten question and RADIUS will read it and work through it with you.' },
    { title: 'Your work stays yours', body: 'Signed-in students get private history and uploads that only they can see.' },
  ]
  return (
    <div style={{ ...styles.settingsContainer, backgroundColor: c.bg, backgroundImage: c.bgGlow, color: c.text }}>
      <div style={styles.topBar}>
        <button onClick={onBack} style={styles.iconBtn}><BackIcon color={c.text} /></button>
        <span style={{ fontWeight: 'bold' }}>About</span>
        <div style={{ width: '22px' }} />
      </div>
      <div style={{ padding: '0.5rem 0.2rem 2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '0.5rem 0 0.8rem' }}>About RADIUS</h1>
        <p style={{ color: c.subtext, lineHeight: '1.6', margin: '0 0 1.5rem' }}>
          RADIUS is an academic assistant for university and college students. It covers mathematics, physics, chemistry,
          engineering, computer science, programming, biology, economics, business and English, and it is built around
          one idea: an answer is only useful if you understand how it was reached.
        </p>
        {points.map((p) => (
          <SettingsCard key={p.title} c={c}>
            <p style={{ fontWeight: 'bold', margin: '0 0 0.4rem' }}>{p.title}</p>
            <p style={{ color: c.subtext, fontSize: '0.88rem', margin: 0, lineHeight: '1.55' }}>{p.body}</p>
          </SettingsCard>
        ))}
        <SettingsCard c={c} style={{ backgroundColor: `${c.accent}14` }}>
          <p style={{ fontWeight: 'bold', margin: '0 0 0.4rem' }}>Using RADIUS honestly</p>
          <p style={{ color: c.subtext, fontSize: '0.88rem', margin: 0, lineHeight: '1.55' }}>
            RADIUS is a study tool. Check your institution's rules on assisted work, and always submit work you
            understand and can defend. RADIUS will tell you when it is unsure rather than invent facts, data or sources.
          </p>
        </SettingsCard>
      </div>
    </div>
  )
}

function NicknamePrompt({ theme, accentColor, onSave, onSkip }) {
  const c = getPalette(theme, accentColor)
  const [value, setValue] = useState('')

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        zIndex: 90,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.2rem',
      }}
    >
      <div style={{ backgroundColor: c.surface, border: `1px solid ${c.border}`, borderRadius: '16px', padding: '1.4rem', maxWidth: '340px', width: '100%' }}>
        <p style={{ fontSize: '1.05rem', fontWeight: 'bold', color: c.text, margin: '0 0 0.4rem' }}>What should I call you?</p>
        <p style={{ fontSize: '0.85rem', color: c.subtext, margin: '0 0 1rem' }}>
          RADIUS will use this to address you, instead of your email.
        </p>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. Martins"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '0.7rem 0.9rem',
            borderRadius: '10px',
            border: `1px solid ${c.border}`,
            backgroundColor: c.bg,
            color: c.text,
            fontSize: '0.95rem',
            marginBottom: '1rem',
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button
            onClick={onSkip}
            style={{ flex: 1, padding: '0.7rem', borderRadius: '10px', border: `1px solid ${c.border}`, backgroundColor: 'transparent', color: c.subtext, cursor: 'pointer', fontSize: '0.9rem' }}
          >
            Skip for now
          </button>
          <button
            onClick={() => value.trim() && onSave(value.trim())}
            style={{ flex: 1, padding: '0.7rem', borderRadius: '10px', border: 'none', backgroundColor: c.accent, backgroundImage: c.accentGrad, color: c.accentText, fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem' }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

function SettingsScreen({ session, theme, themePreference, setThemePreference, accentColor, setAccentColor, profile, onSaveNickname, onSavePreference, onAvatarChange, avatarInputRef, enterToSend, setEnterToSend, onDeleteAccount, onBack }) {
  const c = getPalette(theme, accentColor)
  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div style={{ ...styles.settingsContainer, backgroundColor: c.bg, backgroundImage: c.bgGlow, color: c.text }}>
      <div style={styles.topBar}>
        <button onClick={onBack} style={styles.iconBtn}><BackIcon color={c.text} /></button>
        <span className="radius-display" style={{ fontWeight: 700, fontSize: '1.1rem' }}>Settings</span>
        <div style={{ width: '22px' }} />
      </div>

      <SettingsBody
        session={session}
        theme={theme}
        themePreference={themePreference}
        setThemePreference={setThemePreference}
        accentColor={accentColor}
        setAccentColor={setAccentColor}
        profile={profile}
        onSaveNickname={onSaveNickname}
        onSavePreference={onSavePreference}
        onAvatarChange={onAvatarChange}
        avatarInputRef={avatarInputRef}
        enterToSend={enterToSend}
        setEnterToSend={setEnterToSend}
        onDeleteAccount={onDeleteAccount}
        onLogout={handleLogout}
        c={c}
      />
    </div>
  )
}

function SettingsCard({ c, children, style }) {
  return (
    <div style={{ backgroundColor: c.surface, border: `1px solid ${c.border}`, borderRadius: '20px', padding: '1.2rem', marginBottom: '1rem', boxShadow: '0 8px 24px rgba(0,0,0,0.14)', ...style }}>
      {children}
    </div>
  )
}

function SettingsBody({ session, theme, themePreference, setThemePreference, accentColor, setAccentColor, profile, onSaveNickname, onSavePreference, onAvatarChange, avatarInputRef, enterToSend, setEnterToSend, onDeleteAccount, onLogout, c }) {
  const [nicknameDraft, setNicknameDraft] = useState(profile?.nickname || '')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const handleDeleteClick = async () => {
    if (!window.confirm('Permanently delete your account and everything in it? This cannot be undone.')) return
    setDeleting(true)
    setDeleteError('')
    try {
      await onDeleteAccount()
    } catch (e) {
      setDeleteError(e.message || 'Your account could not be deleted. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const nicknameChanged = nicknameDraft.trim() && nicknameDraft.trim() !== (profile?.nickname || '')
  const initial = (profile?.nickname || session.user.email || '?')[0].toUpperCase()

  return (
    <div style={{ padding: '1.2rem 1rem 2rem' }}>
      {/* Profile header */}
      <SettingsCard c={c} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div
            onClick={() => avatarInputRef.current?.click()}
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: c.accent,
              backgroundImage: profile?.avatar_url ? `url(${profile.avatar_url})` : c.accentGrad,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: c.accentText,
              fontSize: '1.4rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              border: `2px solid ${c.border}`,
            }}
          >
            {!profile?.avatar_url && initial}
          </div>
          <div
            onClick={() => avatarInputRef.current?.click()}
            style={{
              position: 'absolute',
              bottom: -2,
              right: -2,
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: c.bg,
              border: `1.5px solid ${c.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <CameraIcon color={c.text} />
          </div>
          <input ref={avatarInputRef} type="file" accept="image/*" onChange={onAvatarChange} style={{ display: 'none' }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              value={nicknameDraft}
              onChange={(e) => setNicknameDraft(e.target.value)}
              placeholder="Add a nickname"
              style={{
                flex: 1,
                minWidth: 0,
                padding: '0.5rem 0.7rem',
                borderRadius: '8px',
                border: `1px solid ${c.border}`,
                backgroundColor: c.bg,
                color: c.text,
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />
            {nicknameChanged && (
              <button
                onClick={() => onSaveNickname(nicknameDraft.trim())}
                style={{ padding: '0.5rem 0.8rem', borderRadius: '8px', border: 'none', backgroundColor: c.accent, backgroundImage: c.accentGrad, color: c.accentText, fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer' }}
              >
                Save
              </button>
            )}
          </div>
          <p style={{ color: c.subtext, fontSize: '0.78rem', margin: '0.5rem 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {session.user.email}
          </p>
        </div>
      </SettingsCard>

      {/* Streak */}
      <SettingsCard c={c} style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
        <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: `${c.accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <FlameIcon color={c.accent} />
        </div>
        <div>
          <p style={{ margin: 0, fontWeight: 'bold', color: c.text, fontSize: '0.95rem' }}>
            {profile?.streak_count > 0 ? `${profile.streak_count}-day streak` : 'No streak yet'}
          </p>
          <p style={{ margin: '2px 0 0', color: c.subtext, fontSize: '0.78rem' }}>Use RADIUS at least once a day to keep it going. Just for you — not shared or ranked.</p>
        </div>
      </SettingsCard>

      {/* Appearance */}
      <SettingsCard c={c}>
        <p style={{ color: c.subtext, fontSize: '0.78rem', fontWeight: 'bold', letterSpacing: '0.04em', margin: '0 0 0.7rem' }}>APPEARANCE</p>
        <div style={{ display: 'flex', backgroundColor: c.surfaceAlt, borderRadius: '14px', padding: '4px', border: `1px solid ${c.border}` }}>
          {[
            { key: 'dark', label: '🌙 Dark' },
            { key: 'light', label: '☀️ Light' },
            { key: 'system', label: '📱 System' },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setThemePreference(opt.key)}
              style={{
                flex: 1,
                padding: '0.6rem 0',
                borderRadius: '11px',
                border: 'none',
                backgroundColor: themePreference === opt.key ? c.accent : 'transparent', backgroundImage: themePreference === opt.key ? c.accentGrad : 'none',
                color: themePreference === opt.key ? c.accentText : c.subtext,
                fontWeight: themePreference === opt.key ? 700 : 500,
                fontSize: '0.82rem',
                cursor: 'pointer',
                transition: 'background-color 0.15s',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <p style={{ color: c.subtext, fontSize: '0.78rem', fontWeight: 'bold', letterSpacing: '0.04em', margin: '1.3rem 0 0.5rem' }}>ANSWER LENGTH</p>
        <select
          value={profile?.response_style || 'balanced'}
          onChange={(e) => onSavePreference('response_style', e.target.value)}
          style={{ width: '100%', padding: '0.8rem 0.95rem', borderRadius: '14px', border: `1.5px solid ${c.border}`, backgroundColor: c.surfaceAlt, color: c.text, fontSize: '0.9rem', fontWeight: 600 }}
        >
          {RESPONSE_STYLES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <p style={{ color: c.subtext, fontSize: '0.78rem', fontWeight: 'bold', letterSpacing: '0.04em', margin: '1.3rem 0 0.5rem' }}>DEFAULT SUBJECT</p>
        <select
          value={profile?.preferred_subject || 'auto'}
          onChange={(e) => onSavePreference('preferred_subject', e.target.value)}
          style={{ width: '100%', padding: '0.8rem 0.95rem', borderRadius: '14px', border: `1.5px solid ${c.border}`, backgroundColor: c.surfaceAlt, color: c.text, fontSize: '0.9rem', fontWeight: 600 }}
        >
          {SUBJECTS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <p style={{ color: c.subtext, fontSize: '0.78rem', fontWeight: 'bold', letterSpacing: '0.04em', margin: '1.3rem 0 0.7rem' }}>CHAT COLOR</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem' }}>
          {accentOrder.map((key) => (
            <button
              key={key}
              onClick={() => setAccentColor(key)}
              aria-label={accentColors[key].label}
              title={accentColors[key].label}
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
              <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundImage: `linear-gradient(135deg, ${accentColors[key][theme] || accentColors[key].dark}, ${accentColors[key][theme === 'light' ? 'light2' : 'dark2']})`, boxShadow: `0 3px 10px ${hexToRgba(accentColors[key][theme] || accentColors[key].dark, 0.45)}`, display: 'block' }} />
            </button>
          ))}
        </div>
        <p style={{ color: c.subtext, fontSize: '0.75rem', marginTop: '0.7rem' }}>Custom backgrounds are coming with premium.</p>
      </SettingsCard>

      {/* Messaging */}
      <SettingsCard c={c}>
        <p style={{ color: c.subtext, fontSize: '0.78rem', fontWeight: 'bold', letterSpacing: '0.04em', margin: '0 0 0.7rem' }}>MESSAGING</p>
        <div
          onClick={() => setEnterToSend(!enterToSend)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
        >
          <div>
            <p style={{ margin: 0, fontSize: '0.9rem', color: c.text }}>Enter key sends message</p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: c.subtext }}>
              {enterToSend ? 'Enter sends — Shift+Enter for a new line' : 'Enter starts a new line — tap send to submit'}
            </p>
          </div>
          <span
            style={{
              width: '42px',
              height: '24px',
              borderRadius: '12px',
              backgroundColor: enterToSend ? c.accent : c.border,
              position: 'relative',
              flexShrink: 0,
              transition: 'background-color 0.15s ease',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: '2px',
                left: enterToSend ? '20px' : '2px',
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: '#fff',
                transition: 'left 0.15s ease',
              }}
            />
          </span>
        </div>
      </SettingsCard>

      {/* Install as an app */}
      <InstallCard c={c} />

      {/* Membership */}
      <SettingsCard c={c} style={{ padding: 0, overflow: 'hidden' }}>
        <button
          onClick={() => alert('Payment methods incoming — RADIUS Plus will be available soon!')}
          style={{
            width: '100%',
            padding: '1rem 1.2rem',
            border: 'none',
            background: `linear-gradient(135deg, ${c.accent}26, transparent)`,
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
      </SettingsCard>

      {/* Socials */}
      <SettingsCard c={c}>
        <p style={{ color: c.subtext, fontSize: '0.78rem', fontWeight: 'bold', letterSpacing: '0.04em', margin: '0 0 0.7rem' }}>OFFICIAL HANDLES</p>
        <a
          href="https://x.com/RadiusAI"
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.7rem',
            padding: '0.7rem',
            borderRadius: '10px',
            backgroundColor: c.bg,
            border: `1px solid ${c.border}`,
            color: c.text,
            textDecoration: 'none',
            fontSize: '0.9rem',
          }}
        >
          <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: theme === 'dark' ? '#fff' : '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <XSocialIcon color={theme === 'dark' ? '#000' : '#fff'} />
          </div>
          <span>@RadiusAI on X</span>
        </a>
      </SettingsCard>

      <SettingsCard c={c} style={{ borderColor: '#ef444455' }}>
        <p style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '0.9rem', margin: '0 0 0.4rem' }}>Delete account</p>
        <p style={{ color: c.subtext, fontSize: '0.82rem', margin: '0 0 0.8rem', lineHeight: '1.5' }}>
          This permanently removes your conversations, uploads, and sign-in. This cannot be undone.
        </p>
        {deleteError && <p style={{ color: '#ef4444', fontSize: '0.82rem', margin: '0 0 0.6rem' }}>{deleteError}</p>}
        <button
          onClick={handleDeleteClick}
          disabled={deleting}
          style={{ padding: '0.6rem 1rem', borderRadius: '8px', border: '1.5px solid #ef4444', backgroundColor: 'transparent', color: '#ef4444', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer', opacity: deleting ? 0.6 : 1 }}
        >
          {deleting ? 'Deleting...' : 'Delete my account'}
        </button>
      </SettingsCard>

      <button onClick={onLogout} style={{ ...styles.logoutBtn, borderColor: c.border, color: '#ef4444', width: '100%', boxSizing: 'border-box' }}>
        Log Out
      </button>
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

function ReplyIcon({ color }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M9 7L4 12l5 5" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 12h9a7 7 0 0 1 7 7v1" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Swipe a message bubble to the right to reply to it (like WhatsApp/Telegram).
// Only reacts to a mostly-horizontal rightward drag, so normal scrolling and
// tables that scroll sideways (marked data-noswipe) are left alone.
const SWIPE_TRIGGER = 56
function useSwipeReply(onReply) {
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

// Study Pack replies carry their flashcards/quiz as a hidden marker at the end
// of the message text. It is stripped before display, copy, share and before
// the history is sent back to the model.
const STUDY_RE = /\n*<!--STUDY:([\s\S]*?)-->/

const SRC_RE = /\n*<!--SRC:([\s\S]*?)-->/

function splitStudy(content) {
  let raw = content || ''
  let sources = []
  const sm = raw.match(SRC_RE)
  if (sm) {
    try { sources = JSON.parse(decodeURIComponent(sm[1])) } catch (e) { sources = [] }
    raw = raw.replace(SRC_RE, '')
  }
  const m = raw.match(STUDY_RE)
  if (!m) return { text: raw.trim(), deck: null, sources }
  let deck = null
  try { deck = JSON.parse(decodeURIComponent(m[1])) } catch (e) { deck = null }
  return { text: raw.replace(STUDY_RE, '').trim(), deck, sources }
}

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

// Must match the limit enforced in api/generate.js (check_rate_limit call).
const HOURLY_LIMIT = 20

function ShareIcon({ color }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <circle cx="18" cy="5" r="2.6" stroke={color} strokeWidth="1.8" />
      <circle cx="6" cy="12" r="2.6" stroke={color} strokeWidth="1.8" />
      <circle cx="18" cy="19" r="2.6" stroke={color} strokeWidth="1.8" />
      <path d="M8.3 10.8l7.4-4.4M8.3 13.2l7.4 4.4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function DownloadIcon({ color }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function StudyDeck({ deck, c }) {
  const cards = Array.isArray(deck?.flashcards) ? deck.flashcards : []
  const quiz = Array.isArray(deck?.quiz) ? deck.quiz : []
  const [tab, setTab] = useState(cards.length ? 'cards' : 'quiz')
  const [ci, setCi] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [qi, setQi] = useState(0)
  const [picked, setPicked] = useState(null)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)

  if (!cards.length && !quiz.length) return null

  const tabBtn = (id, label) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      style={{ ...styles.chipBtn, borderColor: c.border, backgroundColor: tab === id ? c.accent : 'transparent', backgroundImage: tab === id ? c.accentGrad : 'none', color: tab === id ? c.accentText : c.text }}
    >
      {label}
    </button>
  )

  // Flip back first, then swap the card, so the next answer is never seen
  // through the back of the card while it turns.
  const goCard = (next) => {
    if (flipped) {
      setFlipped(false)
      setTimeout(() => setCi(next), 230)
    } else {
      setCi(next)
    }
  }
  const pickOption = (i) => {
    if (picked !== null) return
    setPicked(i)
    if (i === Number(quiz[qi].answer)) setScore((v) => v + 1)
  }
  const nextQuestion = () => {
    if (qi + 1 >= quiz.length) { setDone(true); return }
    setQi(qi + 1)
    setPicked(null)
  }
  const restartQuiz = () => { setQi(0); setPicked(null); setScore(0); setDone(false) }

  return (
    <div data-noswipe="true" style={{ width: '100%', maxWidth: '420px', margin: '0.6rem 0 0.4rem', padding: '0.8rem', borderRadius: '16px', border: `1px solid ${c.border}`, backgroundColor: c.surface, color: c.text }}>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.7rem' }}>
        {cards.length > 0 && tabBtn('cards', `Flashcards (${cards.length})`)}
        {quiz.length > 0 && tabBtn('quiz', `Quiz (${quiz.length})`)}
      </div>

      {tab === 'cards' && cards.length > 0 && (
        <div>
          <div onClick={() => setFlipped((v) => !v)} style={{ perspective: '1000px', cursor: 'pointer' }}>
            <div style={{ display: 'grid', transformStyle: 'preserve-3d', transition: 'transform 0.5s cubic-bezier(0.4, 0.2, 0.2, 1)', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
              <div style={{ gridArea: '1 / 1', minHeight: '150px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '1rem', borderRadius: '14px', border: `1px solid ${c.border}`, backgroundColor: c.bg, color: c.text, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
                <span style={{ fontSize: '0.7rem', opacity: 0.7, marginBottom: '0.5rem' }}>QUESTION (tap to flip)</span>
                <span style={{ fontSize: '1rem', lineHeight: 1.5 }}>{cards[ci].q}</span>
              </div>
              <div style={{ gridArea: '1 / 1', minHeight: '150px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '1rem', borderRadius: '14px', border: `1px solid ${c.border}`, backgroundColor: c.accent, backgroundImage: c.accentGrad, color: c.accentText, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                <span style={{ fontSize: '0.7rem', opacity: 0.8, marginBottom: '0.5rem' }}>ANSWER</span>
                <span style={{ fontSize: '1rem', lineHeight: 1.5 }}>{cards[ci].a}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.7rem' }}>
            <button type="button" disabled={ci === 0} onClick={() => goCard(ci - 1)} style={{ ...styles.chipBtn, borderColor: c.border, color: c.text, opacity: ci === 0 ? 0.4 : 1 }}>Prev</button>
            <span style={{ fontSize: '0.8rem', color: c.subtext }}>{ci + 1} / {cards.length}</span>
            <button type="button" disabled={ci === cards.length - 1} onClick={() => goCard(ci + 1)} style={{ ...styles.chipBtn, borderColor: c.border, color: c.text, opacity: ci === cards.length - 1 ? 0.4 : 1 }}>Next</button>
          </div>
        </div>
      )}

      {tab === 'quiz' && quiz.length > 0 && (
        done ? (
          <div style={{ textAlign: 'center', padding: '0.6rem 0' }}>
            <p style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>You scored {score} / {quiz.length}</p>
            <p style={{ color: c.subtext, fontSize: '0.85rem', margin: '0.4rem 0 0.8rem' }}>
              {score === quiz.length ? 'Perfect. You know this topic.' : score >= Math.ceil(quiz.length / 2) ? 'Good job. Review the ones you missed.' : 'Go through the flashcards again, then retry.'}
            </p>
            <button type="button" onClick={restartQuiz} style={{ ...styles.chipBtn, borderColor: c.border, color: c.text }}>Try again</button>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: '0.75rem', color: c.subtext, marginBottom: '0.4rem' }}>Question {qi + 1} of {quiz.length}</p>
            <p style={{ fontWeight: 'bold', marginBottom: '0.7rem', lineHeight: 1.5 }}>{quiz[qi].q}</p>
            {(quiz[qi].options || []).map((opt, i) => {
              const isCorrect = i === Number(quiz[qi].answer)
              const isPicked = picked === i
              let bg = 'transparent'
              let border = c.border
              if (picked !== null && isCorrect) { bg = 'rgba(34,197,94,0.18)'; border = '#22c55e' }
              else if (isPicked) { bg = 'rgba(239,68,68,0.18)'; border = '#ef4444' }
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pickOption(i)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.6rem 0.8rem', marginBottom: '0.45rem', borderRadius: '12px', border: `1.5px solid ${border}`, backgroundColor: bg, color: c.text, fontSize: '0.88rem', cursor: picked === null ? 'pointer' : 'default' }}
                >
                  {String.fromCharCode(65 + i)}. {opt}
                </button>
              )
            })}
            {picked !== null && (
              <div style={{ marginTop: '0.5rem' }}>
                {quiz[qi].why && <p style={{ fontSize: '0.82rem', color: c.subtext, marginBottom: '0.6rem' }}>{picked === Number(quiz[qi].answer) ? 'Correct. ' : 'Not quite. '}{quiz[qi].why}</p>}
                <button type="button" onClick={nextQuestion} style={{ ...styles.chipBtn, borderColor: c.border, backgroundColor: c.accent, backgroundImage: c.accentGrad, color: c.accentText }}>
                  {qi + 1 >= quiz.length ? 'See score' : 'Next question'}
                </button>
              </div>
            )}
          </div>
        )
      )}
    </div>
  )
}

function MessageBubble({ id, role, content, theme, accentColor, feedback, onLongPress, onCopy, onFeedback, onShare, onExportPdf, onReply }) {
  const c = getPalette(theme, accentColor)
  const isUser = role === 'user'
  const { text: displayText, deck, sources } = isUser ? { text: content, deck: null, sources: [] } : splitStudy(content)
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
            rehypePlugins={[rehypeKatex]}
            components={{
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

function LongPressMenu({ menu, onClose, theme, accentColor, onCopy, onEdit, onReply }) {
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

function Sidebar({ open, onClose, conversations, activeConversationId, onSelectConversation, onNewChat, onOpenSettings, onGoHome, onOpenAbout, onRenameConversation, onDeleteConversation, onTogglePin, theme, accentColor, session }) {
  const c = getPalette(theme, accentColor)
  const [rowMenu, setRowMenu] = useState(null)
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [contentMatchIds, setContentMatchIds] = useState(null)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    const q = searchQuery.trim()
    if (q.length < 2) {
      setContentMatchIds(null)
      setSearching(false)
      return
    }
    setSearching(true)
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const escaped = q.replace(/[%_\\]/g, (m) => '\\' + m)
        const { data, error } = await supabase
          .from('messages')
          .select('conversation_id')
          .ilike('content', `%${escaped}%`)
          .limit(200)
        if (cancelled) return
        setContentMatchIds(error ? null : new Set((data || []).map((r) => r.conversation_id)))
      } catch (e) {
        if (!cancelled) setContentMatchIds(null)
      }
      if (!cancelled) setSearching(false)
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [searchQuery])

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
  const q = searchQuery.trim().toLowerCase()
  const searchResults = q
    ? conversations.filter((cv) => (cv.title || '').toLowerCase().includes(q) || (contentMatchIds && contentMatchIds.has(cv.id)))
    : []

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

        <div style={{ padding: '0 0.6rem 0.6rem', borderBottom: `1px solid ${c.border}`, marginBottom: '0.6rem' }}>
          {[
            { key: 'home', label: 'Home', onClick: onGoHome },
            { key: 'assistant', label: 'Assistant', onClick: onNewChat },
            { key: 'about', label: 'About', onClick: onOpenAbout },
          ].map((item) => (
            <div
              key={item.key}
              onClick={item.onClick}
              style={{ padding: '0.55rem 0.6rem', borderRadius: '8px', color: c.text, fontSize: '0.9rem', cursor: 'pointer' }}
            >
              {item.label}
            </div>
          ))}
        </div>

        <button onClick={onNewChat} style={{ ...styles.newChatSidebarBtn, borderColor: c.border, color: c.text }}>
          <NewChatIcon color={c.text} />
          New chat
        </button>

        <div style={{ position: 'relative', margin: '0.7rem 1rem 0' }}>
          <span style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', display: 'flex', pointerEvents: 'none' }}>
            <SearchIcon color={c.subtext} />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats"
            style={{ width: '100%', boxSizing: 'border-box', padding: '0.55rem 2rem 0.55rem 2.1rem', borderRadius: '8px', border: `1px solid ${c.border}`, backgroundColor: c.bg, color: c.text, fontSize: '0.88rem', outline: 'none' }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              style={{ position: 'absolute', right: '0.4rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: c.subtext, cursor: 'pointer', fontSize: '0.95rem', padding: '0.2rem 0.4rem' }}
            >
              ✕
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 0.6rem' }}>
          {q ? (
            <>
              <p style={{ color: c.subtext, fontSize: '0.75rem', margin: '1rem 0.4rem 0.4rem' }}>
                {searching ? 'SEARCHING...' : `RESULTS (${searchResults.length})`}
              </p>
              {!searching && searchResults.length === 0 && (
                <p style={{ color: c.subtext, fontSize: '0.85rem', padding: '0.6rem' }}>No chats match "{searchQuery.trim()}"</p>
              )}
              {searchResults.map(renderRow)}
            </>
          ) : (
            <>
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
            </>
          )}
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
              backgroundColor: c.accent, backgroundImage: c.accentGrad,
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
  const [themePreference, setThemePreference] = useState(() => localStorage.getItem('radius-theme') || 'dark')
  // Tracks the OS-level color scheme live, so switching device theme while
  // the app is open (or already having it set) updates RADIUS immediately
  // when the "System" preference is selected below.
  const [systemPrefersDark, setSystemPrefersDark] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)').matches : true
  )
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e) => setSystemPrefersDark(e.matches)
    mql.addEventListener('change', handleChange)
    return () => mql.removeEventListener('change', handleChange)
  }, [])
  // This is the value every other component in the tree actually receives as
  // `theme` — always a concrete 'dark' or 'light', never 'system'. Only this
  // component needs to know about the third "match device" option.
  const theme = themePreference === 'system' ? (systemPrefersDark ? 'dark' : 'light') : themePreference
  const [accentColor, setAccentColor] = useState(() => localStorage.getItem('radius-accent') || 'green')

  // Share the palette with the global stylesheet (page background glow, focus
  // rings, selection colour) so every screen follows the chosen theme.
  useEffect(() => {
    const pal = getPalette(theme, accentColor)
    const root = document.documentElement.style
    root.setProperty('--bg', pal.bg)
    root.setProperty('--accent', pal.accent)
    root.setProperty('--accent2', pal.accent2)
    root.setProperty('--accent-soft', pal.accentSoft)
    root.setProperty('--bg-glow', pal.bgGlow)
    root.setProperty('--text', pal.text)
    root.setProperty('color-scheme', theme === 'light' ? 'light' : 'dark')
  }, [theme, accentColor])
  const [mode, setMode] = useState('calculative')
  const [tool, setTool] = useState('chat')
  const [usedThisHour, setUsedThisHour] = useState(null)
  const [replyTo, setReplyTo] = useState(null)
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
  const [profile, setProfile] = useState(null)
  const [showNicknamePrompt, setShowNicknamePrompt] = useState(false)
  const [enterToSend, setEnterToSend] = useState(() => localStorage.getItem('radius-enter-to-send') === 'true')
  const [streaming, setStreaming] = useState(false)
  const [retryPayload, setRetryPayload] = useState(null)
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef(null)
  const voiceStopRef = useRef(false)

  const c = getPalette(theme, accentColor)
  const displayName = profile?.nickname || session.user.user_metadata?.full_name || session.user.email.split('@')[0]
  const messagesEndRef = useRef(null)
  const textAreaRef = useRef(null)
  const photosInputRef = useRef(null)
  const filesInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const avatarInputRef = useRef(null)
  const abortControllerRef = useRef(null)
  const formRef = useRef(null)

  useEffect(() => {
    loadConversations()
    loadProfile()
  }, [])

  useEffect(() => {
    localStorage.setItem('radius-theme', themePreference)
  }, [themePreference])

  useEffect(() => {
    localStorage.setItem('radius-enter-to-send', String(enterToSend))
  }, [enterToSend])

  useEffect(() => {
    localStorage.setItem('radius-accent', accentColor)
  }, [accentColor])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: streaming ? 'auto' : 'smooth' })
  }, [messages, loading, streaming])

  useEffect(() => {
    const el = textAreaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 150) + 'px'
  }, [assignmentText])

  useEffect(() => {
    return () => {
      try { recognitionRef.current?.abort() } catch (e) { /* ignore */ }
    }
  }, [])

  useEffect(() => {
    fetchUsage()
    const timer = setInterval(fetchUsage, 60000)
    return () => clearInterval(timer)
  }, [])

  function handleCopyText(text) {
    navigator.clipboard?.writeText(text || '')
  }

  function handleShareText(text) {
    const clean = text || ''
    if (navigator.share) {
      navigator.share({ title: 'RADIUS', text: clean }).catch(() => {})
    } else {
      navigator.clipboard?.writeText(clean)
    }
  }

  // Opens the phone's print sheet with only this reply on the page. Choose
  // "Save as PDF" there. Done in a hidden iframe so no popup blocker applies.
  function handleExportPdf(text) {
    try {
      const html = renderToStaticMarkup(
        <ReactMarkdown remarkPlugins={[[remarkGfm, { singleTilde: false }], remarkMath]} rehypePlugins={[rehypeKatex]}>{text || ''}</ReactMarkdown>
      )
      const pageCss = Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).map((n) => n.outerHTML).join('\n')
      const iframe = document.createElement('iframe')
      iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
      document.body.appendChild(iframe)
      const doc = iframe.contentDocument
      doc.open()
      doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>RADIUS</title>${pageCss}<style>html,body{background:#fff !important;color:#000 !important;font-family:sans-serif;line-height:1.6}body{padding:24px}h1,h2,h3{margin:1em 0 .4em}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:6px 8px;text-align:left;vertical-align:top}th{background:#eee}</style></head><body>${html}<p style="margin-top:2em;font-size:12px;color:#666">Generated by RADIUS</p></body></html>`)
      doc.close()
      setTimeout(() => {
        iframe.contentWindow.focus()
        iframe.contentWindow.print()
        setTimeout(() => iframe.remove(), 3000)
      }, 800)
    } catch (e) {
      setError('Could not create the PDF. Try Share instead.')
    }
  }

  // Counts this user's messages from the last hour. Each one is a request to
  // the backend, so this matches the hourly limit closely without needing
  // any new database function.
  async function fetchUsage() {
    try {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      const { count, error: usageError } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'user')
        .gte('created_at', since)
      if (!usageError && typeof count === 'number') setUsedThisHour(count)
    } catch (e) {
      // best-effort only
    }
  }

  // Start replying to a message: shows a quote bar above the input. The quote
  // is saved at the top of the sent message and also given to the AI as context.
  function startReply(role, content) {
    const clean = splitStudy(content || '').text
      .replace(/^>.*$/gm, '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '[image]')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[*_`#>|]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (!clean) return
    setReplyTo({
      role,
      preview: clean.length > 120 ? clean.slice(0, 120).trimEnd() + '...' : clean,
      full: clean.slice(0, 800),
    })
    requestAnimationFrame(() => textAreaRef.current?.focus())
  }

  function handleEditMessage(text) {
    setAssignmentText(text || '')
    requestAnimationFrame(() => textAreaRef.current?.focus())
  }

  function handleQuickAction(promptText) {
    setAssignmentText(promptText)
    requestAnimationFrame(() => formRef.current?.requestSubmit())
  }

  function handleRegenerateLast() {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')
    if (lastUser) handleQuickAction(lastUser.content)
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

  async function handleDeleteAccount() {
    const response = await fetch('/api/delete-account', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'Your account could not be deleted. Please try again.')
    }
    await supabase.auth.signOut()
  }

  async function loadProfile() {
    // Best-effort: if the `profiles` table/migration hasn't been run yet,
    // this just no-ops and the app carries on using email as the display name.
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('nickname, avatar_url, streak_count, last_active_date, response_style, preferred_subject')
        .eq('user_id', session.user.id)
        .maybeSingle()
      if (!error) {
        setProfile(data || { nickname: null, avatar_url: null, streak_count: 0, response_style: 'balanced', preferred_subject: 'auto' })
        if (!data?.nickname) setShowNicknamePrompt(true)
        if (data?.preferred_subject && data.preferred_subject !== 'auto') {
          setSubject((prev) => prev || data.preferred_subject)
        }
      }
    } catch (e) {
      // ignore — see comment above
    }
  }

  async function handleSaveNickname(nickname) {
    setShowNicknamePrompt(false)
    setProfile((prev) => ({ ...(prev || {}), nickname }))
    try {
      await supabase.from('profiles').upsert({ user_id: session.user.id, nickname })
    } catch (e) {
      // best-effort — see loadProfile comment
    }
  }

  async function handleSavePreference(field, value) {
    setProfile((prev) => ({ ...(prev || {}), [field]: value }))
    try {
      await supabase.from('profiles').upsert({ user_id: session.user.id, [field]: value })
    } catch (e) {
      // best-effort — see loadProfile comment
    }
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const ext = (file.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
    const path = `${session.user.id}/avatar.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { contentType: file.type, upsert: true })
    if (uploadError) {
      setError(`Couldn't update profile picture: ${uploadError.message}`)
      return
    }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    // Cache-bust so the new image shows immediately instead of the browser's
    // cached copy of the old one at the same URL.
    const avatar_url = `${data.publicUrl}?t=${Date.now()}`
    setProfile((prev) => ({ ...(prev || {}), avatar_url }))
    try {
      await supabase.from('profiles').upsert({ user_id: session.user.id, avatar_url })
    } catch (e) {
      // best-effort
    }
  }

  async function touchStreak() {
    try {
      const { data, error } = await supabase.rpc('touch_daily_streak')
      if (!error && typeof data === 'number') {
        setProfile((prev) => ({ ...(prev || {}), streak_count: data }))
      }
    } catch (e) {
      // best-effort — streak is a nice-to-have, never blocks the app
    }
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
    setTool('chat')
    setReplyTo(null)
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
    setReplyTo(null)
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

  // ---- Voice input (the phone's built-in speech-to-text) ----
  const SpeechRecognitionCtor =
    typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null

  const stopListening = () => {
    voiceStopRef.current = true
    try { recognitionRef.current?.stop() } catch (e) { /* ignore */ }
  }

  // Android Chrome can report the same phrase more than once (each result
  // already contains everything said so far), which made words appear twice.
  // This joins the results and drops a result that just repeats or extends
  // the previous one.
  const joinSpeechResults = (results) => {
    let out = ''
    for (let i = 0; i < results.length; i++) {
      const t = results[i][0].transcript.trim()
      if (!t) continue
      if (out && t.length >= out.length && t.toLowerCase().startsWith(out.toLowerCase())) {
        out = t
      } else if (out && out.toLowerCase().endsWith(t.toLowerCase()) && t.length > 3) {
        // exact repeat of the tail: skip
      } else {
        out += (out ? ' ' : '') + t
      }
    }
    return out
  }

  const toggleListening = () => {
    if (!SpeechRecognitionCtor) return
    if (listening) {
      stopListening()
      return
    }
    voiceStopRef.current = false
    const rec = new SpeechRecognitionCtor()
    rec.lang = navigator.language || 'en-US'
    rec.continuous = true
    rec.interimResults = true
    // Whatever was already typed stays; the spoken words are added after it.
    const base = assignmentText ? assignmentText.replace(/\s+$/, '') + ' ' : ''
    let gotText = false
    rec.onresult = (event) => {
      const spoken = joinSpeechResults(event.results)
      if (spoken) gotText = true
      setAssignmentText(base + spoken)
    }
    rec.onerror = (event) => {
      const code = event.error
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        setError('Microphone access is blocked. Allow it in your browser settings to use voice input.')
      } else if (code === 'audio-capture') {
        setError('No microphone was found on this device.')
      } else if (code === 'network') {
        setError('Voice input could not reach the speech service. Check your connection, or try Chrome.')
      } else if (code === 'no-speech' || code === 'aborted') {
        // normal: silence, or the user tapped stop
      } else if (!gotText && !voiceStopRef.current) {
        // Only complain if nothing was captured and the user did not stop it.
        setError(`Voice input stopped (${code || 'unknown'}). Please try again.`)
      }
    }
    rec.onend = () => {
      setListening(false)
      recognitionRef.current = null
    }
    recognitionRef.current = rec
    try {
      rec.start()
      setListening(true)
      setError('')
    } catch (e) {
      setListening(false)
    }
  }

  // ---- Ask the backend for a reply, streaming it in as it is written ----
  // Kept separate from handleSubmit so the Retry button can run it again with
  // the same payload, without re-uploading files or duplicating the question.
  async function requestReply(payload) {
    const { conversationId, userText, filesForApi, history } = payload
    setRetryPayload(null)
    setError('')
    setLoading(true)
    setStreaming(false)

    const controller = new AbortController()
    abortControllerRef.current = controller

    const streamId = `temp-a-${Date.now()}`
    let streamText = ''
    let placeholderAdded = false
    const removePlaceholder = () => {
      if (placeholderAdded) {
        setMessages((prev) => prev.filter((m) => m.id !== streamId))
        placeholderAdded = false
      }
    }

    const finish = async (result, responseType) => {
      if (placeholderAdded) {
        setMessages((prev) => prev.map((m) => (m.id === streamId ? { ...m, content: result, responseType } : m)))
      } else {
        placeholderAdded = true
        setMessages((prev) => [...prev, { id: streamId, role: 'assistant', content: result, responseType }])
      }
      await supabase.from('messages').insert({ conversation_id: conversationId, role: 'assistant', content: result })
      loadConversations()
      touchStreak()
      fetchUsage()
    }

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          subject,
          mode,
          tool,
          assignmentText: userText,
          history,
          images: filesForApi,
          nickname: profile?.nickname || null,
          responseStyle: profile?.response_style || 'balanced',
          stream: true,
        }),
        signal: controller.signal,
      })

      const contentType = response.headers.get('content-type') || ''
      if (!response.ok || !contentType.includes('ndjson')) {
        // Normal JSON answer: an error, or a backend that doesn't stream yet.
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || 'Something went wrong.')
        await finish(data.result, data.responseType)
      } else {
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let finalResult = null
        let finalType = 'general'
        let streamError = null

        const handleEvent = (line) => {
          if (!line.trim()) return
          let ev
          try { ev = JSON.parse(line) } catch (e) { return }
          if (ev.t === 'delta') {
            streamText += ev.text
            const shown = cleanStreamText(streamText)
            if (!shown) return
            if (!placeholderAdded) {
              placeholderAdded = true
              setStreaming(true)
              setMessages((prev) => [...prev, { id: streamId, role: 'assistant', content: shown }])
            } else {
              setMessages((prev) => prev.map((m) => (m.id === streamId ? { ...m, content: shown } : m)))
            }
          } else if (ev.t === 'reset') {
            streamText = ''
            removePlaceholder()
            setStreaming(false)
          } else if (ev.t === 'done') {
            finalResult = ev.result
            finalType = ev.responseType || 'general'
          } else if (ev.t === 'error') {
            streamError = ev.error
          }
        }

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop()
          lines.forEach(handleEvent)
        }
        if (buffer.trim()) handleEvent(buffer)

        if (streamError) throw new Error(streamError)
        if (finalResult === null) throw new Error('The reply was cut off. Tap Retry to try again.')
        await finish(finalResult, finalType)
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        // The student pressed stop: keep whatever text had already arrived.
        const partial = cleanStreamText(streamText)
        if (partial && placeholderAdded) {
          try {
            await supabase.from('messages').insert({ conversation_id: conversationId, role: 'assistant', content: partial })
            loadConversations()
          } catch (e) { /* best-effort */ }
        } else {
          removePlaceholder()
        }
      } else {
        removePlaceholder()
        setError(err.message || 'Network error. Please try again.')
        setRetryPayload(payload)
      }
    }
    abortControllerRef.current = null
    setStreaming(false)
    setLoading(false)
  }

  const handleRetry = () => {
    if (retryPayload && !loading) requestReply(retryPayload)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!assignmentText.trim() && attachedFiles.length === 0) return

    stopListening()
    setRetryPayload(null)
    setLoading(true)
    setError('')

    const userText = assignmentText
    const filesToSend = attachedFiles
    const replySnapshot = replyTo
    setReplyTo(null)
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
      const attachmentFailures = []
      for (const file of filesToSend) {
        const ext = file.mimeType === 'application/pdf' ? 'pdf' : (file.mimeType.split('/')[1] || 'dat')
        const path = `${session.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        const blob = await (await fetch(`data:${file.mimeType};base64,${file.base64}`)).blob()
        const { error: uploadError } = await supabase.storage
          .from('assignment-images')
          .upload(path, blob, { contentType: file.mimeType })
        if (uploadError) {
          console.error('Attachment upload failed:', file.name, uploadError)
          attachmentFailures.push(`"${file.name || 'file'}" didn't upload: ${uploadError.message}`)
          continue
        }
        // Signed URL instead of a public one — the bucket is private, so this is
        // required for the link to work at all. Expiry is set very long (10 years)
        // because the URL gets baked into the stored message content in Supabase;
        // once a message is saved, there's no later point to re-sign it.
        const { data: urlData, error: signError } = await supabase.storage
          .from('assignment-images')
          .createSignedUrl(path, 60 * 60 * 24 * 365 * 10)
        if (signError || !urlData) {
          console.error('Signed URL failed:', file.name, signError)
          attachmentFailures.push(`"${file.name || 'file'}" uploaded but couldn't be linked: ${signError?.message || 'unknown error'}`)
          continue
        }
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

      if (attachmentFailures.length) {
        setError(attachmentFailures.join(' '))
      }

      // Joined with a single space (not a blank-line paragraph break) so multiple
      // attachments render inline together in one row instead of stacking full-width.
      const baseContent = attachmentMarkdownParts.length
        ? `${attachmentMarkdownParts.join(' ')}${userText ? '\n\n' + userText : ''}`
        : userText
      // A reply shows as a quote at the top of the message, and the AI is told
      // exactly which earlier message the student is answering.
      const quoteMd = replySnapshot
        ? `> **${replySnapshot.role === 'user' ? 'You' : 'RADIUS'}** ${replySnapshot.preview}\n\n`
        : ''
      const userContent = quoteMd + baseContent
      const textForModel = replySnapshot
        ? `[The student is replying to this earlier ${replySnapshot.role === 'user' ? 'message of their own' : 'reply from RADIUS'}: "${replySnapshot.full}"]\n\n${userText}`
        : userText

      setMessages((prev) => [...prev, { id: `temp-u-${Date.now()}`, role: 'user', content: userContent }])
      await supabase.from('messages').insert({ conversation_id: conversationId, role: 'user', content: userContent })
      fetchUsage()

      const history = messages.map((m) => ({ role: m.role, content: splitStudy(m.content).text }))

      await requestReply({ conversationId, userText: textForModel, filesForApi, history })
    } catch (err) {
      // Something failed before the question was sent (creating the chat or
      // uploading a file). Put the text back so nothing the student typed is lost.
      if (err.name !== 'AbortError') {
        setAssignmentText(userText)
        setReplyTo(replySnapshot)
        setError(err.message || 'Network error. Please try again.')
      }
    }
    abortControllerRef.current = null
    setLoading(false)
  }

  const handleStopGenerating = () => {
    abortControllerRef.current?.abort()
  }

  if (view === 'about') {
    return <AboutScreen theme={theme} accentColor={accentColor} onBack={() => setView('main')} />
  }

  if (view === 'settings') {
    return (
      <SettingsScreen
        session={session}
        theme={theme}
        themePreference={themePreference}
        setThemePreference={setThemePreference}
        accentColor={accentColor}
        setAccentColor={setAccentColor}
        profile={profile}
        onSaveNickname={handleSaveNickname}
        onSavePreference={handleSavePreference}
        onAvatarChange={handleAvatarChange}
        avatarInputRef={avatarInputRef}
        enterToSend={enterToSend}
        setEnterToSend={setEnterToSend}
        onDeleteAccount={handleDeleteAccount}
        onBack={() => setView('main')}
      />
    )
  }

  return (
    <div className="radius-app-shell" style={{ ...styles.dashboardContainer, backgroundColor: c.bg, backgroundImage: c.bgGlow, color: c.text }}>
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={openConversation}
        onNewChat={handleNewChat}
        onOpenSettings={() => { setSidebarOpen(false); setView('settings') }}
        onGoHome={() => { setSidebarOpen(false); setView('main') }}
        onOpenAbout={() => { setSidebarOpen(false); setView('about') }}
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
        onReply={startReply}
      />

      {showNicknamePrompt && (
        <NicknamePrompt
          theme={theme}
          accentColor={accentColor}
          onSave={handleSaveNickname}
          onSkip={() => setShowNicknamePrompt(false)}
        />
      )}

      <div style={styles.topBar}>
        <button onClick={() => setSidebarOpen(true)} style={styles.iconBtn}><MenuIcon color={c.text} /></button>
        {tool === 'chat' ? (
          <div style={styles.modeToggle}>
            <button onClick={() => setMode('calculative')} style={{ ...styles.modeBtn, backgroundColor: mode === 'calculative' ? c.accent : 'transparent', backgroundImage: mode === 'calculative' ? c.accentGrad : 'none', color: mode === 'calculative' ? c.accentText : c.subtext, borderColor: c.border }}>Calculative</button>
            <button onClick={() => setMode('non-calculative')} style={{ ...styles.modeBtn, backgroundColor: mode === 'non-calculative' ? c.accent : 'transparent', backgroundImage: mode === 'non-calculative' ? c.accentGrad : 'none', color: mode === 'non-calculative' ? c.accentText : c.subtext, borderColor: c.border }}>Non-Calculative</button>
          </div>
        ) : (
          <div style={styles.modeToggle}>
            <span style={{ ...styles.modeBtn, backgroundColor: c.accent, backgroundImage: c.accentGrad, color: c.accentText, borderColor: c.border }}>{(TOOLS.find((t) => t.id === tool) || {}).label}</span>
          </div>
        )}
        <button onClick={handleNewChat} style={styles.iconBtn}><NewChatIcon color={c.text} /></button>
      </div>

      <input
        type="text"
        placeholder="Subject (optional, e.g. Physics)"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        style={{ ...styles.subjectInput, marginTop: '0.5rem', flexShrink: 0, backgroundColor: c.surface, borderColor: c.border, color: c.text }}
      />

      <div style={styles.messagesArea}>
        {messages.length === 0 && !loading && (
          <div key={`${activeConversationId || 'new'}-${tool}`} className="radius-entrance" style={{ textAlign: 'center', margin: 'auto', padding: '0 1.2rem', maxWidth: '420px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.6rem' }}>
              <Hero3D size={tool === 'chat' ? 150 : 110} />
            </div>
            {tool === 'chat' || !TOOL_INFO[tool] ? (
              <>
                <p className="radius-display" style={{ fontSize: '1.5rem', fontWeight: 700 }}>Welcome, {displayName}</p>
                <p style={{ color: c.subtext, marginTop: '0.4rem' }}>What assignment are we tackling today?</p>
              </>
            ) : (
              <>
                <p className="radius-display" style={{ fontSize: '1.5rem', fontWeight: 700 }}>{TOOL_INFO[tool].title}</p>
                <p style={{ color: c.subtext, marginTop: '0.4rem' }}>{TOOL_INFO[tool].summary}</p>
                <div style={{ textAlign: 'left', marginTop: '1.2rem', padding: '0.9rem 1rem', borderRadius: '14px', border: `1px solid ${c.border}`, backgroundColor: c.surface }}>
                  <p style={{ fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.5rem' }}>How it works</p>
                  {TOOL_INFO[tool].steps.map((step, i) => (
                    <p key={i} style={{ fontSize: '0.85rem', color: c.subtext, marginTop: '0.35rem' }}>{i + 1}. {step}</p>
                  ))}
                </div>
                <p style={{ color: c.subtext, fontSize: '0.8rem', marginTop: '0.9rem' }}>{TOOL_INFO[tool].tip}</p>
              </>
            )}
          </div>
        )}

        {messages.map((m, i) => (
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
              onShare={handleShareText}
              onExportPdf={handleExportPdf}
              onFeedback={handleSetFeedback}
              onReply={startReply}
            />
            {!loading && i === messages.length - 1 && m.role === 'assistant' && m.responseType === 'assignment' && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', margin: '0.5rem 0 0.8rem' }}>
                <button type="button" onClick={handleRegenerateLast} style={{ ...styles.chipBtn, borderColor: c.border, color: c.text }}>
                  Regenerate
                </button>
                {STUDY_ACTIONS.map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    onClick={() => handleQuickAction(a.prompt)}
                    style={{ ...styles.chipBtn, borderColor: c.border, color: c.text }}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && !streaming && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: c.subtext, padding: '0.4rem 0' }}>
            <Cube3D size={18} />
            Thinking...
          </div>
        )}
        {error && <p style={{ color: '#ef4444', padding: '0.4rem 0', textAlign: 'center' }}>{error}</p>}
        {retryPayload && !loading && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: '0.6rem' }}>
            <button type="button" onClick={handleRetry} style={{ ...styles.chipBtn, borderColor: c.accent, backgroundColor: c.accent, backgroundImage: c.accentGrad, color: c.accentText, fontWeight: 'bold' }}>
              Retry
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', margin: '0 1rem 0.5rem 1rem', flexShrink: 0 }}>
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => { abortControllerRef.current?.abort(); handleNewChat(); setTool(t.id) }}
            style={{ ...styles.modeBtn, flexShrink: 0, whiteSpace: 'nowrap', backgroundColor: tool === t.id ? c.accent : 'transparent', backgroundImage: tool === t.id ? c.accentGrad : 'none', color: tool === t.id ? c.accentText : c.subtext, borderColor: c.border }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {usedThisHour !== null && (
        <p style={{ margin: '0 1.2rem 0.4rem 1.2rem', fontSize: '0.72rem', textAlign: 'right', color: usedThisHour >= HOURLY_LIMIT - 3 ? '#f59e0b' : c.subtext }}>
          {usedThisHour >= HOURLY_LIMIT ? 'Hourly limit reached. Try again a bit later.' : `${HOURLY_LIMIT - usedThisHour} of ${HOURLY_LIMIT} requests left this hour`}
        </p>
      )}

      {attachedFiles.length > 0 && (
        <div style={{ margin: '0 1rem 0.6rem 1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {attachedFiles.map((file, index) => (
            <div key={index} style={{ position: 'relative', width: '70px' }}>
              {file.preview ? (
                <img src={file.preview} alt="attachment preview" style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '10px', border: `1px solid ${c.border}` }} />
              ) : (
                <div style={{ width: '70px', height: '70px', borderRadius: '10px', border: `1px solid ${c.border}`, backgroundColor: c.surface, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '4px', overflow: 'hidden' }}>
                  <span style={{ fontSize: '0.6rem', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', backgroundColor: c.accent, backgroundImage: c.accentGrad, color: c.accentText }}>
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

      {replyTo && (
        <div className="reply-bar" style={{ margin: '0 1rem 0.5rem 1rem', padding: '0.6rem 0.6rem 0.6rem 0.8rem', borderRadius: '18px', border: `1px solid ${c.border}`, backgroundColor: c.surface, boxShadow: '0 10px 28px rgba(0,0,0,0.22)', display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
          <span style={{ alignSelf: 'stretch', width: '4px', borderRadius: '4px', backgroundColor: c.accent, backgroundImage: c.accentGrad, flexShrink: 0 }} />
          <span style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: c.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ReplyIcon color={c.accent} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '0.74rem', fontWeight: 700, color: c.accent, margin: 0, letterSpacing: '0.01em' }}>
              Replying to {replyTo.role === 'user' ? 'You' : 'RADIUS'}
            </p>
            <p style={{ fontSize: '0.82rem', color: c.subtext, margin: '2px 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {replyTo.preview}
            </p>
          </div>
          <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply" style={{ width: '30px', height: '30px', borderRadius: '50%', border: 'none', backgroundColor: c.surfaceAlt, color: c.subtext, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, padding: 0 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
          </button>
        </div>
      )}

      <form ref={formRef} onSubmit={handleSubmit} style={{ ...styles.bottomBar, backgroundColor: c.surface, borderColor: c.border }}>
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
          placeholder={listening ? 'Listening...' : TOOL_PLACEHOLDERS[tool]}
          value={assignmentText}
          onChange={(e) => {
            setAssignmentText(e.target.value)
            const el = e.target
            el.style.height = 'auto'
            el.style.height = Math.min(el.scrollHeight, 150) + 'px'
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && enterToSend) {
              e.preventDefault()
              e.currentTarget.form?.requestSubmit()
            }
          }}
          style={{ ...styles.bottomInput, color: c.text }}
        />
        {SpeechRecognitionCtor && (
          <button
            type="button"
            onClick={toggleListening}
            aria-label={listening ? 'Stop voice input' : 'Start voice input'}
            style={{ ...styles.attachBtn, justifyContent: 'center', width: '42px', height: '42px', borderRadius: '50%', flexShrink: 0, backgroundColor: listening ? c.accent : 'transparent', backgroundImage: listening ? c.accentGrad : 'none' }}
          >
            <MicIcon color={listening ? c.accentText : c.text} />
          </button>
        )}
        {loading ? (
          <button
            type="button"
            onClick={handleStopGenerating}
            style={{ ...styles.sendBtn, backgroundColor: c.accent, backgroundImage: c.accentGrad, boxShadow: `0 6px 18px ${c.accentGlow}` }}
            aria-label="Stop generating"
          >
            <StopIcon color={c.accentText} />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!assignmentText.trim() && attachedFiles.length === 0}
            style={{
              ...styles.sendBtn,
              backgroundColor: c.accent, backgroundImage: c.accentGrad,
              boxShadow: `0 6px 18px ${c.accentGlow}`,
              opacity: !assignmentText.trim() && attachedFiles.length === 0 ? 0.4 : 1,
            }}
            aria-label="Send"
          >
            <SendIcon color={c.accentText} />
          </button>
        )}
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
  const [showLanding, setShowLanding] = useState(true)
  const [authSignUp, setAuthSignUp] = useState(true)

  useEffect(() => {
    // Installable app setup. These tags are only added here if index.html
    // doesn't already have them, so it is safe either way.
    const addTag = (tag, attrs, selector) => {
      if (document.querySelector(selector)) return
      const el = document.createElement(tag)
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v))
      document.head.appendChild(el)
    }
    addTag('link', { rel: 'manifest', href: '/manifest.webmanifest' }, 'link[rel="manifest"]')
    addTag('meta', { name: 'theme-color', content: '#0a0c12' }, 'meta[name="theme-color"]')
    addTag('link', { rel: 'apple-touch-icon', href: '/logo.png' }, 'link[rel="apple-touch-icon"]')
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

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
    return (
      <div style={styles.container}>
        <Hero3D size={200} />
        <p style={{ color: '#8f98ae', marginTop: '0.4rem', letterSpacing: '0.04em' }}>Starting RADIUS...</p>
      </div>
    )
  }

  if (passwordRecovery) {
    return <ResetPasswordScreen onDone={() => setPasswordRecovery(false)} />
  }

  if (session) {
    return <Dashboard session={session} />
  }

  if (showLanding) {
    return (
      <LandingScreen
        onGetStarted={() => { setAuthSignUp(true); setShowLanding(false) }}
        onSignIn={() => { setAuthSignUp(false); setShowLanding(false) }}
      />
    )
  }

  return <AuthScreen initialSignUp={authSignUp} />
}

const TOOLS = [
  { id: 'chat', label: 'Assignment' },
  { id: 'notes', label: 'Study Pack' },
  { id: 'pastq', label: 'Past Qs' },
  { id: 'cite', label: 'Citation' },
  { id: 'plan', label: 'Exam Plan' },
]

const TOOL_INFO = {
  notes: {
    title: 'Study Pack',
    summary: 'Turn messy lecture notes into clean notes, flashcards and a quiz.',
    steps: [
      'Paste your notes below, or attach photos or a PDF of them.',
      'Send it. RADIUS cleans up the notes and lists the key terms.',
      'You get tap-to-flip flashcards and a quiz that scores you.',
    ],
    tip: 'Tip: add the subject above for better results.',
  },
  pastq: {
    title: 'Past Question Trainer',
    summary: 'Find out what to read first and practise on the topics that keep showing up.',
    steps: [
      'Paste or attach past questions for one course.',
      'RADIUS maps the topics by how often they appear, ranks what to read first, and gives you 5 practice questions.',
      'Reply with your answers. RADIUS marks them and shows your weak topics.',
    ],
    tip: 'Tip: the more past papers you add, the better the topic map.',
  },
  cite: {
    title: 'Citation Fixer',
    summary: 'Get a correctly formatted reference from a link, title or DOI.',
    steps: [
      'Paste a link, book or article title, or DOI.',
      'Name a style (APA, Harvard, IEEE, MLA or Chicago). APA is used if you do not pick one.',
      'You get the reference entry and the in-text citation. Missing details are marked in [brackets], never made up.',
    ],
    tip: 'Example: "Harvard: https://example.com/my-article"',
  },
  plan: {
    title: 'Exam Planner',
    summary: 'Get a day-by-day study plan that fits your exam dates.',
    steps: [
      'List your exams, their dates, the topics, and how many hours you can study a day.',
      'RADIUS builds a day-by-day plan table, putting the sooner exams first.',
      'Missed a day or something changed? Tell RADIUS and it rebuilds the rest of the plan.',
    ],
    tip: 'Example: "Physics Oct 20, Maths Oct 25, 3 hours a day"',
  },
}

const TOOL_PLACEHOLDERS = {
  chat: 'Type your assignment here...',
  notes: 'Paste or attach your lecture notes...',
  pastq: 'Paste or attach past questions for a course...',
  cite: 'Paste a link, title, or DOI to get a reference...',
  plan: 'List your exams, dates, topics and hours per day...',
}

const styles = {
  container: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', fontFamily: 'inherit', textAlign: 'center', backgroundColor: '#0a0c12', backgroundImage: 'radial-gradient(700px 420px at 50% -5%, rgba(52, 210, 123, 0.16), transparent 65%), radial-gradient(500px 360px at 100% 100%, rgba(168, 119, 247, 0.1), transparent 65%)', color: '#fff' },
  dashboardContainer: { display: 'flex', flexDirection: 'column', fontFamily: 'inherit', maxWidth: '640px', margin: '0 auto', width: '100%' },
  settingsContainer: { minHeight: '100vh', padding: '1.2rem', fontFamily: 'inherit', maxWidth: '640px', margin: '0 auto', width: '100%' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.2rem' },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '0.3rem' },
  logoWrapper: { width: '160px', height: '160px', borderRadius: '16px', border: '3px solid #ffffff', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', backgroundColor: '#0a0c12' },
  logoWrapperSmall: { width: '36px', height: '36px', borderRadius: '8px', border: '1.5px solid #fff', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0c12', flexShrink: 0 },
  logo: { width: '100%', height: '100%', objectFit: 'cover' },
  subtitle: { color: '#aaa', marginBottom: '2rem' },
  form: { display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '320px', gap: '0.8rem' },
  input: { padding: '0.85rem 1rem', borderRadius: '14px', border: '1.5px solid #262d42', backgroundColor: '#121622', color: '#fff', fontSize: '1rem' },
  button: { padding: '0.9rem', borderRadius: '14px', border: 'none', backgroundColor: '#34d27b', backgroundImage: 'linear-gradient(135deg, #34d27b, #1fb862)', color: '#052412', fontWeight: 700, cursor: 'pointer', fontSize: '1rem', boxShadow: '0 8px 22px rgba(52, 210, 123, 0.28)' },
  googleButton: { marginTop: '1rem', padding: '0.8rem', borderRadius: '8px', border: '1px solid #262d42', backgroundColor: 'transparent', color: '#fff', width: '100%', maxWidth: '320px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  toggle: { marginTop: '1.2rem', color: '#888', cursor: 'pointer', fontSize: '0.9rem' },
  message: { marginTop: '1rem', color: '#4ade80' },
  modeToggle: { display: 'flex', gap: '0.4rem' },
  modeBtn: { padding: '0.5rem 0.95rem', borderRadius: '20px', border: '1.5px solid', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.01em' },
  messagesArea: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '1rem', overflowY: 'auto', WebkitOverflowScrolling: 'touch' },
  subjectInput: { margin: '0 1rem 0.6rem 1rem', padding: '0.7rem 1.05rem', borderRadius: '16px', border: '1.5px solid', fontSize: '0.88rem', outline: 'none', fontWeight: 500 },
  bottomBar: { display: 'flex', alignItems: 'flex-end', gap: '0.6rem', padding: '0.6rem', margin: '0 1rem 1rem 1rem', borderRadius: '26px', border: '1.5px solid', boxShadow: '0 10px 30px rgba(0,0,0,0.22)' },
  attachBtn: { display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '0.3rem', background: 'none', border: 'none' },
  attachMenuOverlay: { position: 'fixed', inset: 0, zIndex: 55 },
  attachMenu: { position: 'absolute', bottom: '48px', left: 0, borderRadius: '16px', boxShadow: '0 14px 34px rgba(0,0,0,0.35)', border: '1px solid', padding: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.2rem', zIndex: 60, minWidth: '150px' },
  attachMenuItem: { display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.55rem 0.5rem', borderRadius: '10px', cursor: 'pointer', fontSize: '0.9rem' },
  attachMenuIconWrap: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0 },
  bottomInput: { flex: 1, border: 'none', outline: 'none', backgroundColor: 'transparent', fontSize: '1rem', fontFamily: 'inherit', resize: 'none', overflowY: 'auto', maxHeight: '150px', lineHeight: '1.4', padding: '0.4rem 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  sendBtn: { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, width: '42px', height: '42px', borderRadius: '50%', flexShrink: 0 },
  themeBtn: { flex: 1, padding: '0.6rem', borderRadius: '8px', border: '1.5px solid', backgroundColor: 'transparent', cursor: 'pointer', fontSize: '0.9rem' },
  logoutBtn: { width: '100%', padding: '0.85rem', borderRadius: '14px', border: '1.5px solid', backgroundColor: 'transparent', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 700 },
  sidebarOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 40 },
  sidebarPanel: { position: 'fixed', top: 0, left: 0, bottom: 0, width: '80%', maxWidth: '300px', borderRight: '1px solid', zIndex: 50, display: 'flex', flexDirection: 'column' },
  newChatSidebarBtn: { display: 'flex', alignItems: 'center', gap: '0.6rem', margin: '0 1rem', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1.5px solid', backgroundColor: 'transparent', cursor: 'pointer', fontSize: '0.9rem' },
  msgFeedbackBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' },
  chipBtn: { padding: '0.5rem 0.95rem', borderRadius: '20px', border: '1.5px solid', backgroundColor: 'transparent', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' },
}

export default App
