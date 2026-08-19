import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

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

function SendIcon({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M4 12l16-7-6 16-2.5-6.5L4 12z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}

const palette = {
  dark: { bg: '#0f0f0f', surface: '#1a1a1a', border: '#333', text: '#ffffff', subtext: '#888', accent: '#22c55e', accentText: '#000' },
  light: { bg: '#ffffff', surface: '#f0f0f0', border: '#ddd', text: '#111111', subtext: '#666', accent: '#16a34a', accentText: '#ffffff' },
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

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setMessage(error.message)
      else setMessage('Check your email to confirm your account.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage(error.message)
    }
    setLoading(false)
  }

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google' })
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

function SettingsScreen({ session, theme, setTheme, onBack }) {
  const c = palette[theme]
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
          <button
            onClick={() => setTheme('dark')}
            style={{ ...styles.themeBtn, borderColor: theme === 'dark' ? c.accent : c.border, color: c.text }}
          >
            Dark
          </button>
          <button
            onClick={() => setTheme('light')}
            style={{ ...styles.themeBtn, borderColor: theme === 'light' ? c.accent : c.border, color: c.text }}
          >
            Light
          </button>
        </div>
      </div>

      <button onClick={handleLogout} style={{ ...styles.logoutBtn, borderColor: c.border, color: '#ef4444', marginTop: '2.5rem' }}>
        Log Out
      </button>
    </div>
  )
}

function Dashboard({ session }) {
  const [view, setView] = useState('main')
  const [theme, setTheme] = useState('dark')
  const [mode, setMode] = useState('calculative')
  const [assignmentText, setAssignmentText] = useState('')
  const [fileName, setFileName] = useState('')

  const c = palette[theme]
  const displayName = session.user.user_metadata?.full_name || session.user.email.split('@')[0]

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) setFileName(e.target.files[0].name)
  }

  const handleNewChat = () => {
    setAssignmentText('')
    setFileName('')
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    alert('Next step: this will send your assignment to the AI and break it into tasks.')
  }

  if (view === 'settings') {
    return <SettingsScreen session={session} theme={theme} setTheme={setTheme} onBack={() => setView('main')} />
  }

  return (
    <div style={{ ...styles.dashboardContainer, backgroundColor: c.bg, color: c.text }}>
      <div style={styles.topBar}>
        <button onClick={() => setView('settings')} style={styles.iconBtn}><MenuIcon color={c.text} /></button>
        <div style={styles.modeToggle}>
          <button
            onClick={() => setMode('calculative')}
            style={{ ...styles.modeBtn, backgroundColor: mode === 'calculative' ? c.accent : 'transparent', color: mode === 'calculative' ? c.accentText : c.subtext, borderColor: c.border }}
          >
            Calculative
          </button>
          <button
            onClick={() => setMode('non-calculative')}
            style={{ ...styles.modeBtn, backgroundColor: mode === 'non-calculative' ? c.accent : 'transparent', color: mode === 'non-calculative' ? c.accentText : c.subtext, borderColor: c.border }}
          >
            Non-Calculative
          </button>
        </div>
        <button onClick={handleNewChat} style={styles.iconBtn}><NewChatIcon color={c.text} /></button>
      </div>

      <div style={styles.blankArea}>
        {!assignmentText && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>Welcome, {displayName}</p>
            <p style={{ color: c.subtext, marginTop: '0.4rem' }}>What assignment are we tackling today?</p>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} style={{ ...styles.bottomBar, backgroundColor: c.surface, borderColor: c.border }}>
        <label style={styles.attachBtn}>
          <input type="file" onChange={handleFileChange} style={{ display: 'none' }} />
          <PlusIcon color={c.text} />
        </label>
        <input
          type="text"
          placeholder="Type your assignment here..."
          value={assignmentText}
          onChange={(e) => setAssignmentText(e.target.value)}
          style={{ ...styles.bottomInput, color: c.text }}
        />
        <button type="submit" style={styles.sendBtn}>
          <SendIcon color={c.accent} />
        </button>
      </form>
      {fileName && <p style={{ fontSize: '0.75rem', color: c.subtext, textAlign: 'center', marginTop: '0.4rem' }}>Attached: {fileName}</p>}
    </div>
  )
}

function App() {
  const [session, setSession] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setCheckingSession(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  if (checkingSession) {
    return <div style={styles.container}><p>Loading...</p></div>
  }

  if (session) {
    return <Dashboard session={session} />
  }

  return <AuthScreen />
}

const styles = {
  container: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', fontFamily: 'sans-serif', textAlign: 'center', backgroundColor: '#0f0f0f', color: '#fff' },
  dashboardContainer: { minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif' },
  settingsContainer: { minHeight: '100vh', padding: '1.2rem', fontFamily: 'sans-serif' },
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
  blankArea: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' },
  bottomBar: { display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem', margin: '0 1rem 1rem 1rem', borderRadius: '30px', border: '1px solid' },
  attachBtn: { display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '0.3rem' },
  bottomInput: { flex: 1, border: 'none', outline: 'none', backgroundColor: 'transparent', fontSize: '1rem' },
  sendBtn: { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0.3rem' },
  themeBtn: { flex: 1, padding: '0.6rem', borderRadius: '8px', border: '1.5px solid', backgroundColor: 'transparent', cursor: 'pointer', fontSize: '0.9rem' },
  logoutBtn: { width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1.5px solid', backgroundColor: 'transparent', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 'bold' },
}

export default App
