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
          <button onClick={() => setTheme('dark')} style={{ ...styles.themeBtn, borderColor: theme === 'dark' ? c.accent : c.border, color: c.text }}>Dark</button>
          <button onClick={() => setTheme('light')} style={{ ...styles.themeBtn, borderColor: theme === 'light' ? c.accent : c.border, color: c.text }}>Light</button>
        </div>
      </div>
      <button onClick={handleLogout} style={{ ...styles.logoutBtn, borderColor: c.border, color: '#ef4444', marginTop: '2.5rem' }}>Log Out</button>
    </div>
  )
}

function MessageBubble({ role, content, theme }) {
  const c = palette[theme]
  const isUser = role === 'user'
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: '0.7rem' }}>
      <div
        style={{
          maxWidth: '85%',
          padding: '0.7rem 1rem',
          borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          backgroundColor: isUser ? c.accent : c.surface,
          color: isUser ? c.accentText : c.text,
          border: isUser ? 'none' : `1px solid ${c.border}`,
        }}
      >
        <div style={{ lineHeight: '1.6' }} className="radius-markdown">
          <ReactMarkdown
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
              img: (props) => (
                <img {...props} style={{ maxWidth: '100%', borderRadius: '10px', marginTop: '0.4rem', display: 'block' }} />
              ),
              p: (props) => <p {...props} style={{ margin: '0 0 0.5rem 0' }} />,
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
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

function Sidebar({ open, onClose, conversations, activeConversationId, onSelectConversation, onNewChat, onOpenSettings, theme, session }) {
  const c = palette[theme]
  if (!open) return null

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

        <p style={{ color: c.subtext, fontSize: '0.75rem', margin: '1rem 1rem 0.4rem' }}>RECENT</p>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 0.6rem' }}>
          {conversations.length === 0 && (
            <p style={{ color: c.subtext, fontSize: '0.85rem', padding: '0.6rem' }}>No chats yet</p>
          )}
          {conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => onSelectConversation(conv)}
              style={{
                padding: '0.7rem 0.8rem',
                borderRadius: '8px',
                cursor: 'pointer',
                backgroundColor: conv.id === activeConversationId ? c.bg : 'transparent',
                color: c.text,
                fontSize: '0.9rem',
                marginBottom: '0.2rem',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {conv.title || 'New chat'}
            </div>
          ))}
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
    </>
  )
}

