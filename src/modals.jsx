import { getPalette } from './theme.js'
import { useState } from 'react'
import { supabase } from './supabaseClient'
import { X_USER_ID, requestCodeUrl, requestCodeWhatsappUrl } from './constants.js'

export function LockModal({ theme, accentColor, access, email, onClose, onRedeemed }) {
  const c = getPalette(theme, accentColor)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [ok, setOk] = useState(false)

  async function redeem() {
    if (!code.trim() || busy) return
    setBusy(true)
    setMsg('')
    try {
      const { data, error: rpcError } = await supabase.rpc('redeem_code', { p_code: code })
      if (rpcError) throw rpcError
      if (data && data.ok) {
        setOk(true)
        setMsg('Unlocked! You now have full access to RADIUS.')
        onRedeemed()
      } else if (data && data.reason === 'too_many_attempts') {
        setMsg('Too many wrong attempts. Please wait 15 minutes and try again.')
      } else {
        setMsg('That code is not valid or has already been used.')
      }
    } catch (e) {
      setMsg('Could not check the code right now. Please try again.')
    }
    setBusy(false)
  }

  const limitReached = access && access.mode === 'daily' && access.daily_left <= 0

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 95, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.2rem' }}>
      <div style={{ backgroundColor: c.surface, border: `1px solid ${c.border}`, borderRadius: '16px', padding: '1.4rem', maxWidth: '360px', width: '100%' }}>
        <p style={{ fontSize: '1.05rem', fontWeight: 'bold', color: c.text, margin: '0 0 0.4rem' }}>
          {ok ? 'You are unlocked' : limitReached ? 'Free messages used up' : 'Unlock RADIUS'}
        </p>
        {!ok && (
          <p style={{ fontSize: '0.85rem', color: c.subtext, margin: '0 0 1rem', lineHeight: 1.5 }}>
            {limitReached
              ? 'You have used your free messages for today (they reset at midnight). Enter an unlock code for unlimited chatting.'
              : 'Enter your unlock code for unlimited chatting. Each code works for one account only.'}
          </p>
        )}
        {!ok && (
          <input
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === 'Enter') redeem() }}
            placeholder="RAD-XXXX-XXXX-XXXX"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            style={{ width: '100%', boxSizing: 'border-box', padding: '0.7rem 0.9rem', borderRadius: '10px', border: `1px solid ${c.border}`, backgroundColor: c.bg, color: c.text, fontSize: '0.95rem', letterSpacing: '0.05em', marginBottom: '0.8rem', outline: 'none' }}
          />
        )}
        {msg && <p style={{ fontSize: '0.82rem', color: ok ? '#22c55e' : 'var(--warn, #fbbf24)', margin: '0 0 0.8rem' }}>{msg}</p>}
        {!ok && (
          <button
            onClick={redeem}
            disabled={busy || !code.trim()}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: `1px solid ${c.accent}`, backgroundColor: 'transparent', color: c.accent, fontWeight: 'bold', cursor: 'pointer', fontSize: '0.92rem', opacity: busy || !code.trim() ? 0.6 : 1, marginBottom: '0.8rem' }}
          >
            {busy ? 'Checking...' : 'Unlock'}
          </button>
        )}
        {!ok && (
          <a
            href={requestCodeUrl(email)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'block', textAlign: 'center', width: '100%', boxSizing: 'border-box', padding: '0.9rem 0.8rem', borderRadius: '12px', border: 'none', backgroundColor: c.accent, backgroundImage: c.accentGrad, color: c.accentText, fontWeight: 'bold', textDecoration: 'none', fontSize: '0.92rem', lineHeight: 1.3, boxShadow: '0 4px 14px rgba(0,0,0,0.25)', marginBottom: '0.6rem' }}
          >
            REQUEST FOR UNLOCK CODE to continue chatting
          </a>
        )}
        {!ok && (
          <a
            href={requestCodeWhatsappUrl(email)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'block', textAlign: 'center', width: '100%', boxSizing: 'border-box', padding: '0.9rem 0.8rem', borderRadius: '12px', border: 'none', backgroundColor: '#25D366', color: '#06290f', fontWeight: 'bold', textDecoration: 'none', fontSize: '0.92rem', lineHeight: 1.3, boxShadow: '0 4px 14px rgba(0,0,0,0.25)', marginBottom: '0.6rem' }}
          >
            REQUEST ON WHATSAPP
          </a>
        )}
        {!ok && !X_USER_ID && (
          <p style={{ fontSize: '0.74rem', color: c.subtext, textAlign: 'center', margin: '0 0 0.6rem', lineHeight: 1.4 }}>
            On my X profile, tap the message icon and send me your account email{email ? ` (${email})` : ''}.
          </p>
        )}
        <button
          onClick={onClose}
          style={{ width: '100%', padding: '0.6rem', borderRadius: '10px', border: 'none', backgroundColor: 'transparent', color: c.subtext, cursor: 'pointer', fontSize: '0.85rem' }}
        >
          {ok ? 'Continue' : 'Not now'}
        </button>
      </div>
    </div>
  )
}

export function NicknamePrompt({ theme, accentColor, onSave, onSkip }) {
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
