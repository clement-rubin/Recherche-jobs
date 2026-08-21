import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Fully public routes — skip auth check entirely
  if (pathname === '/about' || pathname.startsWith('/auth/')) {
    return NextResponse.next({ request })
  }

  const response = NextResponse.next({ request })

  let session = null

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          // Never refresh tokens in the edge function — a network call here
          // causes the Netlify edge timeout when Supabase is slow or the token
          // is expired. Client-side code handles refresh after hydration.
          autoRefreshToken: false,
          persistSession: false,
        },
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    // Pure cookie read — no network call. 4 s timeout as last-resort guard.
    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise<{ data: { session: null } }>((resolve) =>
        setTimeout(() => resolve({ data: { session: null } }), 4000)
      ),
    ])
    session = result.data.session
  } catch {
    // Auth check failed (network error, Supabase timeout, etc.).
    // Treat as unauthenticated — protected routes redirect to /login.
  }

  if (!session && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (session && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
