import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/settings?error=gmail_denied`)
  }

  // Validate CSRF state
  const savedState = req.cookies.get('gmail_oauth_state')?.value
  if (!state || !savedState || state !== savedState) {
    return NextResponse.redirect(`${appUrl}/settings?error=gmail_csrf`)
  }

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  })

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${appUrl}/settings?error=gmail_token_failed`)
  }

  const tokens = await tokenRes.json()
  const { access_token, refresh_token, expires_in } = tokens

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${appUrl}/login`)
  }

  const { error: dbError } = await supabase
    .from('oauth_tokens')
    .upsert({
      user_id: user.id,
      provider: 'gmail',
      access_token,
      refresh_token: refresh_token ?? null,
      expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
      scopes: ['gmail.readonly'],
    } as any, { onConflict: 'user_id,provider' })

  if (dbError) {
    console.error('Failed to save Gmail token — DB error code:', dbError.code)
    return NextResponse.redirect(`${appUrl}/settings?error=gmail_db_failed`)
  }

  // Clear the state cookie
  const response = NextResponse.redirect(`${appUrl}/settings?success=gmail_connected`)
  response.cookies.delete('gmail_oauth_state')
  return response
}
