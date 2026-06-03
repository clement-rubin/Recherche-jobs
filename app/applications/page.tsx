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
        <div className="h-8 w-48 bg-card rounded animate-pulse" />
        <div className="h-64 bg-card rounded-xl animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Candidatures</h1>
          <p className="text-muted text-sm mt-1">{applications.length} candidature{applications.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2 bg-card border border-border rounded-lg p-1">
          <button
            onClick={() => setView('table')}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${view === 'table' ? 'bg-accent text-white' : 'text-muted hover:text-foreground'}`}
          >
            Tableau
          </button>
          <button
            onClick={() => setView('kanban')}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${view === 'kanban' ? 'bg-accent text-white' : 'text-muted hover:text-foreground'}`}
          >
            Kanban
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>
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
