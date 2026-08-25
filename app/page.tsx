import { createServerSupabase } from '@/lib/supabase/server'
import type { Application } from '@/lib/supabase/types'
import { Badge } from '@/components/ui/Badge'
import Link from 'next/link'

async function getStats() {
  const supabase = await createServerSupabase()
  // getSession() reads the already-verified cookie set by middleware/layout —
  // avoids a second network round-trip to Supabase Auth on every dashboard load.
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) {
    const { redirect } = await import('next/navigation')
    return redirect('/login') as never
  }

  const { data: applications, error } = await supabase
    .from('applications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch applications:', error.message)
  }

  const apps: Application[] = applications ?? []
  return {
    total: apps.length,
    en_cours: apps.filter(a => a.statut === 'en_cours').length,
    relance: apps.filter(a => a.statut === 'relance').length,
    termine: apps.filter(a => a.statut === 'termine').length,
    recent: apps.slice(0, 5),
  }
}

export default async function DashboardPage() {
  const stats = await getStats()

  const statCards = [
    {
      label: 'Total',
      value: stats.total,
      accent: '#a78bfa',
      bg: 'rgba(124, 58, 237, 0.08)',
      border: 'rgba(124, 58, 237, 0.2)',
      icon: (
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
          <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      label: 'En cours',
      value: stats.en_cours,
      accent: '#60a5fa',
      bg: 'rgba(96, 165, 250, 0.08)',
      border: 'rgba(96, 165, 250, 0.2)',
      icon: (
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
          <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Relances',
      value: stats.relance,
      accent: '#fbbf24',
      bg: 'rgba(251, 191, 36, 0.08)',
      border: 'rgba(251, 191, 36, 0.2)',
      icon: (
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
          <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      ),
    },
    {
      label: 'Terminées',
      value: stats.termine,
      accent: '#34d399',
      bg: 'rgba(52, 211, 153, 0.08)',
      border: 'rgba(52, 211, 153, 0.2)',
      icon: (
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="max-w-4xl space-y-8 py-2">
      {/* Header */}
      <div className="animate-fade-up">
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-1.5 h-5 rounded-full"
            style={{ background: 'linear-gradient(to bottom, #a78bfa, #7c3aed)' }}
          />
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
        </div>
        <p className="text-muted text-sm ml-3.5">Vue d&apos;ensemble de votre recherche d&apos;emploi</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, accent, bg, border, icon }, i) => (
          <div
            key={label}
            className={`stat-card rounded-xl p-5 animate-fade-up delay-${i + 1}`}
            style={{
              background: bg,
              border: `1px solid ${border}`,
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium uppercase tracking-widest" style={{ color: accent, opacity: 0.8 }}>
                {label}
              </p>
              <span style={{ color: accent, opacity: 0.6 }}>{icon}</span>
            </div>
            <p
              className="text-4xl font-bold font-mono tracking-tight"
              style={{ color: accent }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {stats.total > 0 && (
        <div className="animate-fade-up delay-3 p-4 rounded-xl border border-border bg-card">
          <p className="text-xs text-muted uppercase tracking-wider mb-3">Progression</p>
          <div className="flex gap-1 h-2 rounded-full overflow-hidden">
            {stats.en_cours > 0 && (
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(stats.en_cours / stats.total) * 100}%`,
                  background: '#60a5fa',
                }}
              />
            )}
            {stats.relance > 0 && (
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(stats.relance / stats.total) * 100}%`,
                  background: '#fbbf24',
                }}
              />
            )}
            {stats.termine > 0 && (
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(stats.termine / stats.total) * 100}%`,
                  background: '#34d399',
                }}
              />
            )}
          </div>
          <div className="flex gap-4 mt-2">
            {[
              { label: 'En cours', color: '#60a5fa', val: stats.en_cours },
              { label: 'Relances', color: '#fbbf24', val: stats.relance },
              { label: 'Terminées', color: '#34d399', val: stats.termine },
            ].map(({ label, color, val }) => val > 0 && (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="text-xs text-muted">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="flex gap-3 animate-fade-up delay-4">
        <Link
          href="/applications"
          className="btn-accent text-white text-sm font-semibold px-5 py-2.5 rounded-lg inline-flex items-center gap-2"
        >
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path d="M12 4v16m8-8H4" />
          </svg>
          Nouvelle candidature
        </Link>
        <Link
          href="/offers"
          className="text-sm font-medium px-5 py-2.5 rounded-lg border border-border text-foreground-dim hover:border-border-light hover:text-foreground transition-all inline-flex items-center gap-2"
          style={{ background: 'var(--card)' }}
        >
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Voir les offres
        </Link>
      </div>

      {/* Recent activity */}
      <div className="animate-fade-up delay-5 rounded-xl border border-border overflow-hidden" style={{ background: 'var(--card)' }}>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="#7c3aed" strokeWidth={2}>
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <h2 className="text-foreground font-semibold text-sm">Activité récente</h2>
          </div>
          <Link
            href="/applications"
            className="text-xs font-medium px-3 py-1 rounded-full border border-border text-muted hover:text-foreground hover:border-border-light transition-all"
          >
            Voir tout →
          </Link>
        </div>

        {stats.recent.length === 0 ? (
          <div className="py-16 text-center">
            <div
              className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: 'rgba(124, 58, 237, 0.1)', border: '1px solid rgba(124, 58, 237, 0.2)' }}
            >
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#7c3aed" strokeWidth={1.5}>
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-foreground font-medium text-sm mb-1">Aucune candidature</p>
            <p className="text-muted text-xs mb-4">Commencez par ajouter votre première candidature</p>
            <Link
              href="/applications"
              className="btn-accent text-white text-xs font-semibold px-4 py-2 rounded-lg inline-flex items-center gap-1.5"
            >
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path d="M12 4v16m8-8H4" />
              </svg>
              Ajouter la première
            </Link>
          </div>
        ) : (
          <div>
            {stats.recent.map((app, i) => (
              <div
                key={app.id}
                className="px-5 py-3.5 flex items-center justify-between hover:bg-zinc-50 transition-colors"
                style={{ borderBottom: i < stats.recent.length - 1 ? '1px solid var(--border)' : 'none' }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
                    style={{
                      background: 'rgba(124, 58, 237, 0.1)',
                      color: '#a78bfa',
                      border: '1px solid rgba(124, 58, 237, 0.15)',
                    }}
                  >
                    {app.entreprise?.charAt(0)?.toUpperCase() ?? '?'}
                  </div>
                  <div>
                    <p className="text-foreground text-sm font-medium leading-none">{app.entreprise}</p>
                    <p className="text-muted text-xs mt-1">{app.poste}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge status={app.statut} />
                  <span className="text-muted text-xs font-mono hidden sm:block">
                    {app.date_postulation
                      ? new Date(app.date_postulation).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
                      : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
