import { useEffect, useState } from 'react'
import { RESPONSE_STYLES, SUBJECTS, accentColors, accentOrder, getPalette, hexToRgba } from './theme.js'
import { BackIcon, CameraIcon, FlameIcon, XSocialIcon } from './icons.jsx'
import { supabase } from './supabaseClient'
import { btnPrimary, styles } from './styles.js'
import { urlBase64ToUint8Array } from './helpers.js'

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

export function AboutScreen({ theme, accentColor, onBack }) {
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

export function SettingsScreen({ session, theme, themePreference, setThemePreference, accentColor, setAccentColor, profile, onSaveNickname, onSavePreference, onAvatarChange, avatarInputRef, enterToSend, setEnterToSend, onDeleteAccount, onBack }) {
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

      {/* Notifications */}
      <NotificationsCard c={c} session={session} />

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
        {deleteError && <p style={{ color: 'var(--warn, #fbbf24)', fontSize: '0.82rem', margin: '0 0 0.6rem' }}>{deleteError}</p>}
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
      <p style={{ color: c.subtext, fontSize: '0.72rem', textAlign: 'center', margin: '1rem 0 0', opacity: 0.8 }}>
        RADIUS build 28 Oct 2026 (v9 symbols + drawings)
      </p>
    </div>
  )
}

function NotificationsCard({ c, session }) {
  const vapid = import.meta.env.VITE_VAPID_PUBLIC_KEY
  const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  const isIos = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)
  const standalone = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true)
  const [permission, setPermission] = useState(supported ? Notification.permission : 'denied')
  const [subscribed, setSubscribed] = useState(false)
  const [replies, setReplies] = useState(true)
  const [reminders, setReminders] = useState(true)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!supported) return
    let cancelled = false
    ;(async () => {
      try {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (cancelled) return
        setSubscribed(!!sub)
        if (sub) {
          const { data } = await supabase.from('push_subscriptions').select('notify_replies, notify_reminders').eq('endpoint', sub.endpoint).maybeSingle()
          if (!cancelled && data) {
            setReplies(data.notify_replies !== false)
            setReminders(data.notify_reminders !== false)
          }
        }
      } catch (e) { /* ignore */ }
    })()
    return () => { cancelled = true }
  }, [supported])

  const enable = async () => {
    setBusy(true)
    setNote('')
    try {
      if (!vapid) throw new Error('Notifications are not set up on the server yet.')
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') throw new Error('Notifications are blocked. Allow them for RADIUS in your browser or phone settings.')
      const reg = await navigator.serviceWorker.ready
      let sub = await reg.pushManager.getSubscription()
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapid) })
      const json = sub.toJSON()
      const { error } = await supabase.from('push_subscriptions').upsert(
        { user_id: session.user.id, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, notify_replies: true, notify_reminders: true, user_agent: (navigator.userAgent || '').slice(0, 200) },
        { onConflict: 'endpoint' }
      )
      if (error) throw new Error('Could not save this device. Has the latest database update been run?')
      setSubscribed(true)
      setReplies(true)
      setReminders(true)
      localStorage.setItem('radius-notify-replies', 'true')
    } catch (e) {
      setNote(e.message || 'Could not turn notifications on.')
    }
    setBusy(false)
  }

  const disable = async () => {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        await sub.unsubscribe()
      }
      setSubscribed(false)
    } catch (e) {
      setNote('Could not turn notifications off. Try again.')
    }
    setBusy(false)
  }

  const setPref = async (field, value) => {
    if (field === 'notify_replies') { setReplies(value); localStorage.setItem('radius-notify-replies', String(value)) }
    else setReminders(value)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) await supabase.from('push_subscriptions').update({ [field]: value }).eq('endpoint', sub.endpoint)
    } catch (e) { /* ignore */ }
  }

  const sendTest = async () => {
    try {
      const reg = await navigator.serviceWorker.ready
      await reg.showNotification('RADIUS notifications work', { body: 'You will see alerts like this when your answers are ready.', icon: '/logo.png', badge: '/logo.png', tag: 'radius-test' })
    } catch (e) {
      setNote('Could not show a test notification.')
    }
  }

  const switchRow = (label, hint, value, onChange) => (
    <div onClick={() => onChange(!value)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginTop: '0.8rem', gap: '0.8rem' }}>
      <div>
        <p style={{ margin: 0, fontSize: '0.9rem', color: c.text }}>{label}</p>
        <p style={{ margin: '0.2rem 0 0', fontSize: '0.76rem', color: c.subtext }}>{hint}</p>
      </div>
      <div style={{ width: '46px', height: '26px', borderRadius: '13px', backgroundColor: value ? c.accent : c.surfaceAlt, position: 'relative', flexShrink: 0, transition: 'background-color 0.2s' }}>
        <div style={{ position: 'absolute', top: '3px', left: value ? '23px' : '3px', width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#fff', transition: 'left 0.2s' }} />
      </div>
    </div>
  )

  return (
    <SettingsCard c={c}>
      <p style={{ color: c.subtext, fontSize: '0.78rem', fontWeight: 'bold', letterSpacing: '0.04em', margin: '0 0 0.6rem' }}>NOTIFICATIONS</p>
      {!supported ? (
        <p style={{ margin: 0, fontSize: '0.85rem', color: c.subtext }}>
          {isIos && !standalone ? 'On iPhone, add RADIUS to your home screen first (Share, then Add to Home Screen), then open it from there to turn notifications on.' : 'This browser does not support notifications.'}
        </p>
      ) : !subscribed ? (
        <>
          <p style={{ margin: 0, fontSize: '0.88rem', color: c.text }}>Get told when your answer is ready, even if RADIUS is minimised, plus a streak reminder.</p>
          {isIos && !standalone && <p style={{ margin: '0.5rem 0 0', fontSize: '0.78rem', color: c.subtext }}>On iPhone this only works from the home screen app.</p>}
          <button type="button" disabled={busy || permission === 'denied'} onClick={enable} style={{ ...btnPrimary(c), marginTop: '0.8rem', opacity: busy || permission === 'denied' ? 0.5 : 1 }}>
            {busy ? 'Turning on...' : 'Turn on notifications'}
          </button>
          {permission === 'denied' && <p style={{ margin: '0.5rem 0 0', fontSize: '0.78rem', color: 'var(--warn, #fbbf24)' }}>Blocked in your browser settings. Allow notifications for this site, then come back.</p>}
        </>
      ) : (
        <>
          <p style={{ margin: 0, fontSize: '0.88rem', color: '#22c55e', fontWeight: 700 }}>Notifications are on for this device</p>
          {switchRow('Answer ready', 'When RADIUS finishes while you are in another app', replies, (v) => setPref('notify_replies', v))}
          {switchRow('Streak reminders', 'A daily nudge if your streak is about to end', reminders, (v) => setPref('notify_reminders', v))}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.9rem' }}>
            <button type="button" onClick={sendTest} style={{ ...styles.chipBtn, borderColor: c.border, color: c.text }}>Send a test</button>
            <button type="button" disabled={busy} onClick={disable} style={{ ...styles.chipBtn, borderColor: c.border, color: c.subtext }}>Turn off</button>
          </div>
        </>
      )}
      {note && <p style={{ margin: '0.6rem 0 0', fontSize: '0.8rem', color: 'var(--warn, #fbbf24)' }}>{note}</p>}
    </SettingsCard>
  )
}
