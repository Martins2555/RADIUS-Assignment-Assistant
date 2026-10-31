import { useState } from 'react'
import { EyeIcon, EyeOffIcon } from './icons.jsx'
import { styles } from './styles.js'

// ---- Password strength -------------------------------------------------------
// Weak: shorter than 8 characters, or missing a number or a letter (blocked).
// Strong: 8+ characters with letters and numbers (the minimum to sign up).
// Very strong: Strong plus a symbol (recommended, not required).
export function passwordStrength(pw) {
  const p = pw || ''
  if (!p) return { level: 0, bars: 0, label: '', color: '#888', ok: false, hint: '' }
  const hasLetter = /[A-Za-z]/.test(p)
  const hasNumber = /[0-9]/.test(p)
  const hasSymbol = /[^A-Za-z0-9]/.test(p)
  const longEnough = p.length >= 8
  if (longEnough && hasLetter && hasNumber) {
    return hasSymbol
      ? { level: 3, bars: 4, label: 'Very strong', color: '#22c55e', ok: true, hint: '' }
      : { level: 2, bars: 3, label: 'Strong', color: '#84cc16', ok: true, hint: 'Add a symbol like @ # ! to make it very strong.' }
  }
  const needs = []
  if (!longEnough) needs.push('at least 8 characters')
  if (!hasNumber) needs.push('a number')
  if (!hasLetter) needs.push('a letter')
  const progress = 3 - needs.length
  return {
    level: 1,
    bars: progress >= 2 ? 2 : 1,
    label: 'Weak',
    color: progress >= 2 ? '#f97316' : '#ef4444',
    ok: false,
    hint: `Needs ${needs.join(', ')}.`,
  }
}

export function PasswordMeter({ password }) {
  if (!password) return null
  const st = passwordStrength(password)
  return (
    <div style={{ textAlign: 'left', marginTop: '-0.2rem' }} aria-live="polite">
      <div style={{ display: 'flex', gap: '4px' }}>
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            style={{ flex: 1, height: '5px', borderRadius: '3px', backgroundColor: i <= st.bars ? st.color : 'rgba(255,255,255,0.14)', transition: 'background-color 0.2s ease' }}
          />
        ))}
      </div>
      <p style={{ margin: '0.35rem 0 0', fontSize: '0.78rem', color: st.color, fontWeight: 700 }}>
        {st.label}
        {st.hint && <span style={{ color: '#8f98ae', fontWeight: 400 }}>{` - ${st.hint}`}</span>}
      </p>
    </div>
  )
}

// A password box with its own show/hide eye.
export function PasswordInput({ value, onChange, placeholder, autoComplete }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        required
        style={{ ...styles.input, width: '100%', boxSizing: 'border-box', paddingRight: '2.6rem' }}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? 'Hide password' : 'Show password'}
        style={{ position: 'absolute', right: '0.7rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex' }}
      >
        {show ? <EyeOffIcon color="#888" /> : <EyeIcon color="#888" />}
      </button>
    </div>
  )
}
