import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { Nav } from '@/components/layout/Nav'
import { createServerSupabase } from '@/lib/supabase/server'
import { AssistantBubble } from '@/components/assistant/AssistantBubble'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Job Tracker',
  description: "Gérez vos candidatures et offres d'emploi",
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <html lang="fr" className="dark">
      <body className={`${geist.className} bg-background text-foreground min-h-screen`}>
        {user ? (
          <div className="flex min-h-screen">
            <Nav />
            <main className="flex-1 ml-56 p-6 min-h-screen">
              {children}
            </main>
            <AssistantBubble />
          </div>
        ) : (
          <div>{children}</div>
        )}
      </body>
    </html>
  )
}
