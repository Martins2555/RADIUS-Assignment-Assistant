import { BackIcon, NewChatIcon, PencilIcon, PinIcon, SearchIcon, TrashIcon } from './icons.jsx'
import { getPalette } from './theme.js'
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { noSelectStyle, useLongPress } from './gestures.js'
import { styles } from './styles.js'
import { Logo } from './visuals.jsx'

function ConversationRow({ conv, isActive, c, onSelect, onLongPress, isRenaming, renameValue, onRenameChange, onRenameCommit }) {
  const longPress = useLongPress((x, y) => onLongPress(x, y, conv))

  if (isRenaming) {
    return (
      <input
        autoFocus
        value={renameValue}
        onChange={(e) => onRenameChange(e.target.value)}
        onBlur={onRenameCommit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); onRenameCommit() }
        }}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '0.65rem 0.8rem',
          borderRadius: '8px',
          border: `1px solid ${c.accent}`,
          backgroundColor: c.bg,
          color: c.text,
          fontSize: '0.9rem',
          marginBottom: '0.2rem',
          outline: 'none',
        }}
      />
    )
  }

  return (
    <div
      {...longPress}
      onClick={onSelect}
      style={{
        padding: '0.7rem 0.8rem',
        borderRadius: '8px',
        cursor: 'pointer',
        backgroundColor: isActive ? c.bg : 'transparent',
        color: c.text,
        fontSize: '0.9rem',
        marginBottom: '0.2rem',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        ...noSelectStyle,
      }}
    >
      {conv.is_pinned && <PinIcon color={c.accent} filled />}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{conv.title || 'New chat'}</span>
    </div>
  )
}

