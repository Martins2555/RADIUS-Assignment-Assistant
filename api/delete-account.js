import { createClient } from '@supabase/supabase-js'

// Same JWT-verification pattern as generate.js - anon key only, just to
// confirm who's calling. This client is NEVER used to actually delete
// anything; it only tells us the caller's own verified user id.
const supabaseAuth = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' })
  }

  if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Server misconfiguration: missing Supabase env vars' })
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY - account deletion cannot proceed')
    return res.status(500).json({ error: 'Account deletion is not configured yet. Please try again later.' })
  }

  const { data: userData, error: authError } = await supabaseAuth.auth.getUser(token)
  if (authError || !userData?.user) {
    return res.status(401).json({ error: 'Invalid or expired session' })
  }
  // Always the caller's OWN id, taken from their verified JWT - never from
  // anything the client sends in the request body. This endpoint can only
  // ever delete the account making the request.
  const userId = userData.user.id

  // Elevated client - service role key bypasses RLS and can call the Admin
  // Auth API. Only ever used server-side, only ever scoped to `userId` above.
  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  try {
    // Remove storage files first. Explicit, not relying on any assumed
    // cascade - listing each user's own folder in both buckets and removing
    // everything found there.
    for (const bucket of ['assignment-images', 'avatars']) {
      try {
        const { data: files } = await supabaseAdmin.storage.from(bucket).list(userId)
        if (files?.length) {
          const paths = files.map((f) => `${userId}/${f.name}`)
          await supabaseAdmin.storage.from(bucket).remove(paths)
        }
      } catch (e) {
        console.error(`Failed to clear ${bucket} for user ${userId}:`, e.message)
        // Continue anyway - a leftover file is far less bad than a failed
        // account deletion when the user explicitly asked to be removed.
      }
    }

    // Explicit row deletes, not relying on cascades that may or may not be
    // set up on tables created before this feature existed.
    const { data: conversations } = await supabaseAdmin.from('conversations').select('id').eq('user_id', userId)
    const conversationIds = (conversations || []).map((c) => c.id)
    if (conversationIds.length) {
      await supabaseAdmin.from('messages').delete().in('conversation_id', conversationIds)
    }
    await supabaseAdmin.from('conversations').delete().eq('user_id', userId)
    await supabaseAdmin.from('profiles').delete().eq('user_id', userId)
    await supabaseAdmin.from('rate_limits').delete().eq('user_id', userId)

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (deleteError) {
      console.error('deleteUser failed:', deleteError.message)
      return res.status(500).json({ error: 'Your account could not be deleted. Please try again.' })
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('Account deletion error:', err.message)
    return res.status(500).json({ error: 'Your account could not be deleted. Please try again.' })
  }
}
