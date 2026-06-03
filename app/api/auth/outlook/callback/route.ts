import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/settings?error=outlook_denied`)
  }

  // Validate CSRF state
  const savedState = req.cookies.get('outlook_oauth_state')?.value
  if (!state || !savedState || state !== savedState) {
    return NextResponse.redirect(`${appUrl}/settings?error=outlook_csrf`)
  }

  // Exchange code for tokens
  const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.MICROSOFT_REDIRECT_URI!,
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      scope: 'https://graph.microsoft.com/Mail.Read offline_access',
    }),
  })

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${appUrl}/settings?error=outlook_token_failed`)
  }

  const { access_token, refresh_token, expires_in } = await tokenRes.json()

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${appUrl}/login`)
  }

  const { error: dbError } = await supabase
    .from('oauth_tokens')
    .upsert({
      user_id: user.id,
      provider: 'outlook',
      access_token,
      refresh_token: refresh_token ?? null,
      expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
      scopes: ['Mail.Read'],
    } as any, { onConflict: 'user_id,provider' })

  if (dbError) {
    console.error('Failed to save Outlook token — DB error code:', dbError.code)
    return NextResponse.redirect(`${appUrl}/settings?error=outlook_db_failed`)
  }

  const response = NextResponse.redirect(`${appUrl}/settings?success=outlook_connected`)
  response.cookies.delete('outlook_oauth_state')
  return response
}
