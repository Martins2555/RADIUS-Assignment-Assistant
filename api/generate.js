export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { subject, mode, assignmentText } = req.body

  if (!assignmentText) {
    return res.status(400).json({ error: 'Assignment text is required' })
  }

  const apiKey = process.env.GEMINI_API_KEY

  const prompt = `You are RADIUS, an assignment assistant for students. The subject is "${subject || 'unspecified'}" and the mode is "${mode}" (calculative means math/physics/engineering style problems requiring computation, non-calculative means writing/history/humanities style tasks).

Break down the following assignment into a clear, numbered list of 3-6 actionable subtasks a student should follow to complete it. Be specific and practical. If it's calculative, include the key steps of the computation. If it's non-calculative, include research and structure steps.

Assignment:
${assignmentText}`

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
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
