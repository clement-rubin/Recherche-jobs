'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/', label: 'Dashboard', icon: '◈' },
  { href: '/applications', label: 'Candidatures', icon: '✦' },
  { href: '/offers', label: 'Offres', icon: '◉' },
  { href: '/search', label: 'Recherche', icon: '◎' },
  { href: '/settings', label: 'Paramètres', icon: '◐' },
]

export function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <nav className="fixed left-0 top-0 h-full w-56 bg-card border-r border-border flex flex-col">
      <div className="p-4 border-b border-border">
        <h1 className="text-foreground font-bold text-lg">Job Tracker</h1>
        <p className="text-muted text-xs mt-0.5">Gestion candidatures</p>
      </div>
      <div className="flex-1 p-3 space-y-1">
        {navItems.map(({ href, label, icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-accent/20 text-accent font-medium'
                  : 'text-muted hover:text-foreground hover:bg-background'
              }`}
            >
              <span>{icon}</span>
              {label}
            </Link>
          )
        })}
      </div>
      <div className="p-3 border-t border-border">
        <button
          onClick={handleLogout}
          className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-muted hover:text-foreground hover:bg-background transition-colors"
        >
          Déconnexion
        </button>
      </div>
    </nav>
  )
}
