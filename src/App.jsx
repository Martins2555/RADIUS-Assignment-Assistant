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

function Logo({ small }) {
  return (
    <div className={small ? '' : 'fade-in-1 logo-pulse'} style={small ? styles.logoWrapperSmall : styles.logoWrapper}>
      <img src="/logo.png" alt="RADIUS" style={styles.logo} />
    </div>
  )
}

function AuthScreen({ onAuthed }) {
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
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={styles.input}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={styles.input}
        />
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

function Dashboard({ session }) {
  const [mode, setMode] = useState('calculative')
  const [subject, setSubject] = useState('')
  const [assignmentText, setAssignmentText] = useState('')

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    alert('Next step: this will send your assignment to the AI and break it into tasks.')
  }

  return (
    <div style={styles.dashboardContainer}>
      <div style={styles.topBar}>
        <Logo small />
        <button onClick={handleLogout} style={styles.logoutBtn}>Log Out</button>
      </div>

      <p style={styles.dashSubtitle}>Logged in as {session.user.email}</p>

      <div style={styles.modeToggle}>
        <button
          onClick={() => setMode('calculative')}
          style={mode === 'calculative' ? styles.modeBtnActive : styles.modeBtn}
        >
          Calculative
        </button>
        <button
          onClick={() => setMode('non-calculative')}
          style={mode === 'non-calculative' ? styles.modeBtnActive : styles.modeBtn}
        >
          Non-Calculative
        </button>
      </div>

      <form onSubmit={handleSubmit} style={styles.dashForm}>
        <input
          type="text"
          placeholder="Subject (e.g. Physics, History)"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          style={styles.input}
        />
        <textarea
          placeholder="Paste your assignment here..."
          value={assignmentText}
          onChange={(e) => setAssignmentText(e.target.value)}
          required
          rows={8}
          style={styles.textarea}
        />
        <button type="submit" style={styles.button}>Break Down Assignment</button>
      </form>
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
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    fontFamily: 'sans-serif',
    textAlign: 'center',
  },
  dashboardContainer: {
    minHeight: '100vh',
    padding: '1.5rem',
    fontFamily: 'sans-serif',
    maxWidth: '480px',
    margin: '0 auto',
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
  },
  logoWrapper: {
    width: '160px',
    height: '160px',
    borderRadius: '16px',
    border: '3px solid #ffffff',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1.5rem',
    backgroundColor: '#0f0f0f',
  },
  logoWrapperSmall: {
    width: '44px',
    height: '44px',
    borderRadius: '10px',
    border: '2px solid #ffffff',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f0f0f',
    flexShrink: 0,
  },
  logo: { width: '100%', height: '100%', objectFit: 'cover' },
  subtitle: { color: '#aaa', marginBottom: '2rem' },
  dashSubtitle: { color: '#888', fontSize: '0.85rem', marginBottom: '1.5rem' },
  form: { display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '320px', gap: '0.8rem' },
  dashForm: { display: 'flex', flexDirection: 'column', gap: '0.8rem' },
  input: {
    padding: '0.8rem',
    borderRadius: '8px',
    border: '1px solid #333',
    backgroundColor: '#1a1a1a',
    color: '#fff',
    fontSize: '1rem',
  },
  textarea: {
    padding: '0.8rem',
    borderRadius: '8px',
    border: '1px solid #333',
    backgroundColor: '#1a1a1a',
    color: '#fff',
    fontSize: '1rem',
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  button: {
    padding: '0.8rem',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#22c55e',
    color: '#000',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontSize: '1rem',
  },
  logoutBtn: {
    padding: '0.5rem 1rem',
    borderRadius: '8px',
    border: '1px solid #333',
    backgroundColor: 'transparent',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  googleButton: {
    marginTop: '1rem',
    padding: '0.8rem',
    borderRadius: '8px',
    border: '1px solid #333',
    backgroundColor: 'transparent',
    color: '#fff',
    width: '100%',
    maxWidth: '320px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggle: { marginTop: '1.2rem', color: '#888', cursor: 'pointer', fontSize: '0.9rem' },
  message: { marginTop: '1rem', color: '#4ade80' },
  modeToggle: {
    display: 'flex',
    gap: '0.6rem',
    marginBottom: '1.5rem',
  },
  modeBtn: {
    flex: 1,
    padding: '0.7rem',
    borderRadius: '8px',
    border: '1px solid #333',
    backgroundColor: 'transparent',
    color: '#888',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  modeBtnActive: {
    flex: 1,
    padding: '0.7rem',
    borderRadius: '8px',
    border: '1px solid #22c55e',
    backgroundColor: '#22c55e',
    color: '#000',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
}

export default App
