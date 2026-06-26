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

    // getSession() reads the JWT from cookies — no HTTP call in the happy path.
    // Only makes a network call when the access token is expired and needs
    // refreshing. Wrapped in try/catch so any Supabase/network error falls
    // back to treating the user as unauthenticated instead of crashing with 500.
    const result = await supabase.auth.getSession()
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
