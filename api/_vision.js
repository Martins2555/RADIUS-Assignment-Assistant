// Photos for the backup providers (they use the OpenAI-style message format).
// Gemini reads images and PDFs itself. The backups can only take images, so this
// returns null (and the backups are skipped) when any attachment is not an image.
export function buildVisionMessages(chatMessages, contents, maxImages = 5) {
  try {
    const last = contents && contents[contents.length - 1]
    if (!last || !Array.isArray(last.parts)) return null
    const files = last.parts.filter((p) => p && p.inline_data)
    if (!files.length) return null
    const images = files.filter((p) => /^image\/(png|jpe?g|webp|gif)$/i.test(p.inline_data.mime_type || ''))
    if (images.length !== files.length) return null
    const lastMsg = chatMessages[chatMessages.length - 1]
    if (!lastMsg) return null
    const text = (typeof lastMsg.content === 'string' && lastMsg.content.trim()) || 'Please look at the attached image and answer the question in it.'
    const parts = [
      { type: 'text', text },
      ...images.slice(0, maxImages).map((p) => ({ type: 'image_url', image_url: { url: `data:${p.inline_data.mime_type};base64,${p.inline_data.data}` } })),
    ]
    return [...chatMessages.slice(0, -1), { ...lastMsg, content: parts }]
  } catch (e) {
    return null
  }
}
