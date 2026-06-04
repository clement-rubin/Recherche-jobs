'use client'

import { usePathname } from 'next/navigation'
import { Nav } from './Nav'
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
      <Nav />
      <main className="flex-1 ml-56 p-6 min-h-screen">
        {children}
      </main>
      <AssistantBubble />
    </div>
  )
}
