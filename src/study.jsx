import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { diagramComponents } from './DiagramBlock.jsx'
import { BackIcon } from './icons.jsx'
import { getPalette } from './theme.js'
import { supabase } from './supabaseClient'
import { btnPrimary, styles } from './styles.js'
import { Cube3D } from './visuals.jsx'
import { fileIsStale } from './helpers.js'
import { KIND_LABELS } from './constants.js'

export function StudyDeck({ deck, c }) {
  const cards = Array.isArray(deck?.flashcards) ? deck.flashcards : []
  const quiz = Array.isArray(deck?.quiz) ? deck.quiz : []
  const [tab, setTab] = useState(cards.length ? 'cards' : 'quiz')
  const [ci, setCi] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [qi, setQi] = useState(0)
  const [picked, setPicked] = useState(null)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)

  if (!cards.length && !quiz.length) return null

  const tabBtn = (id, label) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      style={{ ...styles.chipBtn, borderColor: c.border, backgroundColor: tab === id ? c.accent : 'transparent', backgroundImage: tab === id ? c.accentGrad : 'none', color: tab === id ? c.accentText : c.text }}
    >
      {label}
    </button>
  )

  // Flip back first, then swap the card, so the next answer is never seen
  // through the back of the card while it turns.
  const goCard = (next) => {
    if (flipped) {
      setFlipped(false)
      setTimeout(() => setCi(next), 230)
    } else {
      setCi(next)
    }
  }
  const pickOption = (i) => {
    if (picked !== null) return
    setPicked(i)
    if (i === Number(quiz[qi].answer)) setScore((v) => v + 1)
  }
  const nextQuestion = () => {
    if (qi + 1 >= quiz.length) { setDone(true); return }
    setQi(qi + 1)
    setPicked(null)
  }
  const restartQuiz = () => { setQi(0); setPicked(null); setScore(0); setDone(false) }

  return (
    <div data-noswipe="true" style={{ width: '100%', maxWidth: '420px', margin: '0.6rem 0 0.4rem', padding: '0.8rem', borderRadius: '16px', border: `1px solid ${c.border}`, backgroundColor: c.surface, color: c.text }}>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.7rem' }}>
        {cards.length > 0 && tabBtn('cards', `Flashcards (${cards.length})`)}
        {quiz.length > 0 && tabBtn('quiz', `Quiz (${quiz.length})`)}
      </div>

      {tab === 'cards' && cards.length > 0 && (
        <div>
          <div onClick={() => setFlipped((v) => !v)} style={{ perspective: '1000px', cursor: 'pointer' }}>
            <div style={{ display: 'grid', transformStyle: 'preserve-3d', transition: 'transform 0.5s cubic-bezier(0.4, 0.2, 0.2, 1)', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
              <div style={{ gridArea: '1 / 1', minHeight: '150px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '1rem', borderRadius: '14px', border: `1px solid ${c.border}`, backgroundColor: c.bg, color: c.text, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
                <span style={{ fontSize: '0.7rem', opacity: 0.7, marginBottom: '0.5rem' }}>QUESTION (tap to flip)</span>
                <span style={{ fontSize: '1rem', lineHeight: 1.5 }}>{cards[ci].q}</span>
              </div>
              <div style={{ gridArea: '1 / 1', minHeight: '150px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '1rem', borderRadius: '14px', border: `1px solid ${c.border}`, backgroundColor: c.accent, backgroundImage: c.accentGrad, color: c.accentText, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                <span style={{ fontSize: '0.7rem', opacity: 0.8, marginBottom: '0.5rem' }}>ANSWER</span>
                <span style={{ fontSize: '1rem', lineHeight: 1.5 }}>{cards[ci].a}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.7rem' }}>
            <button type="button" disabled={ci === 0} onClick={() => goCard(ci - 1)} style={{ ...styles.chipBtn, borderColor: c.border, color: c.text, opacity: ci === 0 ? 0.4 : 1 }}>Prev</button>
            <span style={{ fontSize: '0.8rem', color: c.subtext }}>{ci + 1} / {cards.length}</span>
            <button type="button" disabled={ci === cards.length - 1} onClick={() => goCard(ci + 1)} style={{ ...styles.chipBtn, borderColor: c.border, color: c.text, opacity: ci === cards.length - 1 ? 0.4 : 1 }}>Next</button>
          </div>
        </div>
      )}

      {tab === 'quiz' && quiz.length > 0 && (
        done ? (
          <div style={{ textAlign: 'center', padding: '0.6rem 0' }}>
            <p style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>You scored {score} / {quiz.length}</p>
            <p style={{ color: c.subtext, fontSize: '0.85rem', margin: '0.4rem 0 0.8rem' }}>
              {score === quiz.length ? 'Perfect. You know this topic.' : score >= Math.ceil(quiz.length / 2) ? 'Good job. Review the ones you missed.' : 'Go through the flashcards again, then retry.'}
            </p>
            <button type="button" onClick={restartQuiz} style={{ ...styles.chipBtn, borderColor: c.border, color: c.text }}>Try again</button>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: '0.75rem', color: c.subtext, marginBottom: '0.4rem' }}>Question {qi + 1} of {quiz.length}</p>
            <p style={{ fontWeight: 'bold', marginBottom: '0.7rem', lineHeight: 1.5 }}>{quiz[qi].q}</p>
            {(quiz[qi].options || []).map((opt, i) => {
              const isCorrect = i === Number(quiz[qi].answer)
              const isPicked = picked === i
              let bg = 'transparent'
              let border = c.border
              if (picked !== null && isCorrect) { bg = 'rgba(34,197,94,0.18)'; border = '#22c55e' }
              else if (isPicked) { bg = 'rgba(239,68,68,0.18)'; border = '#ef4444' }
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pickOption(i)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.6rem 0.8rem', marginBottom: '0.45rem', borderRadius: '12px', border: `1.5px solid ${border}`, backgroundColor: bg, color: c.text, fontSize: '0.88rem', cursor: picked === null ? 'pointer' : 'default' }}
                >
                  {String.fromCharCode(65 + i)}. {opt}
                </button>
              )
            })}
            {picked !== null && (
              <div style={{ marginTop: '0.5rem' }}>
                {quiz[qi].why && <p style={{ fontSize: '0.82rem', color: c.subtext, marginBottom: '0.6rem' }}>{picked === Number(quiz[qi].answer) ? 'Correct. ' : 'Not quite. '}{quiz[qi].why}</p>}
                <button type="button" onClick={nextQuestion} style={{ ...styles.chipBtn, borderColor: c.border, backgroundColor: c.accent, backgroundImage: c.accentGrad, color: c.accentText }}>
                  {qi + 1 >= quiz.length ? 'See score' : 'Next question'}
                </button>
              </div>
            )}
          </div>
        )
      )}
    </div>
  )
}

// ---- Small shared pieces for the new features ---------------------------------


function MarkdownBlock({ text, c }) {
  return (
    <div style={{ lineHeight: 1.6, fontSize: '0.92rem' }} className="radius-markdown">
      <ReactMarkdown
        remarkPlugins={[[remarkGfm, { singleTilde: false }], remarkMath]}
        rehypePlugins={[[rehypeKatex, { errorColor: c.warn }]]}
        components={{
          ...diagramComponents(c),
          table: ({ node, ...rest }) => (
            <div data-noswipe="true" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', margin: '0.5rem 0 0.8rem', borderRadius: '10px', border: `1px solid ${c.border}` }}>
              <table {...rest} style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.85rem' }} />
            </div>
          ),
          th: ({ node, ...rest }) => <th {...rest} style={{ textAlign: 'left', padding: '0.5rem 0.7rem', fontWeight: 'bold', minWidth: '90px', backgroundColor: c.bg, borderBottom: `1px solid ${c.border}` }} />,
          td: ({ node, ...rest }) => <td {...rest} style={{ textAlign: 'left', padding: '0.5rem 0.7rem', verticalAlign: 'top', minWidth: '90px', borderBottom: `1px solid ${c.border}` }} />,
          a: (props) => <a href={props.href} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>{props.children}</a>,
          p: (props) => <p {...props} style={{ margin: '0 0 0.5rem 0' }} />,
        }}
      >
        {text || ''}
      </ReactMarkdown>
    </div>
  )
}

// ---- Quick action bar under an assignment reply ---------------------------------
// Each button has its own behaviour. The small choices (what to change, which
// part to explain, quiz size) open inline right under the buttons.
function Choice({ c, active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ ...styles.chipBtn, padding: '0.4rem 0.8rem', fontSize: '0.78rem', borderColor: active ? c.accent : c.border, backgroundColor: active ? c.accentSoft : 'transparent', color: c.text }}
    >
      {children}
    </button>
  )
}

