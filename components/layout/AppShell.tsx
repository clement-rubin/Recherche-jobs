'use client'

import { usePathname } from 'next/navigation'
import { Nav } from './Nav'
import { MobileHeader } from './MobileHeader'
import { PageTransition } from './PageTransition'
import { AssistantBubble } from '../assistant/AssistantBubble'

const PUBLIC_PATHS = ['/login', '/auth']

export function AppShell({ children, isAuthenticated }: { children: React.ReactNode; isAuthenticated: boolean }) {
  const pathname = usePathname()
  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p))

  if (!isAuthenticated || isPublic) {
    return <div>{children}</div>
  }

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-56 z-30">
        <Nav />
      </aside>

      {/* Mobile header + drawer */}
      <MobileHeader />

      {/* Main content — keyed by pathname so PageTransition re-mounts on navigation */}
      <main className="flex-1 lg:ml-56 px-4 sm:px-6 lg:px-8 pt-20 pb-8 lg:pt-8 min-h-dvh">
        <PageTransition key={pathname}>
          {children}
        </PageTransition>
      </main>

      <AssistantBubble />
    </div>
  )
}
