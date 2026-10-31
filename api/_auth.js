// Works out who is calling /api/generate from their Supabase login token.
//
// 1. Normal path: ask Supabase Auth (auth.getUser). Result: via 'server'.
// 2. If the Auth server is busy (429, 5xx or no answer), a student with a
//    perfectly good login would be turned away. In that case we accept the
//    token only if the database itself already accepted it (the rate-limit
//    call, which runs with the student's own token, answered successfully)
//    AND the token says "authenticated" and has not expired. Result: via 'token'.
//
// Returns { user, error, via }. user is null when the login cannot be trusted.

function decodePayload(token) {
  try {
    const part = String(token || '').split('.')[1]
    if (!part) return null
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const json = Buffer.from(b64, 'base64').toString('utf8')
    return JSON.parse(json)
  } catch (e) {
    return null
  }
}

export async function getUserFromToken(supabaseAuth, token, dbCheckPromise) {
  let authError = null
  try {
    const { data, error } = await supabaseAuth.auth.getUser(token)
    if (!error && data && data.user) return { user: data.user, error: null, via: 'server' }
    authError = error || new Error('No user for this token')
  } catch (e) {
    authError = e || new Error('Auth check failed')
  }

  const status = authError && authError.status
  const serverTrouble = !status || status === 429 || status >= 500
  if (!serverTrouble) return { user: null, error: authError, via: null }

  try {
    const rl = dbCheckPromise ? await dbCheckPromise : null
    const dbAccepted = !!rl && rl.status >= 200 && rl.status < 300 && !rl.error
    const p = decodePayload(token)
    const now = Math.floor(Date.now() / 1000)
    if (dbAccepted && p && p.sub && p.role === 'authenticated' && (!p.exp || p.exp > now)) {
      return {
        user: { id: p.sub, email: p.email || null, role: p.role, app_metadata: p.app_metadata || {}, user_metadata: p.user_metadata || {} },
        error: authError,
        via: 'token',
      }
    }
  } catch (e) { /* fall through */ }

  return { user: null, error: authError, via: null }
}

export default getUserFromToken
