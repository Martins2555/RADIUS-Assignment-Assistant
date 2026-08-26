export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { subject, mode, assignmentText, history } = req.body

  if (!assignmentText) {
    return res.status(400).json({ error: 'Assignment text is required' })
  }

  const apiKey = process.env.GEMINI_API_KEY

  const systemInstruction = `You are RADIUS, an assignment assistant for students. The subject is "${subject || 'unspecified'}" and the mode is "${mode}" (calculative means math/physics/engineering style problems requiring computation, non-calculative means writing/history/humanities style tasks).

STRICT INSTRUCTION FOLLOWING:
- If the student specifies a word count, length, number of points, or any other explicit constraint, you MUST follow it exactly. Count before responding. Do not pad with filler or fall short.
- Answer precisely what was asked. Do not add unrequested sections or disclaimers.

MATH FORMATTING RULES (calculative mode):
- Write every equation using LaTeX, wrapped in double dollar signs for display equations, e.g. $$2x + 5 = 15$$
- Write fractions using \\frac{numerator}{denominator}, never as a slash like 2/5
- Solve step by step, showing each algebraic manipulation as its own LaTeX line
- Never describe math in plain prose when it can be shown as a formatted equation

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

  contents.push({ role: 'user', parts: [{ text: assignmentText }] })

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
