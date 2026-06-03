export interface OutlookMessage {
  id: string
  subject: string
  from: {
    emailAddress: { address: string; name: string }
  }
  receivedDateTime: string
  body: {
    contentType: 'html' | 'text'
    content: string
  }
  bodyPreview: string
}

export function extractOutlookBody(msg: OutlookMessage): string {
  if (msg.body.contentType === 'text') return msg.body.content
  // Strip HTML tags for text/plain version
  return msg.body.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export async function fetchOutlookMessages(accessToken: string, since: Date): Promise<OutlookMessage[]> {
  const filter = `receivedDateTime ge ${since.toISOString()}`
  const search = '"emploi" OR "candidature" OR "offre" OR "entretien" OR "recrutement"'

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages?$filter=${encodeURIComponent(filter)}&$search=${encodeURIComponent(search)}&$top=50&$select=id,subject,from,receivedDateTime,body,bodyPreview`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Outlook fetch failed: ${err.error?.message ?? res.status}`)
  }

  const { value = [] } = await res.json()
  return value
}

export async function refreshOutlookToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(
    `https://login.microsoftonline.com/common/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        scope: 'https://graph.microsoft.com/Mail.Read offline_access',
      }),
    }
  )
  if (!res.ok) throw new Error('Failed to refresh Outlook token')
  return res.json()
}
