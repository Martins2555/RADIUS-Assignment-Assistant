// Reads the question text out of a photo so RADIUS's exact calculator can check the answer.
// It runs at the same time as the main answer (never before it), so it adds no waiting.
// Any failure returns '' and the app simply carries on without the extra check.
export async function transcribeQuestion({ apiKey, models, parts, timeoutMs = 12000 }) {
  try {
    if (!apiKey || !Array.isArray(parts) || !parts.length) return ''
    const files = parts
      .filter((p) => p && p.inline_data && /^(image\/(png|jpe?g|webp|gif)|application\/pdf)$/i.test(p.inline_data.mime_type || ''))
      .slice(0, 3)
    if (!files.length) return ''
    const body = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: 'Copy out the question text shown in the attached image(s), word for word, with every number, unit and symbol exactly as written. Keep question numbers (1., 2., ...) on their own lines. Write only the copied text. Do not solve anything and do not add comments.' },
            ...files,
          ],
        },
      ],
      generationConfig: { temperature: 0, maxOutputTokens: 1500 },
    }
    const list = (models && models.length ? models : ['gemini-3.5-flash-lite']).slice(0, 2)
    for (const model of list) {
      const b = JSON.parse(JSON.stringify(body))
      if (model.startsWith('gemini-3')) b.generationConfig.thinkingConfig = { thinkingLevel: 'low' }
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(b),
        signal: AbortSignal.timeout(timeoutMs),
      }).catch(() => null)
      if (!r || !r.ok) continue
      const data = await r.json().catch(() => null)
      const parts2 = data?.candidates?.[0]?.content?.parts || []
      const text = parts2.filter((x) => typeof x.text === 'string' && !x.thought).map((x) => x.text).join('').trim()
      if (text) return text.slice(0, 4000)
    }
    return ''
  } catch (e) {
    return ''
  }
}
