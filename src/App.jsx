import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'
import { renderToStaticMarkup } from 'react-dom/server'
import 'katex/dist/katex.min.css'
import { diagramComponents, stripDiagrams } from './DiagramBlock.jsx'
import { getPalette } from './theme.js'
import { MicIcon, MenuIcon, NewChatIcon, PlusIcon, PhotosIcon, FileAttachIcon, CameraIcon, SendIcon, StopIcon, ReplyIcon } from './icons.jsx'
import { STOP_MARKER, buildHistory, cleanStreamText, compressImage, extractFilesFromContent, fileIsStale, fileToBase64, splitStudy, stripAttachmentMarkdown, visibleRows } from './helpers.js'
import { AboutScreen, SettingsScreen } from './settings.jsx'
import { ActionBar, LibraryScreen, ProjectHome, QuizOverlay, TempCards } from './study.jsx'
import { styles } from './styles.js'
import { Sidebar } from './sidebar.jsx'
import { LongPressMenu, MessageBubble } from './chat.jsx'
import { LockModal, NicknamePrompt } from './modals.jsx'
import { HOURLY_LIMIT, TOOLS, TOOL_INFO, TOOL_PLACEHOLDERS } from './constants.js'
import { Cube3D, Hero3D } from './visuals.jsx'
import { LaunchSplash, SignInOverlay } from './motion.jsx'
import { AuthScreen, LandingScreen, ResetPasswordScreen } from './authScreens.jsx'

