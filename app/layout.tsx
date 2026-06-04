import type { Metadata } from 'next'
import { Outfit, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { createServerSupabase } from '@/lib/supabase/server'
import { AppShell } from '@/components/layout/AppShell'

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit', display: 'swap' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' })

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
    <html lang="fr">
      <body className={`${outfit.variable} ${jetbrainsMono.variable} bg-background text-foreground min-h-screen`}>
        <AppShell isAuthenticated={!!user}>
          {children}
        </AppShell>
      </body>
    </html>
  )
}
