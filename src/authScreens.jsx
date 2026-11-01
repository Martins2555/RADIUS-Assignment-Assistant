import { useState } from 'react'
import { supabase } from './supabaseClient'
import { EyeIcon, EyeOffIcon, GoogleIcon } from './icons.jsx'
import { PasswordInput, PasswordMeter, passwordStrength } from './password.jsx'
import { styles } from './styles.js'
import { Logo } from './visuals.jsx'
import { requestCodeUrl, requestCodeWhatsappUrl } from './constants.js'

export function AuthScreen({ initialSignUp = true, onSignInStart, onSignInFail }) {
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
    if (isSignUp) {
      const strength = passwordStrength(password)
      if (!strength.ok) {
        setMessage(`Choose a stronger password. ${strength.hint}`)
        return
      }
    }
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
      if (onSignInStart) onSignInStart()
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setMessage(error.message)
        if (onSignInFail) onSignInFail()
      }
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
        {isSignUp && <PasswordMeter password={password} />}
        <button
          type="submit"
          disabled={loading || (isSignUp && !passwordStrength(password).ok)}
          style={{ ...styles.button, opacity: isSignUp && !passwordStrength(password).ok ? 0.45 : 1 }}
        >
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
      <p className="fade-in-3" style={{ ...styles.toggle, marginTop: '0.4rem' }}>
        Need an access code?{' '}
        <a href={requestCodeUrl('')} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', fontWeight: 'bold' }}>
          REQUEST ON X
        </a>
        {' or '}
        <a href={requestCodeWhatsappUrl('')} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', fontWeight: 'bold' }}>
          WHATSAPP
        </a>
      </p>
      {message && <p style={styles.message}>{message}</p>}
    </div>
  )
}

export function LandingScreen({ onGetStarted, onSignIn }) {
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

export function ResetPasswordScreen({ onDone }) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage('')
    if (!passwordStrength(newPassword).ok) {
      setMessage(`Choose a stronger password. ${passwordStrength(newPassword).hint}`)
      return
    }
    if (newPassword !== confirmPassword) {
      setMessage('Passwords do not match.')
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
        <PasswordInput placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
        <PasswordMeter password={newPassword} />
        <PasswordInput placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
        {confirmPassword && (
          <p style={{ margin: '-0.2rem 0 0', textAlign: 'left', fontSize: '0.78rem', fontWeight: 600, color: confirmPassword === newPassword ? '#22c55e' : 'var(--warn, #fbbf24)' }}>
            {confirmPassword === newPassword ? 'Passwords match' : 'Passwords do not match'}
          </p>
        )}
        <button
          type="submit"
          disabled={loading || !passwordStrength(newPassword).ok || newPassword !== confirmPassword}
          style={{ ...styles.button, opacity: !passwordStrength(newPassword).ok || newPassword !== confirmPassword ? 0.45 : 1 }}
        >
          {loading ? 'Please wait...' : 'Update Password'}
        </button>
      </form>
      {message && <p style={styles.message}>{message}</p>}
    </div>
  )
}
