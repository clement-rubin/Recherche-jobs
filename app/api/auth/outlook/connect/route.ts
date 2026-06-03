import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

export async function GET() {
  const state = randomBytes(32).toString('hex')

  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    redirect_uri: process.env.MICROSOFT_REDIRECT_URI!,
    response_type: 'code',
    scope: 'https://graph.microsoft.com/Mail.Read offline_access',
    response_mode: 'query',
    state,
  })

  const response = NextResponse.redirect(
    `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`
  )

  response.cookies.set('outlook_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  return response
}
