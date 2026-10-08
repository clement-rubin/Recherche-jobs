'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Application } from '@/lib/supabase/types'
import { ApplicationsTable } from '@/components/applications/ApplicationsTable'
import { KanbanBoard } from '@/components/applications/KanbanBoard'

type View = 'table' | 'kanban'

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('table')
  const [error, setError] = useState<string | null>(null)

  const fetchApplications = useCallback(async () => {
    setError(null)
    const res = await fetch('/api/applications')
    if (!res.ok) {
      setError('Impossible de charger les candidatures')
      return
    }
    const data = await res.json()
    setApplications(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchApplications()
  }, [fetchApplications])

  const handleCreate = async (data: Partial<Application>) => {
    const res = await fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? `Erreur ${res.status} lors de la création`)
    }
    await fetchApplications()
  }

  const handleUpdate = async (id: string, data: Partial<Application>) => {
    const res = await fetch(`/api/applications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? `Erreur ${res.status} lors de la mise à jour`)
    }
    setApplications(prev => prev.map(a => a.id === id ? { ...a, ...data } : a))
  }

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/applications/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? `Erreur ${res.status} lors de la suppression`)
    }
    setApplications(prev => prev.filter(a => a.id !== id))
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 rounded animate-pulse" style={{ background: 'var(--card)' }} />
        <div className="h-64 rounded-[var(--r-xl)] animate-pulse" style={{ background: 'var(--card)' }} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Candidatures</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{applications.length} candidature{applications.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2 rounded-[var(--r-lg)] p-1 flex-shrink-0" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <button
            onClick={() => setView('table')}
            className="px-3 py-1.5 rounded-md text-sm transition-colors min-h-[34px]"
            style={view === 'table' ? { background: 'var(--accent)', color: 'white' } : { color: 'var(--muted)' }}
            onMouseEnter={view !== 'table' ? e => { e.currentTarget.style.color = 'var(--foreground)' } : undefined}
            onMouseLeave={view !== 'table' ? e => { e.currentTarget.style.color = 'var(--muted)' } : undefined}
          >
            Tableau
          </button>
          <button
            onClick={() => setView('kanban')}
            className="px-3 py-1.5 rounded-md text-sm transition-colors min-h-[34px]"
            style={view === 'kanban' ? { background: 'var(--accent)', color: 'white' } : { color: 'var(--muted)' }}
            onMouseEnter={view !== 'kanban' ? e => { e.currentTarget.style.color = 'var(--foreground)' } : undefined}
            onMouseLeave={view !== 'kanban' ? e => { e.currentTarget.style.color = 'var(--muted)' } : undefined}
          >
            Kanban
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-[var(--r-lg)] px-4 py-3 text-sm" style={{ background: 'var(--danger-surface)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)' }}>{error}</div>
      )}

      {view === 'table' ? (
        <ApplicationsTable
          applications={applications}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onCreate={handleCreate}
        />
      ) : (
        <KanbanBoard applications={applications} onUpdate={handleUpdate} />
      )}
    </div>
  )
}
