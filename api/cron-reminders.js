import { createClient } from '@supabase/supabase-js'
import { sendToSubscriptions } from './_push.js'

// Runs once a day (see vercel.json). Sends a streak reminder to students who
// used RADIUS yesterday but not yet today, and who switched reminders on.
// Vercel calls this with the header "Authorization: Bearer <CRON_SECRET>" when
// a CRON_SECRET env var exists. Without that secret the endpoint refuses to
// run, so nobody else can trigger it.
export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return res.status(500).json({ error: 'CRON_SECRET is not set in Vercel' })
  }
  if (req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Missing Supabase env vars' })
  }

  const admin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  try {
    const { data: subs, error } = await admin
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth, notify_reminders')
      .eq('notify_reminders', true)
    if (error) throw new Error(error.message)
    if (!subs || subs.length === 0) return res.status(200).json({ users: 0, sent: 0 })

    const userIds = Array.from(new Set(subs.map((s) => s.user_id)))
    const profiles = []
    for (let i = 0; i < userIds.length; i += 150) {
      const { data } = await admin
        .from('profiles')
        .select('user_id, nickname, streak_count, last_active_date')
        .in('user_id', userIds.slice(i, i + 150))
      if (data) profiles.push(...data)
    }

    const day = (ms) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' })
    const today = day(Date.now())
    const yesterday = day(Date.now() - 24 * 60 * 60 * 1000)

    let usersNotified = 0
    let sent = 0
    for (const p of profiles) {
      const last = p.last_active_date ? String(p.last_active_date).slice(0, 10) : null
      // Streak is alive (used yesterday) but not extended today yet.
      if (!p.streak_count || p.streak_count < 1 || last !== yesterday || last === today) continue
      const mine = subs.filter((s) => s.user_id === p.user_id)
      const name = p.nickname ? `, ${p.nickname}` : ''
      const n = await sendToSubscriptions(
        mine,
        {
          title: 'Keep your streak going',
          body: `You are on a ${p.streak_count}-day streak${name}. One quick question today keeps it alive.`,
          tag: 'radius-streak',
          url: '/',
        },
        async (s) => {
          await admin.from('push_subscriptions').delete().eq('id', s.id)
        }
      )
      if (n > 0) usersNotified += 1
      sent += n
    }
    return res.status(200).json({ users: usersNotified, sent })
  } catch (e) {
    console.error('cron-reminders failed:', e?.message)
    return res.status(500).json({ error: 'Reminder run failed' })
  }
}
