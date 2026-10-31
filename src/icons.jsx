// Small SVG icons used by the app. Moved out of App.jsx unchanged.

export function MicIcon({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="9" y="3" width="6" height="11" rx="3" stroke={color} strokeWidth="1.8" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function SearchIcon({ color }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="6.5" stroke={color} strokeWidth="1.8" />
      <path d="M16 16l4.5 4.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function EyeIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.7" />
    </svg>
  )
}

export function EyeOffIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M3 3l18 18M9.9 9.9a3 3 0 0 0 4.2 4.2M6.2 6.5C3.9 8 1.5 12 1.5 12s3.5 7 10.5 7c1.9 0 3.5-.5 4.9-1.2M17 16.2C20 14.5 22.5 12 22.5 12s-1-2-3-3.8" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" style={{ marginRight: '10px' }}>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4c-7.4 0-13.8 4.2-17 10.3z"/>
      <path fill="#4CAF50" d="M24 44c5.4 0 10.4-2.1 14.1-5.5l-6.5-5.5C29.5 34.8 26.9 36 24 36c-5.3 0-9.7-3.1-11.3-7.7l-6.6 5.1C9.8 39.8 16.4 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.9 2.5-2.5 4.6-4.7 6l6.5 5.5C40.3 36.9 44 31.1 44 24c0-1.3-.1-2.7-.4-3.5z"/>
    </svg>
  )
}

export function MenuIcon({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 6h18M3 12h18M3 18h18" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function NewChatIcon({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function BackIcon({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M15 18l-6-6 6-6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function PlusIcon({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" />
      <path d="M12 8v8M8 12h8" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function PhotosIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="16" rx="2.5" stroke={color} strokeWidth="1.7" />
      <circle cx="8.5" cy="9.5" r="1.6" stroke={color} strokeWidth="1.5" />
      <path d="M4 17l5-5 3.5 3.5L17 10l4 4.5" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function FileAttachIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M8 2h6l5 5v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M14 2v5h5" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9 13h6M9 17h6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function CameraIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 8a2 2 0 0 1 2-2h1.5l1-1.6A1.5 1.5 0 0 1 9.8 3.7h4.4a1.5 1.5 0 0 1 1.3.7l1 1.6H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="3.4" stroke={color} strokeWidth="1.7" />
    </svg>
  )
}

export function SendIcon({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M4 12l16-7-6 16-2.5-6.5L4 12z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}

export function StopIcon({ color }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect x="5" y="5" width="14" height="14" rx="2.5" fill={color} />
    </svg>
  )
}

export function CopyIcon({ color }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <rect x="9" y="9" width="12" height="12" rx="2" stroke={color} strokeWidth="1.8" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function ThumbsUpIcon({ color, filled }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? color : 'none'}>
      <path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3zm0 0l4.5-8a2 2 0 0 1 3.4 1.9L13.8 9H19a2 2 0 0 1 1.9 2.7l-2.6 7A2 2 0 0 1 16.4 20H10a3 3 0 0 1-3-3" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}

export function ThumbsDownIcon({ color, filled }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? color : 'none'} style={{ transform: 'rotate(180deg)' }}>
      <path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3zm0 0l4.5-8a2 2 0 0 1 3.4 1.9L13.8 9H19a2 2 0 0 1 1.9 2.7l-2.6 7A2 2 0 0 1 16.4 20H10a3 3 0 0 1-3-3" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}

export function TrashIcon({ color }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0v13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function PencilIcon({ color }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M4 20l1-4L16 5l3 3L8 19l-4 1z" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function PinIcon({ color, filled }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? color : 'none'}>
      <path d="M12 2l2 6 6 2-6 4-1 8-1-8-6-4 6-2z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}

export function XSocialIcon({ color }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={color}>
      <path d="M18.9 2.4h3.3l-7.2 8.2 8.5 11h-6.6l-5.2-6.8-5.9 6.8H2.4l7.7-8.8L2 2.4h6.8l4.7 6.2zM17.7 19.6h1.8L7.4 4.3H5.5z" />
    </svg>
  )
}

export function FlameIcon({ color }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={color}>
      <path d="M12 2c1 3-3 4.5-3 8a3 3 0 0 0 6 0c0-1-.4-1.8-1-2.5 2 1 3.5 3.3 3.5 5.8a5.5 5.5 0 0 1-11 0C6.5 9 9 6.5 12 2z" />
    </svg>
  )
}

export function ReplyIcon({ color }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M9 7L4 12l5 5" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 12h9a7 7 0 0 1 7 7v1" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ShareIcon({ color }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <circle cx="18" cy="5" r="2.6" stroke={color} strokeWidth="1.8" />
      <circle cx="6" cy="12" r="2.6" stroke={color} strokeWidth="1.8" />
      <circle cx="18" cy="19" r="2.6" stroke={color} strokeWidth="1.8" />
      <path d="M8.3 10.8l7.4-4.4M8.3 13.2l7.4 4.4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function DownloadIcon({ color }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function BookmarkIcon({ color, filled }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? color : 'none'}>
      <path d="M6 4h12a1 1 0 0 1 1 1v15l-7-4.5L5 20V5a1 1 0 0 1 1-1z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}
