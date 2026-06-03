export interface GmailMessage {
  id: string
  threadId: string
  snippet: string
  payload: {
    headers: Array<{ name: string; value: string }>
    parts?: Array<{
      mimeType: string
      body: { data?: string; size: number }
    }>
    body?: { data?: string; size: number }
  }
  internalDate: string
}

export function getGmailHeader(msg: GmailMessage, name: string): string {
  return msg.payload.headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''
}

export function decodeBase64(encoded: string): string {
  // Gmail uses URL-safe base64
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
  try {
    return Buffer.from(base64, 'base64').toString('utf-8')
  } catch {
    return ''
  }
}

export function extractGmailBody(msg: GmailMessage): string {
  // Try parts first (multipart messages)
  if (msg.payload.parts) {
    const textPart = msg.payload.parts.find(p => p.mimeType === 'text/plain')
    if (textPart?.body?.data) return decodeBase64(textPart.body.data)
    const htmlPart = msg.payload.parts.find(p => p.mimeType === 'text/html')
    if (htmlPart?.body?.data) return decodeBase64(htmlPart.body.data).replace(/<[^>]+>/g, ' ')
  }
  // Single body
  if (msg.payload.body?.data) return decodeBase64(msg.payload.body.data)
  return msg.snippet ?? ''
}

export async function fetchGmailMessages(accessToken: string, since: Date): Promise<GmailMessage[]> {
  const query = `after:${Math.floor(since.getTime() / 1000)} (subject:emploi OR subject:candidature OR subject:offre OR subject:entretien OR subject:recrutement)`

  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=50`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!listRes.ok) {
    const err = await listRes.json()
    throw new Error(`Gmail list failed: ${err.error?.message ?? listRes.status}`)
  }

  const { messages = [] } = await listRes.json()
  if (messages.length === 0) return []

  // Fetch full messages in parallel (batched to avoid rate limits)
  const results = await Promise.allSettled(
    messages.map(({ id }: { id: string }) =>
      fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then(r => r.json())
    )
  )

  return results
    .filter((r): r is PromiseFulfilledResult<GmailMessage> => r.status === 'fulfilled')
    .map(r => r.value)
}

export async function refreshGmailToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  })
  if (!res.ok) throw new Error('Failed to refresh Gmail token')
  return res.json()
}
