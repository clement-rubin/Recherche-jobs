import { createServerSupabase } from '@/lib/supabase/server'
import type { Application } from '@/lib/supabase/types'
import { Badge } from '@/components/ui/Badge'
import Link from 'next/link'

async function getStats() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { total: 0, en_cours: 0, relance: 0, termine: 0, recent: [] }

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
    { label: 'Total candidatures', value: stats.total, color: 'text-foreground' },
    { label: 'En cours', value: stats.en_cours, color: 'text-accent' },
    { label: 'Relances', value: stats.relance, color: 'text-warning' },
    { label: 'Terminées', value: stats.termine, color: 'text-muted' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted text-sm mt-1">Vue d&apos;ensemble de votre recherche</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-muted text-xs uppercase tracking-wide mb-1">{label}</p>
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="flex gap-3">
        <Link
          href="/applications"
          className="bg-accent hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          + Nouvelle candidature
        </Link>
        <Link
          href="/offers"
          className="bg-card hover:bg-card/80 border border-border text-foreground text-sm px-4 py-2.5 rounded-lg transition-colors"
        >
          Voir les offres
        </Link>
      </div>

      {/* Recent activity */}
      <div className="bg-card border border-border rounded-xl">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-foreground font-medium">Activité récente</h2>
          <Link href="/applications" className="text-accent text-sm hover:underline">
            Voir tout →
          </Link>
        </div>
        {stats.recent.length === 0 ? (
          <div className="p-8 text-center text-muted text-sm">
            Aucune candidature pour l&apos;instant.{' '}
            <Link href="/applications" className="text-accent hover:underline">
              Ajouter la première
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {stats.recent.map((app) => (
              <div key={app.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-foreground text-sm font-medium">{app.entreprise}</p>
                  <p className="text-muted text-xs">{app.poste}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge status={app.statut} />
                  <span className="text-muted text-xs">
                    {app.date_postulation ? new Date(app.date_postulation).toLocaleDateString('fr-FR') : '—'}
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
