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
  // getSession() reads the cookie locally — no network call. Safe here because
  // middleware already verifies/enforces auth before this layout ever renders
  // (unauthenticated → redirected to /login, authenticated-on-/login → redirected away).
  const { data: { session } } = await supabase.auth.getSession()

  return (
    <html lang="fr">
      <body className={`${outfit.variable} ${jetbrainsMono.variable} bg-background text-foreground min-h-screen`}>
        <AppShell isAuthenticated={!!session}>
          {children}
        </AppShell>
      </body>
    </html>
  )
}
