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
## Flashcards (up to 10, each as **Q:** question then **A:** answer)
## Practice Quiz (5 questions of mixed types, answers NOT shown)
## Answers (answers to the quiz with a one-line reason each)
Only use facts supported by the notes or standard accepted knowledge of the subject. If something in the notes looks wrong or unclear, list it under a short "## Check These" heading at the end. Use [TYPE:ASSIGNMENT] for the tag.`
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

  const currentParts = []
  if (assignmentText) currentParts.push({ text: assignmentText })

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
      attempts.push({ label: `gemini:${model}`, retryOnBusy: true, run: () => tryGemini(model) })
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
        return res.status(429).json({ error: 'RADIUS is getting a lot of requests right now. Please wait a few seconds and try again.' })
      }
      if (sawOverload) {
        return res.status(503).json({ error: 'RADIUS is briefly overloaded. Please try again in a few seconds.' })
      }
      // Never leak the raw upstream error message to the user. Full detail
      // is in the Vercel logs above.
      return res.status(500).json({ error: "Something went wrong on RADIUS's end. Please try again." })
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

    return res.status(200).json({ result: text, responseType })
  } catch (err) {
    console.error('generate.js error:', err)
    return res.status(500).json({ error: "Something went wrong on RADIUS's end. Please try again." })
  }
}
