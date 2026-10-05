import { createClient } from '@supabase/supabase-js'

// Reads one uploaded Project file (PDF or image) with Gemini and stores the
// extracted study text on its project_files row. RADIUS later uses that text
// to answer questions, make quizzes and summaries for the project.

const supabaseAuth = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

// Each Gemini model has its own separate quota, so gemini-3.8 is an extra
// safety net when both Flash models are rate limited or busy. (The 2.5
// models are closed to new users, so they are not used.)
const GEMINI_MODELS = ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.8']
const MAX_FILE_BYTES = 12 * 1024 * 1024
const MAX_TEXT_CHARS = 400000

const EXTRACT_PROMPT = `You are reading a student's study material (lecture notes, slides, a textbook page, handwritten notes or a worksheet). Extract ALL of its study content as clean markdown so the student can later study from your text instead of the file.

Rules:
- Be faithful. Keep every heading, definition, formula, number, unit, table, list, worked example and exam tip. Do NOT summarise, shorten or add facts that are not in the file.
- Write formulas in LaTeX wrapped in $$ ... $$ (display) or $ ... $ (inline).
- Turn tables into markdown tables.
- Describe a diagram or graph in one line like [Diagram: what it shows and its labels].
- If handwriting or a photo part is unclear, give your best reading and mark it [unclear].
- Keep the original order. No introduction and no closing remarks. Output only the extracted content.`

async function callGemini(model, parts) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: model.startsWith('gemini-3')
          ? { thinkingConfig: { thinkingLevel: 'low' }, maxOutputTokens: 16000 }
          : { maxOutputTokens: 16000 },
      }),
      signal: AbortSignal.timeout(50000),
    }
  )
  const data = await response.json().catch(() => null)
  if (!response.ok) return { ok: false, status: response.status, detail: data?.error?.message }
  const cand = data?.candidates?.[0]
  const text = (cand?.content?.parts || [])
    .filter((p) => typeof p.text === 'string' && !p.thought)
    .map((p) => p.text)
    .join('')
  if (!text.trim()) return { ok: false, status: 502, detail: 'empty reply' }
  return { ok: true, text, truncated: cand?.finishReason === 'MAX_TOKENS' }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Missing authorization token' })
  if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY || !process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Server misconfiguration' })
  }

  const { data: userData, error: authError } = await supabaseAuth.auth.getUser(token)
  if (authError || !userData?.user) return res.status(401).json({ error: 'Invalid or expired session' })

  const fileId = req.body && req.body.fileId
  if (typeof fileId !== 'string' || !/^[0-9a-f-]{36}$/i.test(fileId)) {
    return res.status(400).json({ error: 'A valid fileId is required' })
  }

  // Scoped to the caller's own JWT, so row-level security guarantees the file
  // really belongs to them.
  const db = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data: row, error: rowError } = await db
    .from('project_files')
    .select('id, name, mime_type, storage_path')
    .eq('id', fileId)
    .maybeSingle()
  if (rowError || !row) return res.status(404).json({ error: 'File not found' })
  if (!row.storage_path) return res.status(400).json({ error: 'This file has nothing to read' })

  const fail = async (message) => {
    await db.from('project_files').update({ status: 'failed', error: message }).eq('id', fileId)
    return res.status(502).json({ error: message })
  }

  try {
    await db.from('project_files').update({ status: 'processing', error: null }).eq('id', fileId)

    const { data: signed, error: signError } = await db.storage
      .from('assignment-images')
      .createSignedUrl(row.storage_path, 300)
    if (signError || !signed?.signedUrl) return await fail('Could not open the uploaded file.')

    const fileRes = await fetch(signed.signedUrl)
    if (!fileRes.ok) return await fail('Could not download the uploaded file.')
    const buffer = Buffer.from(await fileRes.arrayBuffer())
    if (buffer.length > MAX_FILE_BYTES) return await fail('This file is too large to read (limit 12 MB).')

    const parts = [
      { text: EXTRACT_PROMPT },
      { inline_data: { mime_type: row.mime_type || 'application/pdf', data: buffer.toString('base64') } },
    ]

    let result = null
    let sawBusy = false
    let otherDetail = ''
    const trace = []
    for (const model of GEMINI_MODELS) {
      for (let attempt = 0; attempt < 2 && !result; attempt++) {
        let r
        try {
          r = await callGemini(model, parts)
        } catch (e) {
          console.error(`project-extract ${model} threw:`, e?.message)
          trace.push(`${model.replace('gemini-', '')}:error`)
          if (!otherDetail) otherDetail = String(e?.message || 'request failed').slice(0, 120)
          break
        }
        if (r.ok) { result = r; break }
        trace.push(`${model.replace('gemini-', '')}:${r.status}`)
        if (r.status === 429 || r.status === 503) sawBusy = true
        else if (!otherDetail) otherDetail = String(r.detail || r.status).slice(0, 120)
        console.error(`project-extract ${model} failed:`, r.status, r.detail)
        if ((r.status === 429 || r.status === 503) && attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 2500))
          continue
        }
        break
      }
      if (result) break
    }

    if (!result) {
      // The short code list at the end is a temporary diagnostic so a
      // screenshot of the error shows exactly which model said what.
      const codes = ` (${trace.join(' ')}${otherDetail ? ' - ' + otherDetail : ''})`
      return await fail(
        (sawBusy
          ? 'RADIUS is busy right now. Tap Retry in a minute.'
          : 'RADIUS could not read this file. Try a clearer photo or a PDF.') + codes
      )
    }

    let text = result.text.trim().slice(0, MAX_TEXT_CHARS)
    if (text.length < 20) return await fail('Nothing readable was found in this file.')
    if (result.truncated) text += '\n\n[Note: this file is long, so only the first part could be read.]'

    const { error: updateError } = await db
      .from('project_files')
      .update({ extracted_text: text, char_count: text.length, status: 'ready', error: null })
      .eq('id', fileId)
    if (updateError) {
      console.error('project-extract save failed:', updateError.message)
      return await fail('Could not save the extracted text.')
    }

    return res.status(200).json({ ok: true, chars: text.length, partial: !!result.truncated })
  } catch (e) {
    console.error('project-extract error:', e?.message)
    return await fail('Something went wrong while reading this file.')
  }
}
