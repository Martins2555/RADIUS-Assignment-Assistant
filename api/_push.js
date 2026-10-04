// Shared helper for sending web push notifications. The leading underscore
// keeps Vercel from exposing this file as an API route.
//
// Needs these env vars in Vercel (see the setup notes):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, optional VAPID_SUBJECT
// If anything is missing, sending quietly does nothing, so chat never breaks.

async function loadWebPush() {
  const pub = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return null
  try {
    const mod = await import('web-push')
    const webpush = mod.default || mod
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'https://radiusassist.vercel.app', pub, priv)
    return webpush
  } catch (e) {
    console.error('web-push could not be loaded:', e?.message)
    return null
  }
}

// Sends one payload to a list of subscription rows. Rows the browser says are
// gone (404/410) are passed to onGone so they can be deleted.
export async function sendToSubscriptions(subs, payload, onGone) {
  const webpush = await loadWebPush()
  if (!webpush || !Array.isArray(subs) || subs.length === 0) return 0
  const body = JSON.stringify(payload)
  let sent = 0
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
          { TTL: 60 * 60 * 6 }
        )
        sent += 1
      } catch (e) {
        if (e && (e.statusCode === 404 || e.statusCode === 410)) {
          try { if (onGone) await onGone(s) } catch (err) { /* ignore */ }
        } else {
          console.error('Push send failed:', e?.statusCode, e?.message)
        }
      }
    })
  )
  return sent
}

// Sends to every device of one user that has the given switch turned on
// ('notify_replies' or 'notify_reminders'). `client` must be allowed to read
// that user's rows (the user-scoped client or the admin client).
export async function sendPushToUser(client, userId, payload, flag) {
  try {
    const { data: subs, error } = await client
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth, notify_replies, notify_reminders')
      .eq('user_id', userId)
    if (error || !subs) return 0
    const wanted = subs.filter((s) => s[flag] !== false)
    return await sendToSubscriptions(wanted, payload, async (s) => {
      await client.from('push_subscriptions').delete().eq('id', s.id)
    })
  } catch (e) {
    console.error('sendPushToUser failed:', e?.message)
    return 0
  }
}
