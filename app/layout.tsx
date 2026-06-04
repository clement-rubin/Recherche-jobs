import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { createServerSupabase } from '@/lib/supabase/server'
import { AppShell } from '@/components/layout/AppShell'

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
        <AppShell isAuthenticated={!!user}>
          {children}
        </AppShell>
      </body>
    </html>
  )
}
