import { createClient } from '@supabase/supabase-js'

// Uses the anon/publishable key — same key already used successfully by the
// frontend for login — just to verify the incoming JWT belongs to a real,
// logged-in user. This does not bypass RLS and does not need the secret key.
const supabaseAuth = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

// ---------------------------------------------------------------------------
// Provider fallback chain
// Gemini is tried first (it is the only one here that reads images/PDFs).
// If it is rate limited, overloaded or errors, the request automatically goes
// to the next provider below. A provider is only used if its API key env var
// is set in Vercel, so missing keys never break anything. Model names can be
// changed from Vercel env vars without touching code.
// ---------------------------------------------------------------------------
const OPENAI_COMPAT_PROVIDERS = [
  { name: 'groq', url: 'https://api.groq.com/openai/v1/chat/completions', keyEnv: 'GROQ_API_KEY', model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile' },
  { name: 'mistral', url: 'https://api.mistral.ai/v1/chat/completions', keyEnv: 'MISTRAL_API_KEY', model: process.env.MISTRAL_MODEL || 'mistral-small-latest' },
  { name: 'cerebras', url: 'https://api.cerebras.ai/v1/chat/completions', keyEnv: 'CEREBRAS_API_KEY', model: process.env.CEREBRAS_MODEL || 'llama-3.3-70b' },
  { name: 'openrouter', url: 'https://openrouter.ai/api/v1/chat/completions', keyEnv: 'OPENROUTER_API_KEY', model: process.env.OPENROUTER_MODEL || 'openrouter/free' },
]

// ---------------------------------------------------------------------------
// Study tools. 'chat' is the normal assignment assistant behaviour.
// ---------------------------------------------------------------------------
const VALID_TOOLS = ['chat', 'notes', 'pastq', 'cite', 'plan']

function toolInstruction(tool, todayText) {
  switch (tool) {
    case 'notes':
      return `TOOL: STUDY PACK. The student gives lecture notes (typed, pasted, or photographed). Reply using these markdown headings in this order:
## Clean Notes (organised with sub-headings, errors corrected)
## Key Terms (term: one-line meaning)
## Check These (only if something in the notes looks wrong or unclear; otherwise leave this heading out)
Do NOT write flashcards or quiz questions in the visible reply. Instead, end your reply with one block of strict JSON wrapped exactly like this, with no code fences and nothing after it:
<study_data>{"flashcards":[{"q":"question","a":"short answer"}],"quiz":[{"q":"question","options":["option text","option text","option text","option text"],"answer":0,"why":"one line reason"}]}</study_data>
Rules for the JSON: up to 8 flashcards; exactly 5 multiple choice quiz questions with 4 options each; "answer" is the zero-based index of the correct option; options are plain text without letters like A) or B); only use facts supported by the notes or standard accepted knowledge of the subject; the JSON must be valid. Use [TYPE:ASSIGNMENT] for the tag.`
    case 'pastq':
      return `TOOL: PAST QUESTION TRAINER. The student gives past exam questions (typed or attached) for a course.
First message with questions: reply with
## Topic Map (group the questions by topic and show how often each topic appears, most frequent first)
## Read First (a ranked reading order with one line on why)
## Practice Round (5 new exam-style questions on the top topics, answers NOT shown)
Then ask the student to reply with their answers.
When the student replies with answers: mark each one, briefly explain mistakes, then give "## Weak Topics" ranked with what to study next. Remember results across the conversation so weak topics build up over rounds. Use [TYPE:ASSIGNMENT] for the tag.`
    case 'cite':
      return `TOOL: CITATION FIXER. The student gives a source (URL, title, DOI, or raw details). Format it in the requested style (APA 7, Harvard, IEEE, MLA or Chicago). If no style is given, use APA 7 and say so in one short line. Give the reference list entry, then the in-text citation. NEVER invent authors, years, titles, publishers, or page numbers. If a detail is missing, put it in square brackets like [year] and list what the student should look up. Keep the reply short. Use [TYPE:GENERAL] for the tag.`
    case 'plan':
      return `TOOL: EXAM PLANNER. Today is ${todayText}. The student gives exam dates and topics, and maybe hours available per day. Build a day-by-day study plan from today up to the last exam: prioritise sooner exams and topics the student says are weak, include short revision slots and a rest buffer, and show it as a markdown table with columns Date, Focus, Hours. If details are missing, make sensible assumptions and state them in one line instead of asking many questions. If the student later says they missed days or things changed, rebuild only the remaining days. Use [TYPE:ASSIGNMENT] for the tag.`
    default:
      return ''
  }
}

// ---------------------------------------------------------------------------
// Live web search (Tavily). Gives every provider, including the free backup
// ones, access to recent information. Only runs for non-calculative chat
// messages that look like they need fresh facts, to save the monthly quota.
// Needs TAVILY_API_KEY in Vercel. Set SEARCH_ALWAYS=true to search every time.
// ---------------------------------------------------------------------------
const SEARCH_HINTS = /\b(latest|newest|current|currently|recent|recently|breaking|news|this (year|month|week)|right now|as of now|updates? (on|about|to)|releas(e|ed|es)|launch(ed|es)?|announce[sd]?|prices? (of|for)|how much (is|does|do)|version|202[4-9]|who is the|who won|champions?|president|prime minister|ceo of|trending|breakthrough|discover(y|ies)|iphone|galaxy|pixel|samsung|apple|openai|chatgpt|gpt|gemini|tesla|nvidia|playstation|xbox|bitcoin|crypto|ethereum|election|world cup|premier league|exchange rate)\b/i

async function webSearch(query) {
  const key = process.env.TAVILY_API_KEY
  if (!key) return []
  try {
    const r = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ query, search_depth: 'basic', max_results: 5 }),
      signal: AbortSignal.timeout(6000),
    })
    if (!r.ok) {
      console.error('Web search failed:', r.status)
      return []
    }
    const d = await r.json()
    return (Array.isArray(d.results) ? d.results : [])
      .filter((x) => x && x.url && x.content)
      .slice(0, 5)
      .map((x) => ({
        title: String(x.title || x.url).replace(/[\[\]]/g, '').slice(0, 120),
        url: x.url,
        content: String(x.content).slice(0, 500),
      }))
  } catch (e) {
    console.error('Web search error:', e?.message)
    return []
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Require a valid Supabase session — without this, anyone can call this
  // endpoint directly and burn the Gemini quota/budget.
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' })
  }

  if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
    console.error('Missing env vars:', {
      hasUrl: !!process.env.VITE_SUPABASE_URL,
      hasAnonKey: !!process.env.VITE_SUPABASE_ANON_KEY,
    })
    return res.status(500).json({ error: 'Server misconfiguration: missing Supabase env vars' })
  }

  const { data: userData, error: authError } = await supabaseAuth.auth.getUser(token)
  if (authError || !userData?.user) {
    console.error('Auth check failed:', authError?.message, authError?.status, authError)
    return res.status(401).json({ error: 'Invalid or expired session' })
  }

  // Per-user rate limit: 20 requests/hour, enforced atomically in Postgres via
  // the check_rate_limit() function (see the SQL migration for it). Scoped
  // with the user's own forwarded JWT (not a service-role key) so it only
  // ever touches that user's own row, same trust model as the auth check
  // above. Fails open if the function/table doesn't exist yet or errors for
  // any other reason - a missing migration shouldn't take the whole app down.
  const supabaseAsUser = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  const { data: rateLimitOk, error: rateLimitError } = await supabaseAsUser.rpc('check_rate_limit', {
    p_limit: 20,
    p_window_minutes: 60,
  })
  if (rateLimitError) {
    console.error('Rate limit check errored (failing open):', rateLimitError.message)
  } else if (rateLimitOk === false) {
    return res.status(429).json({ error: "You've hit the hourly limit for assignment requests. Please wait a bit and try again." })
  }

  const { subject, mode, assignmentText, history, images, nickname, responseStyle, tool: rawTool } = req.body
  const tool = VALID_TOOLS.includes(rawTool) ? rawTool : 'chat'
  // When true, the reply is sent back as newline-delimited JSON events so the
  // app can show the text as it is written. Old clients that don't send the
  // flag keep getting the normal single JSON response.
  const wantStream = req.body && req.body.stream === true
  const todayText = new Date().toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const imageList = Array.isArray(images) ? images.slice(0, 10) : []

  if (!assignmentText && imageList.length === 0) {
    return res.status(400).json({ error: 'Assignment text or at least one file is required' })
  }

  const apiKey = process.env.GEMINI_API_KEY

  // Sanitized to a short, plain string before it ever reaches the prompt -
  // it's free-form user input, so no instruction-like or oddly long values
  // get treated as part of the system prompt.
  const safeNickname = typeof nickname === 'string' ? nickname.trim().slice(0, 40) : ''
  const nicknameLine = safeNickname
    ? `The student's preferred name is "${safeNickname}". Address them by this name naturally every so often (e.g. in greetings or encouragement) - not in every single message, and never in a forced or repetitive way.`
    : ''

  const STYLE_HINTS = {
    concise: 'Keep answers tight. Lead with the key result, then the shortest correct explanation.',
    balanced: 'Give a clear explanation with the essential steps, without padding.',
    detailed: 'Give a thorough explanation, covering the reasoning behind each step and common mistakes.',
  }
  const styleLine = STYLE_HINTS[responseStyle] || STYLE_HINTS.balanced

  const modeLine = tool === 'chat'
    ? `The subject is "${subject || 'unspecified'}" and the mode is "${mode}" (calculative means math/physics/engineering style problems requiring computation, non-calculative means writing/history/humanities style tasks).`
    : `The subject is "${subject || 'unspecified'}". ${toolInstruction(tool, todayText)}`
  const closingLine = tool === 'chat'
    ? 'For non-calculative mode: give a clear, numbered, actionable breakdown (3-6 steps) covering research and structure. For calculative mode: break the problem down and solve it fully, showing every step.'
    : ''

  const systemInstruction = `You are RADIUS, an assignment assistant for students.

CREATOR INFO — IMPORTANT: Only mention who developed you if the student directly and explicitly asks (e.g. "who made you", "who developed you", "who created RADIUS"). In that case, and only that case, say you were developed by Martins Chimezie Obasi, and never mention Google, Gemini, or any other company. Do NOT bring this up unprompted — not in greetings, not in your first reply, not anywhere else unless directly asked.

${nicknameLine}

CASUAL GREETINGS: If the student just says something like "hi", "hello", or another simple greeting with no actual question or assignment attached, reply briefly and warmly — introduce yourself as RADIUS and ask what assignment or subject they need help with. Do not mention your creator, your tech stack, or give a long introduction in this case.

RESPONSE TAGGING — REQUIRED: As the very first thing in your reply, before any other text, output exactly one tag on its own with nothing else on that line:
[TYPE:ASSIGNMENT] if this message is a real academic/assignment/study question you are actually answering or working through.
[TYPE:GENERAL] if it is a greeting, small talk, feedback, or a question about RADIUS itself rather than an academic question.
Then continue your normal reply starting on the next line. Never explain or mention this tag to the student.

${modeLine}

Answer length preference: ${styleLine}

STRICT INSTRUCTION FOLLOWING:
- If the student specifies a word count, length, number of points, or any other explicit constraint, you MUST follow it exactly. Count before responding. Do not pad with filler or fall short.
- Answer precisely what was asked. Do not add unrequested sections or disclaimers.

MATH FORMATTING RULES (calculative mode):
- Write every equation using LaTeX, wrapped in double dollar signs for display equations, e.g. $$2x + 5 = 15$$
- Write fractions using \\frac{numerator}{denominator}, never as a slash like 2/5
- Solve step by step, showing each algebraic manipulation as its own LaTeX line
- Never describe math in plain prose when it can be shown as a formatted equation

TABLES: When the student asks for a table, a comparison, a schedule, or any tabulated data, output a valid GitHub-flavoured markdown table: one header row, then a separator row like | --- | --- |, then each data row on its own line, with exactly the same number of columns in every row. Put a blank line before and after the table. Keep cell text short with no line breaks inside cells, and write every row before any commentary. Use - for a value you do not know instead of guessing. Put your verdict or summary in one or two sentences after the table, never inside it.

CURRENT INFORMATION: Today's date is ${todayText}. Your built-in knowledge stops at an earlier date, so newer products, events, releases, prices, rules and research may exist that you do not know about. Never tell the student that something does not exist, has not been released, or has not happened just because you do not recognise it. If a WEB SEARCH RESULTS block is included in the student's message, treat it as newer than your training and base your answer on it, referring to a result as [1], [2] and so on only when you actually used it, and never mentioning the search at all when it was not relevant to what the student said. If it does not answer the question, say so. If there are no search results, say you cannot confirm the very latest details and give your best understanding without denying anything. Never present rumours or guesses as confirmed facts, and never describe a past year as the present.

IMAGES: If the student attaches images or files, they may contain handwritten or printed assignments, problems, or questions — possibly spanning multiple pages or multiple related items. Read all of them carefully and respond to what they actually contain, treating them as one combined assignment unless they clearly look unrelated.

${closingLine}`

  const contents = []

  if (Array.isArray(history)) {
    for (const turn of history) {
      contents.push({
        role: turn.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: turn.content }],
      })
    }
  }

  // ---- Optional live web search (see top of file) ----
  let searchResults = []
  const searchEligible =
    tool === 'chat' &&
    mode !== 'calculative' &&
    typeof assignmentText === 'string' &&
    assignmentText.trim().length > 3
  if (searchEligible) {
    // Judge the student's own words only, not the quoted message they replied to.
    const q = assignmentText.replace(/^\[The student is replying to [\s\S]*?"\]\s*/i, '').trim().slice(0, 300)
    const casual = q.length < 15 || (/^(ok|okay|alright|thanks|thank you|thx|hello|hi|hey|sure|yes|yeah|no|cool|great|nice|good)\b/i.test(q) && !q.includes('?'))
    if (q && !casual && (process.env.SEARCH_ALWAYS === 'true' || SEARCH_HINTS.test(q))) {
      searchResults = await webSearch(q)
    }
  }
  const searchBlock = searchResults.length
    ? `\n\n[WEB SEARCH RESULTS fetched just now (today is ${todayText}). They are newer than your training data. Base your answer on them for anything recent, refer to them as [1], [2] and so on when you use them, and if they do not answer the question, say so instead of guessing.]\n` +
      searchResults.map((r, i) => `[${i + 1}] ${r.title} (${r.url})\n${r.content}`).join('\n\n')
    : ''

  const currentParts = []
  if (assignmentText) currentParts.push({ text: assignmentText + searchBlock })

  // Files are fetched server-side from their (already-uploaded) Supabase signed
  // URL rather than shipped as base64 in the request body. Vercel serverless
  // functions hard-cap the incoming request body at 4.5MB — a base64-encoded
  // PDF blows past that in one message and the whole request used to fail.
  // Fetching server-to-server here has no such limit, and doing it in
  // parallel keeps this from adding noticeable latency.
  const fetchedParts = await Promise.all(
    imageList.map(async (img) => {
      if (!img || !img.url || !img.mimeType) return null
      try {
        const fileRes = await fetch(img.url)
        if (!fileRes.ok) return null
        const arrayBuffer = await fileRes.arrayBuffer()
        const base64 = Buffer.from(arrayBuffer).toString('base64')
        return { inline_data: { mime_type: img.mimeType, data: base64 } }
      } catch (e) {
        return null
      }
    })
  )
  currentParts.push(...fetchedParts.filter(Boolean))
  contents.push({ role: 'user', parts: currentParts })

  // ---- Build the list of providers to try, in order ----
  const hasFiles = currentParts.some((p) => p.inline_data)
  const geminiKey = process.env.GEMINI_API_KEY
  const GEMINI_MODELS = ['gemini-3.7-flash', 'gemini-3.6-flash']

  const geminiBody = JSON.stringify({
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents,
    // Gemini 3 defaults to HIGH thinking when this is unset, which adds
    // several seconds per reply. 'minimal' was rejected by the API and broke
    // non-calculative mode, so 'low' is used everywhere.
    generationConfig: {
      thinkingConfig: { thinkingLevel: 'low' },
      maxOutputTokens: 4096,
    },
  })

  // Plain text version of the conversation for the non-Gemini providers.
  const chatMessages = [
    { role: 'system', content: systemInstruction },
    ...contents.map((c) => ({
      role: c.role === 'model' ? 'assistant' : 'user',
      content: c.parts.filter((p) => p.text).map((p) => p.text).join('\n'),
    })),
  ]

  async function tryGemini(model) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: geminiBody,
        signal: AbortSignal.timeout(25000),
      }
    )
    const data = await response.json().catch(() => null)
    if (!response.ok) {
      return { ok: false, status: response.status, detail: data?.error?.message }
    }
    const parts = data?.candidates?.[0]?.content?.parts || []
    const text = parts.filter((p) => typeof p.text === 'string' && !p.thought).map((p) => p.text).join('')
    return text ? { ok: true, text } : { ok: false, status: 502, detail: 'empty reply' }
  }

  // ---- Streaming plumbing (only used when the app asks for stream: true) ----
  let streamStarted = false
  let needsReset = false

  function startStream() {
    if (streamStarted) return
    streamStarted = true
    res.status(200)
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('X-Accel-Buffering', 'no')
    if (typeof res.flushHeaders === 'function') res.flushHeaders()
  }

  function emit(obj) {
    startStream()
    res.write(JSON.stringify(obj) + '\n')
  }

  // Sends an error in the right shape: as a normal HTTP error if nothing has
  // been streamed yet, or as a final stream event if text is already flowing.
  function fail(status, message) {
    if (streamStarted) {
      emit({ t: 'error', error: message })
      return res.end()
    }
    return res.status(status).json({ error: message })
  }

  async function tryGeminiStream(model) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: geminiBody,
        signal: AbortSignal.timeout(25000),
      }
    )
    if (!response.ok) {
      const data = await response.json().catch(() => null)
      return { ok: false, status: response.status, detail: data?.error?.message }
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let full = ''
    let sentDelta = false

    const handleLine = (line) => {
      if (!line.startsWith('data:')) return
      const payload = line.slice(5).trim()
      if (!payload || payload === '[DONE]') return
      let json
      try { json = JSON.parse(payload) } catch (e) { return }
      const parts = json?.candidates?.[0]?.content?.parts || []
      const piece = parts.filter((p) => typeof p.text === 'string' && !p.thought).map((p) => p.text).join('')
      if (piece) {
        full += piece
        sentDelta = true
        emit({ t: 'delta', text: piece })
      }
    }

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()
        for (const line of lines) handleLine(line.trim())
      }
      if (buffer.trim()) handleLine(buffer.trim())
    } catch (e) {
      if (sentDelta) needsReset = true
      return { ok: false, status: 502, detail: 'stream interrupted: ' + (e?.message || '') }
    }

    if (!full) return { ok: false, status: 502, detail: 'empty reply' }
    return { ok: true, text: full }
  }

  async function tryCompat(provider) {
    const response = await fetch(provider.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env[provider.keyEnv]}`,
      },
      body: JSON.stringify({
        model: provider.model,
        messages: chatMessages,
        max_tokens: 4096,
      }),
      signal: AbortSignal.timeout(20000),
    })
    const data = await response.json().catch(() => null)
    if (!response.ok) {
      return { ok: false, status: response.status, detail: data?.error?.message }
    }
    const text = data?.choices?.[0]?.message?.content
    return text ? { ok: true, text } : { ok: false, status: 502, detail: 'empty reply' }
  }

  const attempts = []
  if (geminiKey) {
    for (const model of GEMINI_MODELS) {
      attempts.push({ label: `gemini:${model}`, retryOnBusy: true, run: () => (wantStream ? tryGeminiStream(model) : tryGemini(model)) })
    }
  }
  // Other providers only take text. If the message has images/PDFs, only
  // Gemini can read them, so the fallback chain is skipped for those.
  if (!hasFiles) {
    for (const provider of OPENAI_COMPAT_PROVIDERS) {
      if (process.env[provider.keyEnv]) {
        attempts.push({ label: `${provider.name}:${provider.model}`, retryOnBusy: false, run: () => tryCompat(provider) })
      }
    }
  }

  try {
    let text = null
    let sawRateLimit = false
    let sawOverload = false

    for (const attempt of attempts) {
      const maxTries = attempt.retryOnBusy ? 2 : 1
      for (let i = 0; i < maxTries && text === null; i++) {
        let result
        try {
          if (wantStream && needsReset) {
            emit({ t: 'reset' })
            needsReset = false
          }
          result = await attempt.run()
        } catch (e) {
          console.error(`Provider ${attempt.label} threw:`, e?.message)
          break
        }
        if (result.ok) {
          text = result.text
          console.log(`Reply served by ${attempt.label}`)
          break
        }
        console.error(`Provider ${attempt.label} failed:`, result.status, result.detail)
        if (result.status === 429) sawRateLimit = true
        if (result.status === 503) sawOverload = true
        const busy = result.status === 429 || result.status === 503
        if (busy && i < maxTries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500))
          continue
        }
        break
      }
      if (text !== null) break
    }

    if (text === null) {
      if (sawRateLimit) {
        return fail(429, 'RADIUS is getting a lot of requests right now. Please wait a few seconds and try again.')
      }
      if (sawOverload) {
        return fail(503, 'RADIUS is briefly overloaded. Please try again in a few seconds.')
      }
      // Never leak the raw upstream error message to the user. Full detail
      // is in the Vercel logs above.
      return fail(500, "Something went wrong on RADIUS's end. Please try again.")
    }

    // Strip the required leading type tag and use it to decide whether the
    // frontend should show assignment follow-up actions (hint/quiz/etc).
    // Defaults to 'general' (no chips) if the model ever forgets the tag.
    let responseType = 'general'
    const tagMatch = text.match(/^\s*\[TYPE:(ASSIGNMENT|GENERAL)\]\s*/i)
    if (tagMatch) {
      responseType = tagMatch[1].toLowerCase()
      text = text.slice(tagMatch[0].length)
    }

    // Study Pack: pull the structured flashcards/quiz out of the reply and
    // attach them as a hidden marker the app turns into interactive cards.
    if (tool === 'notes') {
      const idx = text.indexOf('<study_data>')
      if (idx !== -1) {
        const raw = text
          .slice(idx + '<study_data>'.length)
          .replace(/<\/study_data>[\s\S]*$/i, '')
          .replace(/```json|```/g, '')
          .trim()
        text = text.slice(0, idx).trim()
        let deck = null
        try {
          const parsed = JSON.parse(raw)
          const flashcards = (Array.isArray(parsed.flashcards) ? parsed.flashcards : [])
            .filter((c) => c && typeof c.q === 'string' && typeof c.a === 'string')
            .slice(0, 12)
          const quiz = (Array.isArray(parsed.quiz) ? parsed.quiz : [])
            .filter((q) => q && typeof q.q === 'string' && Array.isArray(q.options) && q.options.length >= 2 && Number.isInteger(Number(q.answer)) && Number(q.answer) >= 0 && Number(q.answer) < q.options.length)
            .slice(0, 8)
            .map((q) => ({ q: q.q, options: q.options.map(String), answer: Number(q.answer), why: typeof q.why === 'string' ? q.why : '' }))
          if (flashcards.length || quiz.length) deck = { flashcards, quiz }
        } catch (e) {
          console.error('Study data parse failed:', e?.message)
        }
        if (deck) {
          text += `\n\n<!--STUDY:${encodeURIComponent(JSON.stringify(deck))}-->`
        } else {
          text += '\n\n_Flashcards and quiz could not be generated this time. Send your notes again to retry._'
        }
      } else {
        text += '\n\n_Flashcards and quiz could not be generated this time. Send your notes again to retry._'
      }
    }

    // Only show sources the answer actually used (cited as [1], [2]...). They
    // go out as a hidden marker; the app shows them as small site logos.
    if (searchResults.length) {
      const used = new Set()
      for (const m of text.matchAll(/\[(\d{1,2})\]/g)) {
        const n = Number(m[1])
        if (n >= 1 && n <= searchResults.length) used.add(n - 1)
      }
      const list = Array.from(used).sort((a, b) => a - b).slice(0, 5).map((i) => ({ u: searchResults[i].url, t: searchResults[i].title }))
      if (list.length) text += `\n\n<!--SRC:${encodeURIComponent(JSON.stringify(list))}-->`
    }

    if (wantStream) {
      // The final event carries the fully cleaned text (tag stripped, study
      // cards attached) and replaces whatever was streamed so far.
      emit({ t: 'done', result: text, responseType })
      return res.end()
    }
    return res.status(200).json({ result: text, responseType })
  } catch (err) {
    console.error('generate.js error:', err)
    return fail(500, "Something went wrong on RADIUS's end. Please try again.")
  }
}
