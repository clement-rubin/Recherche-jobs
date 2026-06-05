import { schedule } from '@netlify/functions'
import type { Handler } from '@netlify/functions'

export const handler: Handler = schedule('0 7 * * 1-5', async () => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const cronSecret = process.env.CRON_SECRET

  if (!appUrl || !cronSecret) {
    console.error('fetch-jobs: Missing NEXT_PUBLIC_APP_URL or CRON_SECRET')
    return { statusCode: 500, body: 'Configuration error' }
  }

  try {
    const res = await fetch(`${appUrl}/api/jobs/fetch`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
    })

    const body = await res.text()
    console.log(`fetch-jobs: ${res.status} — ${body}`)

    return {
      statusCode: res.ok ? 200 : res.status,
      body,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error(`fetch-jobs failed: ${msg}`)
    return { statusCode: 500, body: msg }
  }
})