export function Sidebar({ open, onClose, conversations, activeConversationId, onSelectConversation, onNewChat, onOpenSettings, onGoHome, onOpenAbout, onOpenLibrary, onRenameConversation, onDeleteConversation, onTogglePin, theme, accentColor, session }) {
  const c = getPalette(theme, accentColor)
  const [rowMenu, setRowMenu] = useState(null)
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [contentMatchIds, setContentMatchIds] = useState(null)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    const q = searchQuery.trim()
    if (q.length < 2) {
      setContentMatchIds(null)
      setSearching(false)
      return
    }
    setSearching(true)
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const escaped = q.replace(/[%_\\]/g, (m) => '\\' + m)
        const { data, error } = await supabase
          .from('messages')
          .select('conversation_id')
          .ilike('content', `%${escaped}%`)
          .limit(200)
        if (cancelled) return
        setContentMatchIds(error ? null : new Set((data || []).map((r) => r.conversation_id)))
      } catch (e) {
        if (!cancelled) setContentMatchIds(null)
      }
      if (!cancelled) setSearching(false)
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [searchQuery])

  if (!open) return null

  const startRename = (conv) => {
    setRenamingId(conv.id)
    setRenameValue(conv.title || '')
    setRowMenu(null)
  }
  const commitRename = () => {
    const title = renameValue.trim()
    if (title && renamingId) onRenameConversation(renamingId, title)
    setRenamingId(null)
  }
  const confirmDelete = (conv) => {
    setRowMenu(null)
    if (window.confirm('Delete this chat? This cannot be undone.')) {
      onDeleteConversation(conv.id)
    }
  }
  const togglePin = (conv) => {
    setRowMenu(null)
    onTogglePin(conv.id, !conv.is_pinned)
  }

  const menuTop = rowMenu && typeof window !== 'undefined' ? Math.min(rowMenu.y, window.innerHeight - 150) : rowMenu?.y
  const menuLeft = rowMenu && typeof window !== 'undefined' ? Math.min(rowMenu.x, window.innerWidth - 170) : rowMenu?.x

  const pinnedConvs = conversations.filter((cv) => cv.is_pinned)
  const recentConvs = conversations.filter((cv) => !cv.is_pinned)
  const q = searchQuery.trim().toLowerCase()
  const searchResults = q
    ? conversations.filter((cv) => (cv.title || '').toLowerCase().includes(q) || (contentMatchIds && contentMatchIds.has(cv.id)))
    : []

  const renderRow = (conv) => (
    <ConversationRow
      key={conv.id}
      conv={conv}
      isActive={conv.id === activeConversationId}
      c={c}
      onSelect={() => onSelectConversation(conv)}
      onLongPress={(x, y, conv) => setRowMenu({ x, y, conv })}
      isRenaming={renamingId === conv.id}
      renameValue={renameValue}
      onRenameChange={setRenameValue}
      onRenameCommit={commitRename}
    />
  )

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

        <div style={{ padding: '0 0.6rem 0.6rem', borderBottom: `1px solid ${c.border}`, marginBottom: '0.6rem' }}>
          {[
            { key: 'home', label: 'Home', onClick: onGoHome },
            { key: 'assistant', label: 'Assistant', onClick: onNewChat },
            { key: 'library', label: 'Study Library', onClick: onOpenLibrary },
            { key: 'about', label: 'About', onClick: onOpenAbout },
          ].map((item) => (
            <div
              key={item.key}
              onClick={item.onClick}
              style={{ padding: '0.55rem 0.6rem', borderRadius: '8px', color: c.text, fontSize: '0.9rem', cursor: 'pointer' }}
            >
              {item.label}
            </div>
          ))}
        </div>

        <button onClick={onNewChat} style={{ ...styles.newChatSidebarBtn, borderColor: c.border, color: c.text }}>
          <NewChatIcon color={c.text} />
          New chat
        </button>

        <div style={{ position: 'relative', margin: '0.7rem 1rem 0' }}>
          <span style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', display: 'flex', pointerEvents: 'none' }}>
            <SearchIcon color={c.subtext} />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats"
            style={{ width: '100%', boxSizing: 'border-box', padding: '0.55rem 2rem 0.55rem 2.1rem', borderRadius: '8px', border: `1px solid ${c.border}`, backgroundColor: c.bg, color: c.text, fontSize: '0.88rem', outline: 'none' }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              style={{ position: 'absolute', right: '0.4rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: c.subtext, cursor: 'pointer', fontSize: '0.95rem', padding: '0.2rem 0.4rem' }}
            >
              ✕
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 0.6rem' }}>
          {q ? (
            <>
              <p style={{ color: c.subtext, fontSize: '0.75rem', margin: '1rem 0.4rem 0.4rem' }}>
                {searching ? 'SEARCHING...' : `RESULTS (${searchResults.length})`}
              </p>
              {!searching && searchResults.length === 0 && (
                <p style={{ color: c.subtext, fontSize: '0.85rem', padding: '0.6rem' }}>No chats match "{searchQuery.trim()}"</p>
              )}
              {searchResults.map(renderRow)}
            </>
          ) : (
            <>
              {pinnedConvs.length > 0 && (
                <>
                  <p style={{ color: c.subtext, fontSize: '0.75rem', margin: '1rem 0.4rem 0.4rem' }}>PINNED</p>
                  {pinnedConvs.map(renderRow)}
                </>
              )}

              <p style={{ color: c.subtext, fontSize: '0.75rem', margin: '1rem 0.4rem 0.4rem' }}>RECENT</p>
              {recentConvs.length === 0 && pinnedConvs.length === 0 && (
                <p style={{ color: c.subtext, fontSize: '0.85rem', padding: '0.6rem' }}>No chats yet</p>
              )}
              {recentConvs.map(renderRow)}
            </>
          )}
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
              backgroundColor: c.accent, backgroundImage: c.accentGrad,
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

      {rowMenu && (
        <>
          <div onClick={() => setRowMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 65 }} />
          <div style={{ ...styles.attachMenu, position: 'fixed', top: menuTop, left: menuLeft, zIndex: 70, backgroundColor: c.bg, borderColor: c.border }}>
            <button
              type="button"
              style={{ ...styles.attachMenuItem, color: c.text, background: 'none', border: 'none', textAlign: 'left', width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              onClick={() => togglePin(rowMenu.conv)}
            >
              <PinIcon color={c.text} /> {rowMenu.conv.is_pinned ? 'Unpin' : 'Pin'}
            </button>
            <button
              type="button"
              style={{ ...styles.attachMenuItem, color: c.text, background: 'none', border: 'none', textAlign: 'left', width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              onClick={() => startRename(rowMenu.conv)}
            >
              <PencilIcon color={c.text} /> Rename
            </button>
            <button
              type="button"
              style={{ ...styles.attachMenuItem, color: '#ef4444', background: 'none', border: 'none', textAlign: 'left', width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              onClick={() => confirmDelete(rowMenu.conv)}
            >
              <TrashIcon color="#ef4444" /> Delete
            </button>
          </div>
        </>
      )}
    </>
  )
}