function Dashboard({ session }) {
  const [view, setView] = useState('main')
  const [theme, setTheme] = useState('dark')
  const [mode, setMode] = useState('calculative')
  const [subject, setSubject] = useState('')
  const [assignmentText, setAssignmentText] = useState('')
  const [fileName, setFileName] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [conversations, setConversations] = useState([])
  const [activeConversationId, setActiveConversationId] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [attachedImage, setAttachedImage] = useState(null)
  const [attachMenuOpen, setAttachMenuOpen] = useState(false)

  const c = palette[theme]
  const displayName = session.user.user_metadata?.full_name || session.user.email.split('@')[0]
  const messagesEndRef = useRef(null)

  useEffect(() => {
    loadConversations()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function loadConversations() {
    const { data, error } = await supabase
      .from('conversations')
      .select('id, title, mode, subject, updated_at')
      .order('updated_at', { ascending: false })
    if (!error) setConversations(data || [])
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
    setFileName('')
    setError('')
    setSubject('')
    setSidebarOpen(false)
  }

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setFileName(file.name)
    try {
      if (file.type.startsWith('image/')) {
        const compressed = await compressImage(file)
        setAttachedImage(compressed)
      } else {
        const base64 = await fileToBase64(file)
        setAttachedImage({ base64, mimeType: file.type || 'application/pdf', preview: null, name: file.name })
      }
    } catch (err) {
      setError('Could not process that file. Please try a different one.')
    }
    e.target.value = ''
  }

  const handleRemoveImage = () => {
    setAttachedImage(null)
    setFileName('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!assignmentText.trim() && !attachedImage) return

    setLoading(true)
    setError('')

    const userText = assignmentText
    const imageToSend = attachedImage
    setAssignmentText('')
    setAttachedImage(null)
    setFileName('')

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

      let imageUrl = null
      if (imageToSend) {
        const ext = imageToSend.mimeType === 'application/pdf' ? 'pdf' : (imageToSend.mimeType.split('/')[1] || 'dat')
        const path = `${session.user.id}/${Date.now()}.${ext}`
        const blob = await (await fetch(`data:${imageToSend.mimeType};base64,${imageToSend.base64}`)).blob()
        const { error: uploadError } = await supabase.storage
          .from('assignment-images')
          .upload(path, blob, { contentType: imageToSend.mimeType })
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('assignment-images').getPublicUrl(path)
          imageUrl = urlData.publicUrl
        }
      }

      const isImageAttachment = imageToSend && imageToSend.mimeType.startsWith('image/')
      const attachmentMarkdown = imageUrl
        ? isImageAttachment
          ? `![assignment image](${imageUrl})`
          : `[📄 ${imageToSend.name || 'attached file'}](${imageUrl})`
        : ''

      const userContent = attachmentMarkdown
        ? `${attachmentMarkdown}${userText ? '\n\n' + userText : ''}`
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
          image: imageToSend ? { base64: imageToSend.base64, mimeType: imageToSend.mimeType } : null,
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
    return <SettingsScreen session={session} theme={theme} setTheme={setTheme} onBack={() => setView('main')} />
  }

  return (
    <div style={{ ...styles.dashboardContainer, backgroundColor: c.bg, color: c.text }}>
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={openConversation}
        onNewChat={handleNewChat}
        onOpenSettings={() => { setSidebarOpen(false); setView('settings') }}
        theme={theme}
        session={session}
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
          <div style={{ textAlign: 'center', margin: 'auto' }}>
            <p style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>Welcome, {displayName}</p>
            <p style={{ color: c.subtext, marginTop: '0.4rem' }}>What assignment are we tackling today?</p>
          </div>
        )}

        {messages.map((m) => (
          <MessageBubble key={m.id} role={m.role} content={m.content} theme={theme} />
        ))}

        {loading && <p style={{ color: c.subtext, padding: '0.4rem 0' }}>Thinking through your assignment...</p>}
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

      {attachedImage && (
        <div style={{ margin: '0 1rem 0.6rem 1rem', position: 'relative', width: '70px' }}>
          {attachedImage.preview ? (
            <img src={attachedImage.preview} alt="attachment preview" style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '10px', border: `1px solid ${c.border}` }} />
          ) : (
            <div style={{ width: '70px', height: '70px', borderRadius: '10px', border: `1px solid ${c.border}`, backgroundColor: c.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: c.subtext, textAlign: 'center', padding: '4px', overflow: 'hidden' }}>
              📄 {attachedImage.name || 'File'}
            </div>
          )}
          <button
            onClick={handleRemoveImage}
            type="button"
            style={{ position: 'absolute', top: '-6px', right: '-6px', width: '20px', height: '20px', borderRadius: '50%', border: 'none', backgroundColor: '#ef4444', color: '#fff', fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ✕
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ ...styles.bottomBar, backgroundColor: c.surface, borderColor: c.border }}>
        <div style={{ position: 'relative' }}>
          {attachMenuOpen && (
            <div onClick={() => setAttachMenuOpen(false)} style={styles.attachMenuOverlay} />
          )}
          <button type="button" onClick={() => setAttachMenuOpen((v) => !v)} style={styles.attachBtn}>
            <PlusIcon color={c.text} />
          </button>
          {attachMenuOpen && (
            <div style={{ ...styles.attachMenu, backgroundColor: c.surface, borderColor: c.border }}>
              <label style={{ ...styles.attachMenuItem, color: c.text }} onClick={() => setAttachMenuOpen(false)}>
                <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                🖼️ Photos
              </label>
              <label style={{ ...styles.attachMenuItem, color: c.text }} onClick={() => setAttachMenuOpen(false)}>
                <input type="file" accept="application/pdf,image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                📄 Files
              </label>
              <label style={{ ...styles.attachMenuItem, color: c.text }} onClick={() => setAttachMenuOpen(false)}>
                <input type="file" accept="image/*" capture="environment" onChange={handleFileChange} style={{ display: 'none' }} />
                📷 Camera
              </label>
            </div>
          )}
        </div>
        <input
          type="text"
          placeholder="Type your assignment here..."
          value={assignmentText}
          onChange={(e) => setAssignmentText(e.target.value)}
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
  dashboardContainer: { minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', maxWidth: '640px', margin: '0 auto', width: '100%' },
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
  messagesArea: { flex: 1, display: 'flex', flexDirection: 'column', padding: '1rem', overflowY: 'auto' },
  subjectInput: { margin: '0 1rem 0.6rem 1rem', padding: '0.6rem 1rem', borderRadius: '20px', border: '1px solid', fontSize: '0.85rem', outline: 'none' },
  bottomBar: { display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem', margin: '0 1rem 1rem 1rem', borderRadius: '30px', border: '1px solid' },
  attachBtn: { display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '0.3rem', background: 'none', border: 'none' },
  attachMenuOverlay: { position: 'fixed', inset: 0, zIndex: 55 },
  attachMenu: { position: 'absolute', bottom: '48px', left: 0, borderRadius: '12px', border: '1px solid', padding: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.2rem', zIndex: 60, minWidth: '150px' },
  attachMenuItem: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 0.7rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem' },
  bottomInput: { flex: 1, border: 'none', outline: 'none', backgroundColor: 'transparent', fontSize: '1rem' },
  sendBtn: { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0.3rem' },
  themeBtn: { flex: 1, padding: '0.6rem', borderRadius: '8px', border: '1.5px solid', backgroundColor: 'transparent', cursor: 'pointer', fontSize: '0.9rem' },
  logoutBtn: { width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1.5px solid', backgroundColor: 'transparent', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 'bold' },
  sidebarOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 40 },
  sidebarPanel: { position: 'fixed', top: 0, left: 0, bottom: 0, width: '80%', maxWidth: '300px', borderRight: '1px solid', zIndex: 50, display: 'flex', flexDirection: 'column' },
  newChatSidebarBtn: { display: 'flex', alignItems: 'center', gap: '0.6rem', margin: '0 1rem', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1.5px solid', backgroundColor: 'transparent', cursor: 'pointer', fontSize: '0.9rem' },
}

export default App
