// Login check for API routes.
//
// supabase.auth.getUser(token) asks the Supabase auth server whether the login
// is still alive. That call can fail for reasons that are NOT the student's
// fault (the auth server is busy or rate limited, a short network blip, a
// session record that was cleaned up on the server). Treating every one of
// those as "Invalid or expired session" locked students out of RADIUS even
// though their login token was perfectly valid.
//
// Order used here:
//   1. Ask the auth server (retry once on a busy/transient answer).
//   2. If that still fails but the database already accepted the very same
//      token (the rate-limit call made with it came back OK, so its signature
//      was verified), trust the token's own user id, as long as it has not
//      expired and has the "authenticated" role.

function decodeJwt(token) {
  try {
    const part = String(token).split('.')[1]
    if (!part) return null
    const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    return JSON.parse(json)
  } catch (e) {
    return null
  }
}

export async function getUserFromToken(supabaseAuth, token, proofPromise) {
  let lastError = null
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { data, error } = await supabaseAuth.auth.getUser(token)
      if (!error && data && data.user) return { user: data.user, error: null, via: 'auth-server' }
      lastError = error || new Error('No user returned')
    } catch (e) {
      lastError = e
    }
    const status = lastError && lastError.status
    const definite = status && status < 500 && status !== 429 && status !== 408
    if (definite) break
    await new Promise((resolve) => setTimeout(resolve, 400))
  }

  if (proofPromise) {
    try {
      const proof = await proofPromise
      const accepted = proof && typeof proof.status === 'number' && proof.status >= 200 && proof.status < 300
      if (accepted) {
        const claims = decodeJwt(token)
        const alive = claims && (!claims.exp || claims.exp * 1000 > Date.now())
        if (claims && claims.sub && alive && claims.role === 'authenticated') {
          return { user: { id: claims.sub, email: claims.email || null }, error: null, via: 'token' }
        }
      }
    } catch (e) { /* no proof available */ }
  }
  return { user: null, error: lastError, via: null }
}
