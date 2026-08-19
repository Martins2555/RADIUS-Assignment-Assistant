import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

function Logo() {
  return (
    <div style={styles.logoCircle}>
      <span style={styles.logoLetter}>R</span>
    </div>
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

function App() {
  const [session, setSession] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [isSignUp, setIsSignUp] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

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

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setMessage(error.message)
      } else {
        setMessage('Check your email to confirm your account.')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setMessage(error.message)
      }
    }
    setLoading(false)
  }

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google' })
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  if (checkingSession) {
    return <div style={styles.container}><p>Loading...</p></div>
  }

  if (session) {
    return (
      <div style={styles.container}>
        <Logo />
        <h1 style={styles.title}>RADIUS</h1>
        <p style={styles.subtitle}>Logged in as {session.user.email}</p>
        <button onClick={handleLogout} style={styles.button}>Log Out</button>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <Logo />
      <h1 style={styles.title}>RADIUS</h1>
      <p style={styles.subtitle}>All-Round Assignment and Task Assistant</p>

      <form onSubmit={handleAuth} style={styles.form}>
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

      <button onClick={handleGoogleLogin} style={styles.googleButton}>
        <GoogleIcon />
        Continue with Google
      </button>

      <p style={styles.toggle} onClick={() => setIsSignUp(!isSignUp)}>
        {isSignUp ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
      </p>

      {message && <p style={styles.message}>{message}</p>}
    </div>
  )
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
  logoCircle: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: '#22c55e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1rem',
  },
  logoLetter: { fontSize: '1.8rem', fontWeight: 'bold', color: '#ffffff' },
  title: { fontSize: '2rem', marginBottom: '0.2rem' },
  subtitle: { color: '#aaa', marginBottom: '2rem' },
  form: { display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '320px', gap: '0.8rem' },
  input: {
    padding: '0.8rem',
    borderRadius: '8px',
    border: '1px solid #333',
    backgroundColor: '#1a1a1a',
    color: '#fff',
  },
  button: {
    padding: '0.8rem',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#ffffff',
    color: '#000',
    fontWeight: 'bold',
    cursor: 'pointer',
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
}

export default App