const SPLASH_MS = 2600

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
    root.setProperty('--warn', pal.warn)
    root.setProperty('--accent2', pal.accent2)
    root.setProperty('--accent-soft', pal.accentSoft)
    root.setProperty('--bg-glow', pal.bgGlow)
    root.setProperty('--text', pal.text)
    root.setProperty('color-scheme', theme === 'light' ? 'light' : 'dark')
  }, [theme, accentColor])
  const [mode, setMode] = useState('calculative')
  const [tool, setTool] = useState('chat')
  const [usedThisHour, setUsedThisHour] = useState(null)
  const [access, setAccess] = useState(null)
  const [lockOpen, setLockOpen] = useState(false)
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
  // Quick actions, Project mode, Study Library, background recovery
  const [actionPanel, setActionPanel] = useState(null)
  const [explainOpts, setExplainOpts] = useState({ scope: 'all', part: null, how: 'simple' })
  const [quizOpts, setQuizOpts] = useState({ count: 5, difficulty: 'medium', type: 'mcq' })
  const [hintLevel, setHintLevel] = useState(0)
  const [tempCards, setTempCards] = useState([])
  const [tempBusy, setTempBusy] = useState(false)
  const [quizOverlay, setQuizOverlay] = useState(null)
  const [toast, setToast] = useState('')
  const [statusNote, setStatusNote] = useState('')
  const [projects, setProjects] = useState([])
  const [activeProject, setActiveProject] = useState(null)
  const [projectFiles, setProjectFiles] = useState([])
  const [projectManagerOpen, setProjectManagerOpen] = useState(false)
  const [projectUploading, setProjectUploading] = useState(false)
  const [projectError, setProjectError] = useState('')
  const toastTimerRef = useRef(null)
  const activeConvRef = useRef(null)
  const activeProjectRef = useRef(null)
  const conversationsRef = useRef([])
  const openByIdRef = useRef(null)

  const c = getPalette(theme, accentColor)
  const displayName = profile?.nickname || session.user.user_metadata?.full_name || session.user.email.split('@')[0]
  activeConvRef.current = activeConversationId
  activeProjectRef.current = activeProject
  conversationsRef.current = conversations
  const messagesEndRef = useRef(null)
  const textAreaRef = useRef(null)
  const photosInputRef = useRef(null)
  const filesInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const avatarInputRef = useRef(null)
  const abortControllerRef = useRef(null)
  // Lets Stop work during the steps before the request is sent (creating the
  // chat, uploading files), when there is no network request to abort yet.
  const preflightRef = useRef({ cancelled: false })
  const formRef = useRef(null)

  useEffect(() => {
    loadConversations()
    loadProfile()
    loadProjects()
  }, [])

  // Files of the open project, refreshed while any of them is still being read.
  useEffect(() => {
    if (!activeProject) { setProjectFiles([]); return }
    loadProjectFiles(activeProject.id)
  }, [activeProject?.id])

  useEffect(() => {
    if (!activeProject) return
    const waiting = projectFiles.some((f) => (f.status === 'pending' || f.status === 'processing') && !fileIsStale(f))
    if (!waiting) return
    const timer = setInterval(() => loadProjectFiles(activeProject.id), 5000)
    return () => clearInterval(timer)
  }, [activeProject?.id, projectFiles])

  // Notification taps: open the chat the notification was about.
  useEffect(() => {
    const fromUrl = () => {
      try {
        const id = new URLSearchParams(window.location.search).get('open')
        if (id) {
          window.history.replaceState({}, '', window.location.pathname)
          return id
        }
      } catch (e) { /* ignore */ }
      return null
    }
    const first = fromUrl()
    if (first) setTimeout(() => openByIdRef.current?.(first), 600)
    const onMessage = (event) => {
      const data = event.data
      if (data && data.type === 'radius-open' && typeof data.url === 'string') {
        try {
          const id = new URL(data.url, window.location.origin).searchParams.get('open')
          if (id) openByIdRef.current?.(id)
        } catch (e) { /* ignore */ }
      }
    }
    navigator.serviceWorker?.addEventListener('message', onMessage)
    return () => navigator.serviceWorker?.removeEventListener('message', onMessage)
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
    navigator.clipboard?.writeText(stripDiagrams(text || ''))
  }

  function handleShareText(text) {
    const clean = stripDiagrams(text || '')
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
        <ReactMarkdown remarkPlugins={[[remarkGfm, { singleTilde: false }], remarkMath]} rehypePlugins={[[rehypeKatex, { errorColor: '#b45309' }]]} components={diagramComponents(getPalette('light', accentColor), true)}>{text || ''}</ReactMarkdown>
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
  async function fetchAccess() {
    try {
      const { data, error: accessError } = await supabase.rpc('get_access_status')
      if (!accessError && data && data.mode) setAccess(data)
    } catch (e) { /* lock SQL may not be installed yet */ }
  }

  function accessBlocked() {
    return !!(access && access.mode === 'daily' && access.daily_left <= 0)
  }

  async function fetchUsage() {
    fetchAccess()
    try {
      // Preferred: the server's own count (what the limit actually enforces).
      const { data: serverCount, error: serverError } = await supabase.rpc('rl_used', { p_window_minutes: 60 })
      if (!serverError && typeof serverCount === 'number') {
        setUsedThisHour(serverCount)
        return
      }
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
    const clean = stripDiagrams(splitStudy(content || '').text, '[Diagram]')
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
      .select('id, title, mode, subject, updated_at, is_pinned, project_id')
      .order('updated_at', { ascending: false })
    if (error) {
      const noProject = await supabase
        .from('conversations')
        .select('id, title, mode, subject, updated_at, is_pinned')
        .order('updated_at', { ascending: false })
      data = noProject.data
      error = noProject.error
    }
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
    const convProject = conv.project_id ? projects.find((pr) => pr.id === conv.project_id) : null
    if (convProject) {
      setTool('project')
      setActiveProject(convProject)
      localStorage.setItem('radius-active-project', convProject.id)
    } else {
      setTool('chat')
    }
    setTempCards([])
    setActionPanel(null)
    setHintLevel(0)
    setStatusNote('')
    setReplyTo(null)
    setSubject(conv.subject || '')
    setError('')
    const { data, error } = await supabase
      .from('messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true })
    if (!error) setMessages(visibleRows(data))
  }
  openByIdRef.current = openConversationById

  function handleNewChat() {
    setTempCards([])
    setActionPanel(null)
    setHintLevel(0)
    setQuizOverlay(null)
    setStatusNote('')
    setProjectManagerOpen(false)
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
  // Also used by the quick actions that save into the chat (Regenerate,
  // Explain, Show solution): they pass `action`, and Regenerate passes
  // `replaceId` so the new answer takes the old one's place.
  async function requestReply(payload) {
    const { conversationId, userText, filesForApi, history, action = null, replaceId = null, kind = null } = payload
    setRetryPayload(null)
    setError('')
    setStatusNote('')
    setLoading(true)
    setStreaming(false)
    setTempCards([])
    setActionPanel(null)
    setHintLevel(0)

    const controller = new AbortController()
    abortControllerRef.current = controller
    const startedAt = new Date(Date.now() - 2000).toISOString()
    let lastActivity = Date.now()
    let stalled = false
    // If the phone was asleep and the connection quietly died, nothing arrives
    // any more. After 40 silent seconds with the app open, give up on it and
    // fetch the saved answer from the chat instead.
    const watchdog = setInterval(() => {
      if (document.visibilityState === 'visible' && Date.now() - lastActivity > 40000) {
        stalled = true
        try { controller.abort() } catch (e) { /* ignore */ }
      }
    }, 5000)

    const streamId = `temp-a-${Date.now()}`
    let streamText = ''
    let placeholderAdded = false
    // Re-rendering markdown + maths on every tiny chunk makes long replies
    // lag on phones. Updates are batched to at most one per screen frame.
    let rafId = 0
    let pendingShown = null
    let streamClosed = false
    const flushStream = () => {
      rafId = 0
      if (streamClosed || pendingShown === null) return
      const v = pendingShown
      pendingShown = null
      setMessages((prev) => prev.map((m) => (m.id === streamId ? { ...m, content: v } : m)))
    }
    const closeStream = () => {
      streamClosed = true
      pendingShown = null
      if (rafId) { try { cancelAnimationFrame(rafId) } catch (e) { /* ignore */ } rafId = 0 }
    }
    const swapIn = (content, responseType, extra) => {
      setMessages((prev) => {
        const base = replaceId ? prev.filter((m) => m.id !== replaceId) : prev
        return [...base, { id: streamId, role: 'assistant', content, responseType, ...(extra || {}) }]
      })
    }
    const removePlaceholder = () => {
      pendingShown = null
      if (placeholderAdded) {
        setMessages((prev) => prev.filter((m) => m.id !== streamId))
        placeholderAdded = false
      }
    }

    const finish = async (result, responseType) => {
      closeStream()
      const stored = kind ? `<!--KIND:${kind}-->\n${result}` : result
      if (placeholderAdded) {
        setMessages((prev) => prev.map((m) => (m.id === streamId ? { ...m, content: stored, responseType, fresh: true } : m)))
      } else {
        placeholderAdded = true
        swapIn(stored, responseType, { fresh: true })
      }
      // For Regenerate: find the old saved answer first, save the new one,
      // then remove the old one, so a failure never leaves the chat empty.
      let oldRowId = null
      if (replaceId) {
        try {
          const { data: rows } = await supabase
            .from('messages')
            .select('id')
            .eq('conversation_id', conversationId)
            .eq('role', 'assistant')
            .order('created_at', { ascending: false })
            .limit(1)
          oldRowId = rows && rows[0] ? rows[0].id : null
        } catch (e) { /* best-effort */ }
      }
      await supabase.from('messages').insert({ conversation_id: conversationId, role: 'assistant', content: stored })
      if (oldRowId) {
        try { await supabase.from('messages').delete().eq('id', oldRowId) } catch (e) { /* best-effort */ }
      }
      loadConversations()
      touchStreak()
      fetchUsage()
      notifyLocal()
    }

    try {
      const sendGenerate = (accessToken) => fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
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
          action: action || undefined,
          projectId: tool === 'project' ? activeProject?.id : undefined,
          conversationId,
          kind: kind || undefined,
          replaceLast: !!replaceId,
        }),
        signal: controller.signal,
      })
      // Use the freshest login token. A phone that slept can hold an expired
      // one, which showed "Invalid or expired session". getSession renews it.
      let accessToken = session.access_token
      try {
        const { data: cur } = await supabase.auth.getSession()
        if (cur && cur.session && cur.session.access_token) accessToken = cur.session.access_token
      } catch (e) { /* fall back to the token we have */ }
      let response = await sendGenerate(accessToken)
      if (response.status === 401) {
        // Expired anyway: refresh once and try again before showing an error.
        try {
          const { data: ref } = await supabase.auth.refreshSession()
          if (ref && ref.session && ref.session.access_token) response = await sendGenerate(ref.session.access_token)
        } catch (e) { /* the error below explains it */ }
        if (response.status === 401) {
          // The login really is finished. Send the student to the login page
          // instead of leaving them stuck on an error.
          supabase.auth.signOut().catch(() => {})
          throw new Error('Your login ended. Please log in again.')
        }
      }

      const contentType = response.headers.get('content-type') || ''
      if (!response.ok || !contentType.includes('ndjson')) {
        // Normal JSON answer: an error, or a backend that doesn't stream yet.
        const data = await response.json().catch(() => ({}))
        if (response.status === 402) {
          setLockOpen(true)
          fetchAccess()
        }
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
              swapIn(shown)
            } else {
              pendingShown = shown
              if (!rafId) rafId = requestAnimationFrame(flushStream)
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
          lastActivity = Date.now()
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
      closeStream()
      const looksLikeDrop = err instanceof TypeError || /cut off|network|load failed|failed to fetch/i.test(err.message || '')
      if (err.name === 'AbortError' && !stalled) {
        // The student pressed stop: the screen already reacted instantly (see
        // handleStopGenerating). Keep whatever text had already arrived.
        setStreaming(false)
        setLoading(false)
        const partial = cleanStreamText(streamText)
        if (partial && placeholderAdded) {
          try {
            let oldRowId = null
            if (replaceId) {
              const { data: rows } = await supabase.from('messages').select('id').eq('conversation_id', conversationId).eq('role', 'assistant').order('created_at', { ascending: false }).limit(1)
              oldRowId = rows && rows[0] ? rows[0].id : null
            }
            await supabase.from('messages').insert({ conversation_id: conversationId, role: 'assistant', content: partial })
            if (oldRowId) await supabase.from('messages').delete().eq('id', oldRowId)
            loadConversations()
          } catch (e) { /* best-effort */ }
        } else {
          removePlaceholder()
          try {
            await supabase.from('messages').insert({ conversation_id: conversationId, role: 'assistant', content: STOP_MARKER })
          } catch (e) { /* best-effort */ }
        }
      } else if ((stalled || looksLikeDrop) && conversationId) {
        // The connection dropped (phone asleep, app switched). The server keeps
        // writing the answer and saves it into the chat, so wait for it.
        removePlaceholder()
        setStreaming(false)
        const recovered = await recoverReply(conversationId, startedAt)
        if (!recovered) {
          setError('The connection dropped before the answer finished. Tap Retry.')
          setRetryPayload(payload)
        }
      } else {
        removePlaceholder()
        setError(err.message || 'Network error. Please try again.')
        setRetryPayload(payload)
      }
    }
    clearInterval(watchdog)
    abortControllerRef.current = null
    setStreaming(false)
    setLoading(false)
  }

  const handleRetry = () => {
    if (retryPayload && !loading) requestReply(retryPayload)
  }

  // After a dropped connection: check the chat every few seconds for the
  // answer the server saved on its own, then show it.
  async function recoverReply(conversationId, sinceIso) {
    setStatusNote('Reconnecting to your answer...')
    for (let i = 0; i < 25; i++) {
      await new Promise((resolve) => setTimeout(resolve, 3000))
      if (activeConvRef.current !== conversationId) {
        setStatusNote('')
        return true
      }
      try {
        const { data } = await supabase
          .from('messages')
          .select('id')
          .eq('conversation_id', conversationId)
          .eq('role', 'assistant')
          .gt('created_at', sinceIso)
          .limit(1)
        if (data && data.length) {
          await reloadMessages(conversationId, true)
          loadConversations()
          touchStreak()
          setStatusNote('')
          return true
        }
      } catch (e) { /* try again */ }
    }
    setStatusNote('')
    return false
  }

  async function reloadMessages(conversationId, markLast) {
    const { data, error: loadError } = await supabase
      .from('messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
    if (loadError || !data) return
    if (activeConvRef.current !== conversationId) return
    const rows = visibleRows(data)
    setMessages(
      rows.map((m, i) =>
        markLast && i === rows.length - 1 && m.role === 'assistant' ? { ...m, responseType: 'assignment', fresh: true } : m
      )
    )
  }

  // A small system notification when the answer finished while RADIUS was in
  // the background (works while the page is still alive; the server push
  // covers the case where the phone froze the page).
  async function notifyLocal() {
    try {
      if (document.visibilityState === 'visible') return
      if (!('Notification' in window) || Notification.permission !== 'granted') return
      if (localStorage.getItem('radius-notify-replies') === 'false') return
      const reg = await navigator.serviceWorker?.ready
      if (!reg) return
      await reg.showNotification('Your answer is ready', {
        body: 'RADIUS finished your question. Tap to read it.',
        icon: '/logo.png',
        badge: '/logo.png',
        tag: 'radius-reply',
        data: { url: '/' },
      })
    } catch (e) { /* best-effort */ }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!assignmentText.trim() && attachedFiles.length === 0) return
    if (tool === 'project' && !activeProject) {
      setError('Pick or create a project first, then ask your question.')
      return
    }
    if (accessBlocked()) {
      setLockOpen(true)
      return
    }

    stopListening()
    setRetryPayload(null)
    setTempCards([])
    setActionPanel(null)
    setHintLevel(0)
    setLoading(true)
    setError('')
    const pre = { cancelled: false }
    preflightRef.current = pre
    const throwIfStopped = () => {
      if (pre.cancelled) {
        const stopErr = new Error('stopped')
        stopErr.name = 'AbortError'
        throw stopErr
      }
    }

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
        const convRow = { user_id: session.user.id, title, mode, subject: subject || null }
        if (tool === 'project' && activeProject) convRow.project_id = activeProject.id
        let { data: newConv, error: convError } = await supabase.from('conversations').insert(convRow).select().single()
        if (convError && convRow.project_id && /project_id/i.test(convError.message || '')) {
          delete convRow.project_id
          const retry = await supabase.from('conversations').insert(convRow).select().single()
          newConv = retry.data
          convError = retry.error
        }
        if (convError) throw new Error(convError.message)
        throwIfStopped()
        conversationId = newConv.id
        setActiveConversationId(conversationId)
        setConversations((prev) => [newConv, ...prev])
      }

      const attachmentMarkdownParts = []
      const filesForApi = []
      const attachmentFailures = []
      for (const file of filesToSend) {
        throwIfStopped()
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
      throwIfStopped()
      // Saved in the background: the request to the AI no longer waits for it.
      // (The AI answer is only saved seconds later, so the order stays correct.)
      Promise.resolve(supabase.from('messages').insert({ conversation_id: conversationId, role: 'user', content: userContent })).catch(() => {})
      fetchUsage()

      const history = buildHistory(messages)

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

  // ---- Toast ----
  function showToast(text) {
    setToast(text)
    clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(''), 2200)
  }

  // ---- Study Library ----
  async function saveToLibrary({ kind, title, content, data }) {
    const clean = (title || 'Saved item').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Saved item'
    const row = { user_id: session.user.id, kind, title: clean, content: content || '', data: data || null, project_id: tool === 'project' && activeProject ? activeProject.id : null }
    let { error: saveError } = await supabase.from('study_library').insert(row)
    if (saveError && /project_id/i.test(saveError.message || '')) {
      delete row.project_id
      saveError = (await supabase.from('study_library').insert(row)).error
    }
    if (saveError) showToast('Could not save. Has the latest database update been run?')
    else showToast('Saved to Study Library')
  }

  function titleFrom(text, fallback) {
    const line = (text || '').replace(/^#+\s*/gm, '').split('\n').map((l) => l.replace(/[*_`>|$]/g, '').trim()).find((l) => l.length > 3)
    return (line || fallback).slice(0, 70)
  }

  function lastQuestionText() {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')
    return stripAttachmentMarkdown(lastUser?.content || '')
  }

  function handleSaveMessage(text, kind, deck) {
    const k = deck ? 'quiz' : kind || 'note'
    saveToLibrary({ kind: k, title: titleFrom(text, deck ? 'Study pack' : `Reply: ${lastQuestionText().slice(0, 50) || 'saved'}`), content: text, data: deck || null })
  }

  function handleSaveTemp(card) {
    saveToLibrary({ kind: card.kind, title: titleFrom(card.content, card.kind === 'hint' ? `Hint: ${lastQuestionText().slice(0, 50)}` : 'Summary'), content: card.content })
  }

  // ---- Quick actions under a reply (each has its own behaviour) ----
  const lastMsg = messages[messages.length - 1]
  const lastKind = lastMsg && lastMsg.role === 'assistant' ? splitStudy(lastMsg.content).kind : null

  function explainParts() {
    if (!lastMsg || lastMsg.role !== 'assistant') return []
    const text = splitStudy(lastMsg.content).text
    return text
      .split('\n')
      .map((l) => l.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '').replace(/[*_`#>|]/g, '').replace(/\s+/g, ' ').trim())
      .filter((l) => l.length >= 14 && !/^\$\$?\s*$/.test(l))
      .slice(0, 10)
      .map((l) => ({ short: l.length > 80 ? l.slice(0, 80).trimEnd() + '...' : l, full: l.slice(0, 300) }))
  }

  async function runSilentAction(action, extra) {
    if (loading || !activeConversationId || !lastMsg) return
    await requestReply({
      conversationId: activeConversationId,
      userText: extra.userText,
      filesForApi: [],
      history: buildHistory(messages),
      action,
      kind: extra.kind || null,
    })
  }

  async function handleRegen(change) {
    if (loading || !activeConversationId) return
    const idx = messages.length - 1
    const last = messages[idx]
    if (!last || last.role !== 'assistant') return
    let ui = idx - 1
    while (ui >= 0 && messages[ui].role !== 'user') ui--
    if (ui < 0) return
    const userMsg = messages[ui]
    await requestReply({
      conversationId: activeConversationId,
      userText: stripAttachmentMarkdown(userMsg.content),
      filesForApi: extractFilesFromContent(userMsg.content),
      history: buildHistory(messages.slice(0, ui)),
      action: { kind: 'regen', change },
      replaceId: last.id,
    })
  }

  function handleExplain() {
    const opts = explainOpts
    runSilentAction(
      { kind: 'explain', scope: opts.scope, part: opts.part || '', how: opts.how },
      { userText: 'Please explain that.', kind: 'explain' }
    )
  }

  function handleSolution() {
    runSilentAction({ kind: 'solution' }, { userText: 'Please show the complete worked solution.', kind: 'solution' })
  }

  // One request that does not touch the chat history (hints, summaries, quizzes).
  async function generateOnce(action, userText) {
    if (accessBlocked()) {
      setLockOpen(true)
      throw new Error('You have used your free messages for today. Enter a code to continue.')
    }
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        subject,
        mode,
        tool,
        assignmentText: userText,
        history: buildHistory(messages),
        nickname: profile?.nickname || null,
        responseStyle: profile?.response_style || 'balanced',
        action,
        projectId: tool === 'project' ? activeProject?.id : undefined,
      }),
    })
    const data = await response.json().catch(() => ({}))
    if (response.status === 402) {
      setLockOpen(true)
      fetchAccess()
    } else if (response.ok) {
      fetchAccess()
    }
    if (!response.ok) throw new Error(data.error || 'Something went wrong.')
    return data
  }

  async function handleHint() {
    if (tempBusy || loading) return
    if (hintLevel >= 3) { showToast('That was the last hint. Try Show solution.'); return }
    const level = Math.min(3, hintLevel + 1)
    const convAtStart = activeConvRef.current
    setTempBusy(true)
    setError('')
    try {
      const data = await generateOnce({ kind: 'hint', level }, 'Please give me a hint.')
      if (activeConvRef.current !== convAtStart) return
      const text = splitStudy(data.result).text
      setHintLevel(level)
      setTempCards((prev) => [...prev, { id: `hint-${Date.now()}`, kind: 'hint', title: `Hint ${level} of 3`, content: text }])
    } catch (e) {
      setError(e.message || 'Could not get a hint. Try again.')
    }
    setTempBusy(false)
  }

  async function handleSummary(wholeProject) {
    if (tempBusy || loading) return
    const convAtStart = activeConvRef.current
    setTempBusy(true)
    setError('')
    try {
      const data = await generateOnce({ kind: 'summary', wholeProject: !!wholeProject }, wholeProject ? 'Summarize all of my project material.' : 'Please summarize this topic.')
      if (activeConvRef.current !== convAtStart) return
      const text = splitStudy(data.result).text
      setTempCards((prev) => [...prev, { id: `sum-${Date.now()}`, kind: 'summary', title: wholeProject ? `Summary: ${activeProject?.name || 'project'}` : 'Summary', content: text }])
    } catch (e) {
      setError(e.message || 'Could not make the summary. Try again.')
    }
    setTempBusy(false)
  }

  async function handleQuiz(wholeProject, overrides) {
    const opts = { ...quizOpts, ...(overrides || {}) }
    setActionPanel(null)
    const title = wholeProject && activeProject ? `Quiz: ${activeProject.name}` : 'Quiz'
    setQuizOverlay({ status: 'loading', deck: null, title, redo: () => handleQuiz(wholeProject, overrides) })
    try {
      const data = await generateOnce({ kind: 'quiz', count: opts.count, difficulty: opts.difficulty, type: opts.type, wholeProject: !!wholeProject }, 'Please quiz me.')
      const { deck } = splitStudy(data.result)
      if (!deck) throw new Error('The quiz could not be built this time. Try again.')
      setQuizOverlay((prev) => (prev ? { ...prev, status: 'ready', deck } : prev))
    } catch (e) {
      setQuizOverlay((prev) => (prev ? { ...prev, status: 'error', error: e.message || 'Something went wrong.' } : prev))
    }
  }

  function handleSaveQuiz() {
    if (!quizOverlay?.deck) return
    saveToLibrary({ kind: 'quiz', title: `${quizOverlay.title}: ${titleFrom(lastQuestionText(), 'practice').slice(0, 40)}`, content: '', data: quizOverlay.deck })
  }

  // ---- Projects ----
  async function loadProjects() {
    try {
      const { data, error: projError } = await supabase.from('projects').select('id, name, created_at').order('created_at', { ascending: false })
      if (projError) return
      setProjects(data || [])
      const savedId = localStorage.getItem('radius-active-project')
      if (savedId) {
        const found = (data || []).find((p) => p.id === savedId)
        if (found) setActiveProject((prev) => prev || found)
      }
    } catch (e) { /* projects table may not exist yet */ }
  }

  async function loadProjectFiles(projectId) {
    if (!projectId) { setProjectFiles([]); return }
    const { data } = await supabase
      .from('project_files')
      .select('id, name, mime_type, storage_path, status, error, char_count, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })
    if (activeProjectRef.current && activeProjectRef.current.id === projectId) setProjectFiles(data || [])
  }

  async function handleCreateProject(name) {
    setProjectError('')
    const { data, error: createError } = await supabase.from('projects').insert({ user_id: session.user.id, name }).select('id, name, created_at').single()
    if (createError || !data) {
      setProjectError('Could not create the project. Has the latest database update been run?')
      return
    }
    setProjects((prev) => [data, ...prev])
    handleSelectProject(data)
  }

  function handleSelectProject(p) {
    setProjectError('')
    setActiveProject(p)
    if (p) localStorage.setItem('radius-active-project', p.id)
    else localStorage.removeItem('radius-active-project')
    // A different project means a fresh chat.
    if (p && activeConversationId) {
      setActiveConversationId(null)
      setMessages([])
    }
  }

  async function handleDeleteProject() {
    if (!activeProject) return
    if (!window.confirm(`Delete "${activeProject.name}" and all its files? Chats stay, but they lose their link to the project.`)) return
    const proj = activeProject
    try {
      const paths = projectFiles.map((f) => f.storage_path).filter(Boolean)
      if (paths.length) await supabase.storage.from('assignment-images').remove(paths)
      await supabase.from('project_files').delete().eq('project_id', proj.id)
      await supabase.from('projects').delete().eq('id', proj.id)
    } catch (e) { /* best-effort */ }
    setProjects((prev) => prev.filter((p) => p.id !== proj.id))
    setProjectManagerOpen(false)
    handleSelectProject(null)
  }

  async function runExtract(fileId) {
    try {
      const response = await fetch('/api/project-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ fileId }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        return data.error || 'Could not read this file.'
      }
      return null
    } catch (e) {
      return 'Network problem while reading this file.'
    }
  }

  async function handleUploadProjectFiles(fileList) {
    const files = Array.from(fileList || [])
    if (!files.length || !activeProject) return
    const projectId = activeProject.id
    setProjectError('')
    setProjectUploading(true)
    const problems = []
    for (const file of files.slice(0, 10)) {
      try {
        const lowerName = (file.name || '').toLowerCase()
        let mime = file.type
        if (!mime && lowerName.endsWith('.md')) mime = 'text/markdown'
        if (!mime && lowerName.endsWith('.txt')) mime = 'text/plain'
        const okType = mime === 'application/pdf' || mime.startsWith('image/') || mime === 'text/plain' || mime === 'text/markdown'
        if (!okType) { problems.push(`"${file.name}" is not a PDF, photo or text file.`); continue }
        let blob = file
        if (mime.startsWith('image/')) {
          const compressed = await compressImage(file)
          blob = await (await fetch(`data:${compressed.mimeType};base64,${compressed.base64}`)).blob()
          mime = compressed.mimeType
        }
        if (blob.size > 12 * 1024 * 1024) { problems.push(`"${file.name}" is over 12 MB.`); continue }
        const ext = mime === 'application/pdf' ? 'pdf' : mime === 'text/plain' ? 'txt' : mime === 'text/markdown' ? 'md' : (mime.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
        const path = `${session.user.id}/proj-${projectId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        const { error: uploadError } = await supabase.storage.from('assignment-images').upload(path, blob, { contentType: mime })
        if (uploadError) { problems.push(`"${file.name}" did not upload: ${uploadError.message}`); continue }
        const { data: row, error: rowError } = await supabase
          .from('project_files')
          .insert({ project_id: projectId, user_id: session.user.id, name: file.name || 'file', mime_type: mime, storage_path: path, status: 'pending' })
          .select('id')
          .single()
        if (rowError || !row) { problems.push(`"${file.name}" could not be added.`); continue }
        await loadProjectFiles(projectId)
        const failure = await runExtract(row.id)
        if (failure) problems.push(`"${file.name}": ${failure}`)
        await loadProjectFiles(projectId)
      } catch (e) {
        problems.push(`"${file.name}" could not be added.`)
      }
    }
    if (problems.length) setProjectError(problems.join(' '))
    setProjectUploading(false)
  }

  async function handleRetryProjectFile(f) {
    setProjectError('')
    setProjectFiles((prev) => prev.map((x) => (x.id === f.id ? { ...x, status: 'processing', error: null, created_at: new Date().toISOString() } : x)))
    const failure = await runExtract(f.id)
    if (failure) setProjectError(`"${f.name}": ${failure}`)
    if (activeProject) await loadProjectFiles(activeProject.id)
  }

  async function handleDeleteProjectFile(f) {
    if (!window.confirm(`Remove "${f.name}" from this project?`)) return
    setProjectFiles((prev) => prev.filter((x) => x.id !== f.id))
    try {
      if (f.storage_path) await supabase.storage.from('assignment-images').remove([f.storage_path])
      await supabase.from('project_files').delete().eq('id', f.id)
    } catch (e) { /* best-effort */ }
  }

  function handleLikelyQuestions() {
    handleQuickAction('What are the most likely exam questions from my project material? Group them by topic and say which file each comes from.')
  }

  // Opens a chat from a notification tap (?open=<chat id>).
  async function openConversationById(id) {
    if (!id) return
    let conv = conversationsRef.current.find((cv) => cv.id === id)
    if (!conv) {
      const { data } = await supabase.from('conversations').select('id, title, mode, subject, updated_at, project_id').eq('id', id).maybeSingle()
      conv = data || null
    }
    if (conv) await openConversation(conv)
  }

  const handleStopGenerating = () => {
    preflightRef.current.cancelled = true
    abortControllerRef.current?.abort()
    // Respond instantly; saving the partial answer continues in the background.
    setStreaming(false)
    setLoading(false)
  }

  if (view === 'about') {
    return <AboutScreen theme={theme} accentColor={accentColor} onBack={() => setView('main')} />
  }

  if (view === 'library') {
    return (
      <>
        <LibraryScreen theme={theme} accentColor={accentColor} projects={projects} onBack={() => setView('main')} onToast={showToast} />
        {toast && <div style={{ position: 'fixed', left: '50%', bottom: '1.6rem', transform: 'translateX(-50%)', zIndex: 120, padding: '0.6rem 1.1rem', borderRadius: '20px', backgroundColor: c.surface, border: `1px solid ${c.border}`, color: c.text, fontSize: '0.85rem', boxShadow: '0 10px 28px rgba(0,0,0,0.35)' }}>{toast}</div>}
      </>
    )
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
        onOpenLibrary={() => { setSidebarOpen(false); setView('library') }}
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

      {lockOpen && (
        <LockModal
          theme={theme}
          accentColor={accentColor}
          access={access}
          email={session?.user?.email || ''}
          onClose={() => setLockOpen(false)}
          onRedeemed={() => fetchAccess()}
        />
      )}

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
            <span style={{ ...styles.modeBtn, backgroundColor: c.accent, backgroundImage: c.accentGrad, color: c.accentText, borderColor: c.border }}>{tool === 'project' && activeProject ? `Project: ${activeProject.name.length > 16 ? activeProject.name.slice(0, 16) + '...' : activeProject.name}` : (TOOLS.find((t) => t.id === tool) || {}).label}</span>
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
        {tool === 'project' && activeProject && messages.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', margin: '0 0 0.8rem', padding: '0.5rem 0.8rem', borderRadius: '14px', border: `1px solid ${c.border}`, backgroundColor: c.surface, flexShrink: 0 }}>
            <span style={{ fontSize: '0.8rem', color: c.subtext, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Studying from {activeProject.name}</span>
            <button type="button" onClick={() => setProjectManagerOpen(true)} style={{ ...styles.chipBtn, padding: '0.3rem 0.7rem', fontSize: '0.74rem', borderColor: c.border, color: c.text, flexShrink: 0 }}>Manage files</button>
          </div>
        )}
        {messages.length === 0 && !loading && (
          <div key={`${activeConversationId || 'new'}-${tool}`} className="radius-entrance" style={{ textAlign: 'center', margin: 'auto', padding: '0 1.2rem', maxWidth: '420px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.6rem' }}>
              <Hero3D size={tool === 'chat' ? 150 : 110} />
            </div>
            {tool === 'project' ? (
              <ProjectHome
                c={c}
                projects={projects}
                activeProject={activeProject}
                files={projectFiles}
                uploading={projectUploading}
                projectError={projectError}
                onCreate={handleCreateProject}
                onSelect={handleSelectProject}
                onLeave={() => handleSelectProject(null)}
                onDeleteProject={handleDeleteProject}
                onUpload={handleUploadProjectFiles}
                onRetryFile={handleRetryProjectFile}
                onDeleteFile={handleDeleteProjectFile}
                onSummary={() => handleSummary(true)}
                onQuiz={() => handleQuiz(true)}
                onLikely={handleLikelyQuestions}
              />
            ) : tool === 'chat' || !TOOL_INFO[tool] ? (
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
              defaultOpen={!!m.fresh}
              onSaveLibrary={handleSaveMessage}
              onLongPress={(x, y, msg) => setLongPressMenu({ x, y, ...msg })}
              onCopy={handleCopyText}
              onShare={handleShareText}
              onExportPdf={handleExportPdf}
              onFeedback={handleSetFeedback}
              onReply={startReply}
            />
            {!loading && i === messages.length - 1 && m.role === 'assistant' && m.responseType === 'assignment' && ['chat', 'project', 'notes', 'pastq'].includes(tool) && (
              <ActionBar
                c={c}
                canRegen={!lastKind}
                panel={actionPanel}
                setPanel={setActionPanel}
                busy={tempBusy}
                hintLevel={hintLevel}
                explainOpts={explainOpts}
                setExplainOpts={setExplainOpts}
                parts={actionPanel === 'explain' ? explainParts() : []}
                quizOpts={quizOpts}
                setQuizOpts={setQuizOpts}
                onRegen={handleRegen}
                onExplain={handleExplain}
                onHint={handleHint}
                onQuiz={() => handleQuiz(false)}
                onSummary={() => handleSummary(false)}
                onSolution={handleSolution}
              />
            )}
          </div>
        ))}

        <TempCards
          cards={tempCards}
          c={c}
          hintLevel={hintLevel}
          busy={tempBusy}
          onDismiss={(id) => setTempCards((prev) => prev.filter((card) => card.id !== id))}
          onSave={handleSaveTemp}
          onMoreHint={handleHint}
          onSolution={handleSolution}
          onCopy={(t) => { handleCopyText(t); showToast('Copied') }}
          onPdf={handleExportPdf}
          onFlashcards={() => handleQuiz(tool === 'project' && messages.length === 0, { type: 'short', count: 8 })}
        />
        {tempBusy && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: c.subtext, padding: '0.4rem 0' }}>
            <Cube3D size={18} />
            Working on it...
          </div>
        )}
        {loading && !streaming && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: c.subtext, padding: '0.4rem 0' }}>
            <Cube3D size={18} />
            {statusNote || 'Thinking...'}
          </div>
        )}
        {error && <p style={{ color: 'var(--warn, #fbbf24)', padding: '0.4rem 0', textAlign: 'center' }}>{error}</p>}
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

      {access && access.mode !== 'unlocked' && access.mode !== 'unauthenticated' && (
        <p style={{ margin: '0 1.2rem 0.4rem 1.2rem', fontSize: '0.72rem', textAlign: 'right', color: accessBlocked() ? '#f59e0b' : c.subtext }}>
          {access.mode === 'trial'
            ? `Free access ends in ${Math.max(1, Math.ceil((new Date(access.trial_ends_at) - Date.now()) / 3600000))}h`
            : access.mode === 'grace'
              ? `${access.grace_left} free message${access.grace_left === 1 ? '' : 's'} left`
              : `${access.daily_left} of 2 free messages left today`}
          {!accessBlocked() && (
            <>
              {' · '}
              <span onClick={() => setLockOpen(true)} style={{ cursor: 'pointer', textDecoration: 'underline', fontWeight: 'bold' }}>
                Enter code
              </span>
            </>
          )}
        </p>
      )}
      {accessBlocked() && (
        <div style={{ margin: '0 1rem 0.5rem 1rem', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setLockOpen(true)}
            style={{ width: '100%', padding: '0.75rem 0.9rem', borderRadius: '12px', border: 'none', backgroundColor: c.accent, backgroundImage: c.accentGrad, color: c.accentText, fontWeight: 'bold', fontSize: '0.85rem', lineHeight: 1.3, cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,0.25)' }}
          >
            REQUEST FOR UNLOCK CODE to continue chatting
          </button>
        </div>
      )}

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

      <QuizOverlay
        quiz={quizOverlay}
        c={c}
        onClose={() => setQuizOverlay(null)}
        onSave={handleSaveQuiz}
        onRetry={() => quizOverlay?.redo?.()}
      />

      {projectManagerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 70, backgroundColor: c.bg, backgroundImage: c.bgGlow, color: c.text, overflowY: 'auto', padding: '1.2rem' }}>
          <ProjectHome
            c={c}
            projects={projects}
            activeProject={activeProject}
            files={projectFiles}
            uploading={projectUploading}
            projectError={projectError}
            onCreate={handleCreateProject}
            onSelect={handleSelectProject}
            onLeave={() => { setProjectManagerOpen(false); handleSelectProject(null); handleNewChat() }}
            onDeleteProject={handleDeleteProject}
            onUpload={handleUploadProjectFiles}
            onRetryFile={handleRetryProjectFile}
            onDeleteFile={handleDeleteProjectFile}
            onSummary={() => handleSummary(true)}
            onQuiz={() => handleQuiz(true)}
            onLikely={handleLikelyQuestions}
            onClose={() => setProjectManagerOpen(false)}
          />
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', left: '50%', bottom: '5.5rem', transform: 'translateX(-50%)', zIndex: 120, padding: '0.6rem 1.1rem', borderRadius: '20px', backgroundColor: c.surface, border: `1px solid ${c.border}`, color: c.text, fontSize: '0.85rem', boxShadow: '0 10px 28px rgba(0,0,0,0.35)' }}>
          {toast}
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

function App() {
  const [session, setSession] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)
  const [showLanding, setShowLanding] = useState(true)
  const [authSignUp, setAuthSignUp] = useState(true)
  // Sign-in animation: null (off), 'working' (request running), 'success' (check mark).
  const [signInFx, setSignInFx] = useState(null)
  const signInFxRef = useRef(null)
  const setFx = (v) => { signInFxRef.current = v; setSignInFx(v) }
  // The launch animation sits on top of the app for this long, while the app
  // loads underneath. Change SPLASH_MS to make it shorter or longer.
  const [splashDone, setSplashDone] = useState(false)
  useEffect(() => {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const id = setTimeout(() => setSplashDone(true), reduce ? 500 : SPLASH_MS)
    return () => clearTimeout(id)
  }, [])
  useEffect(() => {
    if (signInFx === 'success') {
      const id = setTimeout(() => setFx(null), 1900)
      return () => clearTimeout(id)
    }
    if (signInFx === 'working') {
      const id = setTimeout(() => setFx(null), 20000) // safety: never get stuck
      return () => clearTimeout(id)
    }
    return undefined
  }, [signInFx])

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
      // Only a sign-in the user just started plays the check mark. Restoring an
      // old session on page load does not.
      if (event === 'SIGNED_IN' && signInFxRef.current === 'working') {
        setFx('success')
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  let screen = null
  if (!checkingSession) {
    if (passwordRecovery) {
      screen = <ResetPasswordScreen onDone={() => setPasswordRecovery(false)} />
    } else if (session) {
      screen = <Dashboard session={session} />
    } else if (showLanding) {
      screen = (
        <LandingScreen
          onGetStarted={() => { setAuthSignUp(true); setShowLanding(false) }}
          onSignIn={() => { setAuthSignUp(false); setShowLanding(false) }}
        />
      )
    } else {
      screen = <AuthScreen initialSignUp={authSignUp} onSignInStart={() => setFx('working')} onSignInFail={() => setFx(null)} />
    }
  }

  return (
    <>
      {screen}
      {(checkingSession || !splashDone) && <LaunchSplash />}
      {signInFx && <SignInOverlay status={signInFx} />}
    </>
  )
}

export default App