function ChoiceRow({ c, label, children }) {
  return (
    <div style={{ marginTop: '0.55rem' }}>
      <p style={{ margin: '0 0 0.35rem', fontSize: '0.74rem', color: c.subtext, fontWeight: 700 }}>{label}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>{children}</div>
    </div>
  )
}

export function ActionBar({ c, canRegen, panel, setPanel, busy, hintLevel, explainOpts, setExplainOpts, parts, quizOpts, setQuizOpts, onRegen, onExplain, onHint, onQuiz, onSummary, onSolution }) {
  const chip = (id, label, onClick, active) => (
    <button
      key={id}
      type="button"
      disabled={busy}
      onClick={onClick}
      style={{ ...styles.chipBtn, borderColor: active ? c.accent : c.border, backgroundColor: active ? c.accentSoft : 'transparent', color: c.text, opacity: busy ? 0.6 : 1 }}
    >
      {label}
    </button>
  )
  const toggle = (id) => setPanel(panel === id ? null : id)

  return (
    <div style={{ margin: '0.5rem 0 0.8rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {canRegen && chip('regen', 'Regenerate', () => toggle('regen'), panel === 'regen')}
        {chip('explain', 'Explain this', () => toggle('explain'), panel === 'explain')}
        {chip('hint', hintLevel > 0 ? `Hint (${hintLevel}/3)` : 'Give me a hint', () => { setPanel(null); onHint() }, false)}
        {chip('quiz', 'Quiz me', () => toggle('quiz'), panel === 'quiz')}
        {chip('summary', 'Summarize', () => { setPanel(null); onSummary() }, false)}
        {chip('solution', 'Show solution', () => { setPanel(null); onSolution() }, false)}
      </div>

      {panel === 'regen' && (
        <div style={{ marginTop: '0.6rem', padding: '0.7rem 0.8rem', borderRadius: '14px', border: `1px solid ${c.border}`, backgroundColor: c.surface }}>
          <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700 }}>What should change?</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
            <Choice c={c} onClick={() => onRegen('shorter')}>Shorter</Choice>
            <Choice c={c} onClick={() => onRegen('simpler')}>Simpler</Choice>
            <Choice c={c} onClick={() => onRegen('steps')}>More steps</Choice>
            <Choice c={c} onClick={() => onRegen('method')}>Different method</Choice>
            <Choice c={c} onClick={() => onRegen('redo')}>Just redo it</Choice>
          </div>
        </div>
      )}

      {panel === 'explain' && (
        <div style={{ padding: '0.7rem 0.8rem', marginTop: '0.6rem', borderRadius: '14px', border: `1px solid ${c.border}`, backgroundColor: c.surface }}>
          <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700 }}>Explain what, and how?</p>
          <ChoiceRow c={c} label="What">
            <Choice c={c} active={explainOpts.scope === 'all'} onClick={() => setExplainOpts({ ...explainOpts, scope: 'all', part: null })}>Whole answer</Choice>
            <Choice c={c} active={explainOpts.scope === 'part'} onClick={() => setExplainOpts({ ...explainOpts, scope: 'part' })}>One part</Choice>
          </ChoiceRow>
          {explainOpts.scope === 'part' && (
            <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '190px', overflowY: 'auto' }}>
              {parts.length === 0 && <p style={{ margin: 0, fontSize: '0.8rem', color: c.subtext }}>No separate parts found. Use Whole answer.</p>}
              {parts.map((pt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setExplainOpts({ ...explainOpts, part: pt.full })}
                  style={{ textAlign: 'left', padding: '0.45rem 0.65rem', borderRadius: '10px', border: `1.5px solid ${explainOpts.part === pt.full ? c.accent : c.border}`, backgroundColor: explainOpts.part === pt.full ? c.accentSoft : 'transparent', color: c.text, fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  {pt.short}
                </button>
              ))}
            </div>
          )}
          <ChoiceRow c={c} label="How">
            <Choice c={c} active={explainOpts.how === 'simple'} onClick={() => setExplainOpts({ ...explainOpts, how: 'simple' })}>Simple</Choice>
            <Choice c={c} active={explainOpts.how === 'deeper'} onClick={() => setExplainOpts({ ...explainOpts, how: 'deeper' })}>Deeper</Choice>
            <Choice c={c} active={explainOpts.how === 'example'} onClick={() => setExplainOpts({ ...explainOpts, how: 'example' })}>With an example</Choice>
          </ChoiceRow>
          <button
            type="button"
            disabled={explainOpts.scope === 'part' && !explainOpts.part}
            onClick={onExplain}
            style={{ ...btnPrimary(c), marginTop: '0.7rem', opacity: explainOpts.scope === 'part' && !explainOpts.part ? 0.45 : 1 }}
          >
            Explain
          </button>
        </div>
      )}

      {panel === 'quiz' && (
        <div style={{ padding: '0.7rem 0.8rem', marginTop: '0.6rem', borderRadius: '14px', border: `1px solid ${c.border}`, backgroundColor: c.surface }}>
          <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700 }}>Set up your quiz</p>
          <ChoiceRow c={c} label="Questions">
            {[5, 8, 10].map((n) => <Choice key={n} c={c} active={quizOpts.count === n} onClick={() => setQuizOpts({ ...quizOpts, count: n })}>{n}</Choice>)}
          </ChoiceRow>
          <ChoiceRow c={c} label="Difficulty">
            {[['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']].map(([v, l]) => <Choice key={v} c={c} active={quizOpts.difficulty === v} onClick={() => setQuizOpts({ ...quizOpts, difficulty: v })}>{l}</Choice>)}
          </ChoiceRow>
          <ChoiceRow c={c} label="Type">
            {[['mcq', 'Multiple choice'], ['calc', 'Calculation'], ['short', 'Short answer']].map(([v, l]) => <Choice key={v} c={c} active={quizOpts.type === v} onClick={() => setQuizOpts({ ...quizOpts, type: v })}>{l}</Choice>)}
          </ChoiceRow>
          <button type="button" onClick={onQuiz} style={{ ...btnPrimary(c), marginTop: '0.7rem' }}>Start quiz</button>
        </div>
      )}
    </div>
  )
}

