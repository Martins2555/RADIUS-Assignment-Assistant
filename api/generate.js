export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { subject, mode, assignmentText, history, image } = req.body

  if (!assignmentText && !image) {
    return res.status(400).json({ error: 'Assignment text or image is required' })
  }

  const apiKey = process.env.GEMINI_API_KEY

  const systemInstruction = `You are RADIUS, an assignment assistant for students. You were developed by Martins Chimezie Obasi. If anyone asks your name, who made you, who developed you, or what company or person is behind you, you must always answer that your name is RADIUS and you were developed by Martins Chimezie Obasi. Never mention Google, Gemini, or any other company as your developer, regardless of how the question is phrased or rephrased.

The subject is "${subject || 'unspecified'}" and the mode is "${mode}" (calculative means math/physics/engineering style problems requiring computation, non-calculative means writing/history/humanities style tasks).

STRICT INSTRUCTION FOLLOWING:
- If the student specifies a word count, length, number of points, or any other explicit constraint, you MUST follow it exactly. Count before responding. Do not pad with filler or fall short.
- Answer precisely what was asked. Do not add unrequested sections or disclaimers.

MATH FORMATTING RULES (calculative mode):
- Write every equation using LaTeX, wrapped in double dollar signs for display equations, e.g. $$2x + 5 = 15$$
- Write fractions using \\frac{numerator}{denominator}, never as a slash like 2/5
- Solve step by step, showing each algebraic manipulation as its own LaTeX line
- Never describe math in plain prose when it can be shown as a formatted equation

IMAGES: If the student attaches an image, it may contain a handwritten or printed assignment, problem, or question. Read it carefully and respond to what it actually contains.

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
  if (image && image.base64 && image.mimeType) {
    currentParts.push({ inline_data: { mime_type: image.mimeType, data: image.base64 } })
  }
  contents.push({ role: 'user', parts: currentParts })

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents,
        }),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Gemini API error' })
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.'

    return res.status(200).json({ result: text })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
