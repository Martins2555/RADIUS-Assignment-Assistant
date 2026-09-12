import { createClient } from '@supabase/supabase-js'

// Uses the anon/publishable key — same key already used successfully by the
// frontend for login — just to verify the incoming JWT belongs to a real,
// logged-in user. This does not bypass RLS and does not need the secret key.
const supabaseAuth = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

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

  const { subject, mode, assignmentText, history, images, nickname, responseStyle } = req.body
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

  const systemInstruction = `You are RADIUS, an assignment assistant for students.

CREATOR INFO — IMPORTANT: Only mention who developed you if the student directly and explicitly asks (e.g. "who made you", "who developed you", "who created RADIUS"). In that case, and only that case, say you were developed by Martins Chimezie Obasi, and never mention Google, Gemini, or any other company. Do NOT bring this up unprompted — not in greetings, not in your first reply, not anywhere else unless directly asked.

${nicknameLine}

CASUAL GREETINGS: If the student just says something like "hi", "hello", or another simple greeting with no actual question or assignment attached, reply briefly and warmly — introduce yourself as RADIUS and ask what assignment or subject they need help with. Do not mention your creator, your tech stack, or give a long introduction in this case.

RESPONSE TAGGING — REQUIRED: As the very first thing in your reply, before any other text, output exactly one tag on its own with nothing else on that line:
[TYPE:ASSIGNMENT] if this message is a real academic/assignment/study question you are actually answering or working through.
[TYPE:GENERAL] if it is a greeting, small talk, feedback, or a question about RADIUS itself rather than an academic question.
Then continue your normal reply starting on the next line. Never explain or mention this tag to the student.

The subject is "${subject || 'unspecified'}" and the mode is "${mode}" (calculative means math/physics/engineering style problems requiring computation, non-calculative means writing/history/humanities style tasks).

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

For non-calculative mode: give a clear, numbered, actionable breakdown (3-6 steps) covering research and structure. For calculative mode: break the problem down and solve it fully, showing every step.`

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

  // gemini-3.6-flash is a preview-tier model with tighter rate limits per
  // Google's own docs - 3.7 Flash is the generally-available successor in the
  // same family and should relieve the 429 pressure seen earlier.
  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=${apiKey}`
  const requestBody = JSON.stringify({
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents,
  })

  async function callGeminiWithRetry(maxRetries = 2) {
    let lastResponse, lastData
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
      })
      const data = await response.json()

      // 503 = model temporarily overloaded on Google's end - just as worth
      // retrying with backoff as 429 (rate limited). Both are transient.
      const isRetryable = response.status === 429 || response.status === 503
      if (!isRetryable || attempt === maxRetries) {
        return { response, data }
      }

      lastResponse = response
      lastData = data
      // Brief backoff before retrying: 1s, then 2s
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)))
    }
    return { response: lastResponse, data: lastData }
  }

  try {
    const { response, data } = await callGeminiWithRetry()

    if (!response.ok) {
      if (response.status === 429) {
        return res.status(429).json({ error: 'RADIUS is getting a lot of requests right now. Please wait a few seconds and try again.' })
      }
      if (response.status === 503) {
        return res.status(503).json({ error: 'RADIUS is briefly overloaded. Please try again in a few seconds.' })
      }
      // Never leak the raw upstream error message to the user - it can be
      // oddly specific/internal-sounding. Full detail still goes to the
      // Vercel logs for debugging.
      console.error('Gemini API error:', response.status, data?.error?.message)
      return res.status(response.status).json({ error: "Something went wrong on RADIUS's end. Please try again." })
    }

    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.'

    // Strip the required leading type tag and use it to decide whether the
    // frontend should show assignment follow-up actions (hint/quiz/etc).
    // Defaults to 'general' (no chips) if the model ever forgets the tag -
    // the safer failure mode is chips missing, not chips showing wrongly.
    let responseType = 'general'
    const tagMatch = text.match(/^\s*\[TYPE:(ASSIGNMENT|GENERAL)\]\s*/i)
    if (tagMatch) {
      responseType = tagMatch[1].toLowerCase()
      text = text.slice(tagMatch[0].length)
    }

    return res.status(200).json({ result: text, responseType })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
