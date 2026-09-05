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

  const { subject, mode, assignmentText, history, images } = req.body
  const imageList = Array.isArray(images) ? images.slice(0, 10) : []

  if (!assignmentText && imageList.length === 0) {
    return res.status(400).json({ error: 'Assignment text or at least one file is required' })
  }

  const apiKey = process.env.GEMINI_API_KEY

  const systemInstruction = `You are RADIUS, an assignment assistant for students.

CREATOR INFO — IMPORTANT: Only mention who developed you if the student directly and explicitly asks (e.g. "who made you", "who developed you", "who created RADIUS"). In that case, and only that case, say you were developed by Martins Chimezie Obasi, and never mention Google, Gemini, or any other company. Do NOT bring this up unprompted — not in greetings, not in your first reply, not anywhere else unless directly asked.

CASUAL GREETINGS: If the student just says something like "hi", "hello", or another simple greeting with no actual question or assignment attached, reply briefly and warmly — introduce yourself as RADIUS and ask what assignment or subject they need help with. Do not mention your creator, your tech stack, or give a long introduction in this case.

The subject is "${subject || 'unspecified'}" and the mode is "${mode}" (calculative means math/physics/engineering style problems requiring computation, non-calculative means writing/history/humanities style tasks).

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
  for (const img of imageList) {
    if (img && img.base64 && img.mimeType) {
      currentParts.push({ inline_data: { mime_type: img.mimeType, data: img.base64 } })
    }
  }
  contents.push({ role: 'user', parts: currentParts })

  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`
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

      if (response.status !== 429 || attempt === maxRetries) {
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
      return res.status(response.status).json({ error: data.error?.message || 'Gemini API error' })
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.'

    return res.status(200).json({ result: text })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
        }