// Hints and summaries appear as temporary cards under the chat. They are not
// added to the chat history, but can be saved to the Study Library.
export function TempCards({ cards, c, hintLevel, busy, onDismiss, onSave, onMoreHint, onSolution, onCopy, onPdf, onFlashcards }) {
  if (!cards.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', margin: '0.3rem 0 0.8rem' }}>
      {cards.map((card, i) => {
        const isLast = i === cards.length - 1
        return (
          <div key={card.id} className="radius-entrance" style={{ padding: '0.8rem 0.9rem', borderRadius: '16px', border: `1px solid ${c.border}`, borderLeft: `4px solid ${c.accent}`, backgroundColor: c.surface }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: c.accent }}>{card.title}</span>
              <button type="button" onClick={() => onDismiss(card.id)} aria-label="Dismiss" style={{ background: 'none', border: 'none', color: c.subtext, cursor: 'pointer', fontSize: '0.95rem', padding: '0 0.2rem' }}>✕</button>
            </div>
            <MarkdownBlock text={card.content} c={c} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginTop: '0.6rem' }}>
              {card.kind === 'hint' && isLast && hintLevel < 3 && (
                <button type="button" disabled={busy} onClick={onMoreHint} style={{ ...btnPrimary(c), opacity: busy ? 0.6 : 1 }}>Another hint</button>
              )}
              {card.kind === 'hint' && isLast && hintLevel >= 3 && (
                <>
                  <span style={{ fontSize: '0.78rem', color: c.subtext, alignSelf: 'center' }}>That was the last hint.</span>
                  <button type="button" onClick={onSolution} style={btnPrimary(c)}>Show solution</button>
                </>
              )}
              {card.kind === 'summary' && (
                <>
                  <button type="button" disabled={busy} onClick={onFlashcards} style={{ ...btnPrimary(c), opacity: busy ? 0.6 : 1 }}>Make flashcards</button>
                  <button type="button" onClick={() => onCopy(card.content)} style={{ ...styles.chipBtn, borderColor: c.border, color: c.text }}>Copy</button>
                  <button type="button" onClick={() => onPdf(card.content)} style={{ ...styles.chipBtn, borderColor: c.border, color: c.text }}>PDF</button>
                </>
              )}
              <button type="button" onClick={() => onSave(card)} style={{ ...styles.chipBtn, borderColor: c.border, color: c.text }}>Save to Library</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Full-screen quiz. Reuses the same flashcards/quiz player as Study Pack.
export function QuizOverlay({ quiz, c, onClose, onSave, onRetry }) {
  if (!quiz) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, backgroundColor: c.bg, backgroundImage: c.bgGlow, color: c.text, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: '640px', padding: '1rem 1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button type="button" onClick={onClose} style={styles.iconBtn} aria-label="Close quiz"><BackIcon color={c.text} /></button>
        <span className="radius-display" style={{ fontWeight: 700, fontSize: '1.05rem' }}>{quiz.title || 'Quiz'}</span>
        <div style={{ width: '22px' }} />
      </div>
      <div style={{ width: '100%', maxWidth: '460px', padding: '0.5rem 1.2rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {quiz.status === 'loading' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: c.subtext, marginTop: '3rem' }}>
            <Cube3D size={22} />
            Building your quiz...
          </div>
        )}
        {quiz.status === 'error' && (
          <div style={{ textAlign: 'center', marginTop: '3rem' }}>
            <p style={{ color: 'var(--warn, #fbbf24)' }}>{quiz.error}</p>
            <button type="button" onClick={onRetry} style={{ ...btnPrimary(c), marginTop: '0.8rem' }}>Try again</button>
          </div>
        )}
        {quiz.status === 'ready' && quiz.deck && (
          <>
            <StudyDeck deck={quiz.deck} c={c} />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
              <button type="button" onClick={onSave} style={{ ...styles.chipBtn, borderColor: c.border, color: c.text }}>Save to Library</button>
              <button type="button" onClick={onRetry} style={{ ...styles.chipBtn, borderColor: c.border, color: c.text }}>New quiz</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function ProjectHome({ c, projects, activeProject, files, uploading, projectError, onCreate, onSelect, onLeave, onDeleteProject, onUpload, onRetryFile, onDeleteFile, onSummary, onQuiz, onLikely, onClose }) {
  const [name, setName] = useState('')
  const inputRef = useRef(null)
  const readyCount = files.filter((f) => f.status === 'ready').length

  const create = (e) => {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    onCreate(n)
    setName('')
  }

  const card = { padding: '0.9rem 1rem', borderRadius: '16px', border: `1px solid ${c.border}`, backgroundColor: c.surface }

  if (!activeProject) {
    return (
      <div style={{ textAlign: 'left', width: '100%', maxWidth: '440px', margin: '0 auto' }}>
        <p className="radius-display" style={{ fontSize: '1.4rem', fontWeight: 700, textAlign: 'center' }}>Project mode</p>
        <p style={{ color: c.subtext, marginTop: '0.35rem', textAlign: 'center', fontSize: '0.9rem' }}>
          Upload your notes for a course or topic. RADIUS reads them, then you study from your own material.
        </p>
        <form onSubmit={create} style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name a new project, e.g. Thermodynamics"
            maxLength={60}
            style={{ flex: 1, minWidth: 0, padding: '0.7rem 0.9rem', borderRadius: '14px', border: `1.5px solid ${c.border}`, backgroundColor: c.surface, color: c.text, fontSize: '0.9rem', outline: 'none' }}
          />
          <button type="submit" disabled={!name.trim()} style={{ ...btnPrimary(c), opacity: name.trim() ? 1 : 0.45 }}>Create</button>
        </form>
        {projectError && <p style={{ color: 'var(--warn, #fbbf24)', fontSize: '0.82rem', marginTop: '0.6rem' }}>{projectError}</p>}
        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
          {projects.length === 0 && <p style={{ color: c.subtext, fontSize: '0.82rem', textAlign: 'center' }}>No projects yet. Create your first one above.</p>}
          {projects.map((p) => (
            <div key={p.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }} onClick={() => onSelect(p)}>
              <span style={{ width: '34px', height: '34px', borderRadius: '10px', backgroundColor: c.accentSoft, color: c.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>
                {(p.name || '?').slice(0, 1).toUpperCase()}
              </span>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 700 }}>{p.name}</span>
              <span style={{ color: c.subtext, fontSize: '0.8rem' }}>Open</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ textAlign: 'left', width: '100%', maxWidth: '440px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: '0.74rem', color: c.subtext, fontWeight: 700 }}>PROJECT</p>
          <p className="radius-display" style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeProject.name}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
          <button type="button" onClick={onLeave} style={{ ...styles.chipBtn, padding: '0.4rem 0.8rem', borderColor: c.border, color: c.text }}>Switch</button>
          {onClose && <button type="button" onClick={onClose} style={{ ...btnPrimary(c), padding: '0.4rem 0.8rem' }}>Done</button>}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="application/pdf,image/*,text/plain,.txt,.md"
        style={{ display: 'none' }}
        onChange={(e) => { onUpload(e.target.files); e.target.value = '' }}
      />
      <div style={{ ...card, marginTop: '0.9rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem' }}>Study material ({files.length})</p>
          <button type="button" disabled={uploading} onClick={() => inputRef.current?.click()} style={{ ...btnPrimary(c), padding: '0.4rem 0.85rem', opacity: uploading ? 0.6 : 1 }}>
            {uploading ? 'Uploading...' : 'Add files'}
          </button>
        </div>
        <p style={{ margin: '0.35rem 0 0', fontSize: '0.76rem', color: c.subtext }}>PDFs, photos of notes, or text files. Up to 12 MB each.</p>
        {projectError && <p style={{ color: 'var(--warn, #fbbf24)', fontSize: '0.8rem', marginTop: '0.5rem' }}>{projectError}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.7rem' }}>
          {files.length === 0 && <p style={{ margin: 0, fontSize: '0.82rem', color: c.subtext }}>Nothing here yet. Add your notes to begin.</p>}
          {files.map((f) => {
            const stale = fileIsStale(f)
            const failed = f.status === 'failed' || stale
            const working = !failed && f.status !== 'ready'
            return (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.6rem', borderRadius: '12px', border: `1px solid ${c.border}`, backgroundColor: c.bg }}>
                <span style={{ fontSize: '0.6rem', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', backgroundColor: c.accent, backgroundImage: c.accentGrad, color: c.accentText, flexShrink: 0 }}>
                  {(f.name?.split('.').pop() || 'FILE').toUpperCase().slice(0, 4)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '0.84rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</p>
                  <p style={{ margin: '1px 0 0', fontSize: '0.72rem', color: failed ? 'var(--warn, #fbbf24)' : working ? c.subtext : '#22c55e' }}>
                    {failed ? (f.error || 'Could not be read') : working ? 'Reading...' : `Ready${f.char_count ? ` · ${Math.max(1, Math.round(f.char_count / 1000))}k characters` : ''}`}
                  </p>
                </div>
                {failed && <button type="button" onClick={() => onRetryFile(f)} style={{ ...styles.chipBtn, padding: '0.25rem 0.6rem', fontSize: '0.74rem', borderColor: c.border, color: c.text }}>Retry</button>}
                <button type="button" onClick={() => onDeleteFile(f)} aria-label="Remove file" style={{ background: 'none', border: 'none', color: c.subtext, cursor: 'pointer', fontSize: '0.9rem', padding: '0.2rem' }}>✕</button>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ ...card, marginTop: '0.8rem' }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem' }}>Study this project</p>
        <p style={{ margin: '0.3rem 0 0', fontSize: '0.78rem', color: c.subtext }}>
          {readyCount === 0 ? 'Available once at least one file shows Ready. You can also just type a question below.' : 'Or type any question below. RADIUS answers from your files.'}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginTop: '0.6rem' }}>
          <button type="button" disabled={readyCount === 0} onClick={() => { onClose?.(); onSummary() }} style={{ ...styles.chipBtn, borderColor: c.border, color: c.text, opacity: readyCount === 0 ? 0.45 : 1 }}>Summarize project</button>
          <button type="button" disabled={readyCount === 0} onClick={() => { onClose?.(); onQuiz() }} style={{ ...styles.chipBtn, borderColor: c.border, color: c.text, opacity: readyCount === 0 ? 0.45 : 1 }}>Quiz on everything</button>
          <button type="button" disabled={readyCount === 0} onClick={() => { onClose?.(); onLikely() }} style={{ ...styles.chipBtn, borderColor: c.border, color: c.text, opacity: readyCount === 0 ? 0.45 : 1 }}>Likely exam questions</button>
        </div>
      </div>

      <button type="button" onClick={onDeleteProject} style={{ display: 'block', margin: '0.9rem auto 0', background: 'none', border: 'none', color: '#ef4444', fontSize: '0.8rem', cursor: 'pointer' }}>
        Delete this project
      </button>
    </div>
  )
}

// ---- Study Library --------------------------------------------------------------
export function LibraryScreen({ theme, accentColor, projects, onBack, onToast }) {
  const c = getPalette(theme, accentColor)
  const [items, setItems] = useState(null)
  const [filter, setFilter] = useState('all')
  const [openId, setOpenId] = useState(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('study_library')
        .select('id, kind, title, content, data, project_id, created_at')
        .order('created_at', { ascending: false })
        .limit(200)
      if (cancelled) return
      if (error) setLoadError('Could not load your library. Has the latest database update been run?')
      else setItems(data || [])
    })()
    return () => { cancelled = true }
  }, [])

  const removeItem = async (item) => {
    if (!window.confirm('Remove this from your library?')) return
    setItems((prev) => (prev || []).filter((i) => i.id !== item.id))
    setOpenId(null)
    await supabase.from('study_library').delete().eq('id', item.id)
  }

  const filters = [['all', 'All'], ['quiz', 'Quizzes'], ['summary', 'Summaries'], ['solution', 'Solutions'], ['explain', 'Explanations'], ['hint', 'Hints'], ['note', 'Notes']]
  const shown = (items || []).filter((i) => filter === 'all' || i.kind === filter)
  const open = (items || []).find((i) => i.id === openId)
  const projectName = (id) => (projects || []).find((p) => p.id === id)?.name

  return (
    <div style={{ ...styles.settingsContainer, backgroundColor: c.bg, backgroundImage: c.bgGlow, color: c.text }}>
      <div style={styles.topBar}>
        <button onClick={open ? () => setOpenId(null) : onBack} style={styles.iconBtn}><BackIcon color={c.text} /></button>
        <span className="radius-display" style={{ fontWeight: 700, fontSize: '1.1rem' }}>{open ? KIND_LABELS[open.kind] || 'Saved' : 'Study Library'}</span>
        <div style={{ width: '22px' }} />
      </div>

      {open ? (
        <div>
          <p style={{ margin: '0 0 0.2rem', fontWeight: 800, fontSize: '1.05rem' }}>{open.title}</p>
          <p style={{ margin: '0 0 0.8rem', fontSize: '0.76rem', color: c.subtext }}>
            {new Date(open.created_at).toLocaleDateString()}{open.project_id && projectName(open.project_id) ? ` · ${projectName(open.project_id)}` : ''}
          </p>
          {open.data && <div style={{ display: 'flex', justifyContent: 'center' }}><StudyDeck deck={open.data} c={c} /></div>}
          {open.content && (
            <div style={{ padding: '0.9rem 1rem', borderRadius: '16px', border: `1px solid ${c.border}`, backgroundColor: c.surface }}>
              <MarkdownBlock text={open.content} c={c} />
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.9rem' }}>
            {open.content && (
              <button type="button" onClick={() => { navigator.clipboard?.writeText(open.content); onToast('Copied') }} style={{ ...styles.chipBtn, borderColor: c.border, color: c.text }}>Copy</button>
            )}
            <button type="button" onClick={() => removeItem(open)} style={{ ...styles.chipBtn, borderColor: '#ef4444', color: '#ef4444' }}>Remove</button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.6rem' }}>
            {filters.map(([v, l]) => (
              <button key={v} type="button" onClick={() => setFilter(v)} style={{ ...styles.modeBtn, flexShrink: 0, whiteSpace: 'nowrap', backgroundColor: filter === v ? c.accent : 'transparent', backgroundImage: filter === v ? c.accentGrad : 'none', color: filter === v ? c.accentText : c.subtext, borderColor: c.border }}>{l}</button>
            ))}
          </div>
          {loadError && <p style={{ color: 'var(--warn, #fbbf24)', fontSize: '0.85rem' }}>{loadError}</p>}
          {items === null && !loadError && <p style={{ color: c.subtext, fontSize: '0.85rem' }}>Loading...</p>}
          {items !== null && shown.length === 0 && (
            <p style={{ color: c.subtext, fontSize: '0.88rem', textAlign: 'center', marginTop: '2rem' }}>
              {items.length === 0 ? 'Nothing saved yet. Tap Save to Library on a quiz, summary, hint, solution or any reply.' : 'Nothing in this filter.'}
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {shown.map((item) => (
              <div key={item.id} onClick={() => setOpenId(item.id)} style={{ padding: '0.8rem 0.95rem', borderRadius: '16px', border: `1px solid ${c.border}`, backgroundColor: c.surface, cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.66rem', fontWeight: 800, padding: '2px 8px', borderRadius: '10px', backgroundColor: c.accentSoft, color: c.accent }}>{KIND_LABELS[item.kind] || 'Note'}</span>
                  <span style={{ fontSize: '0.72rem', color: c.subtext }}>{new Date(item.created_at).toLocaleDateString()}</span>
                  {item.project_id && projectName(item.project_id) && <span style={{ fontSize: '0.72rem', color: c.subtext, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>· {projectName(item.project_id)}</span>}
                </div>
                <p style={{ margin: '0.4rem 0 0', fontWeight: 700, fontSize: '0.92rem' }}>{item.title}</p>
                {item.content && (
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: c.subtext, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {item.content.replace(/[#*_`>|$\\]/g, '').replace(/\s+/g, ' ').slice(0, 160)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
