'use client'

import { useState } from 'react'
import type { Application, ApplicationStatus, ContractType } from '@/lib/supabase/types'
import { Badge } from '@/components/ui/Badge'
import { ApplicationForm } from './ApplicationForm'

interface Props {
  applications: Application[]
  onUpdate: (id: string, data: Partial<Application>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onCreate: (data: Partial<Application>) => Promise<void>
}

const STATUS_OPTIONS: { value: ApplicationStatus | ''; label: string }[] = [
  { value: '', label: 'Tous les statuts' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'relance', label: 'Relance' },
  { value: 'termine', label: 'Terminé' },
]

const CONTRACT_OPTIONS: { value: ContractType | ''; label: string }[] = [
  { value: '', label: 'Tous types' },
  { value: 'interim', label: 'Intérim' },
  { value: 'stage', label: 'Stage' },
  { value: 'cdi', label: 'CDI' },
  { value: 'cdd', label: 'CDD' },
  { value: 'alternance', label: 'Alternance' },
]

export function ApplicationsTable({ applications, onUpdate, onDelete, onCreate }: Props) {
  const [filterStatus, setFilterStatus] = useState<ApplicationStatus | ''>('')
  const [filterContract, setFilterContract] = useState<ContractType | ''>('')
  const [editApp, setEditApp] = useState<Application | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = applications.filter(a => {
    if (filterStatus && a.statut !== filterStatus) return false
    if (filterContract && a.type_contrat !== filterContract) return false
    return true
  })

  const selectClass = "bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent"

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex gap-2">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as ApplicationStatus | '')} className={selectClass}>
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={filterContract} onChange={e => setFilterContract(e.target.value as ContractType | '')} className={selectClass}>
            {CONTRACT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <button onClick={() => setShowCreate(true)} className="bg-accent hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + Nouvelle candidature
        </button>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs text-muted px-4 py-3 font-medium">Entreprise</th>
              <th className="text-left text-xs text-muted px-4 py-3 font-medium">Poste</th>
              <th className="text-left text-xs text-muted px-4 py-3 font-medium">Contrat</th>
              <th className="text-left text-xs text-muted px-4 py-3 font-medium">Statut</th>
              <th className="text-left text-xs text-muted px-4 py-3 font-medium">Date</th>
              <th className="text-right text-xs text-muted px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-muted text-sm py-12">
                  Aucune candidature
                </td>
              </tr>
            ) : (
              filtered.map(app => (
                <>
                  <tr
                    key={app.id}
                    className="border-b border-border last:border-0 hover:bg-background/50 transition-colors cursor-pointer"
                    onClick={() => setExpandedId(expandedId === app.id ? null : app.id)}
                  >
                    <td className="px-4 py-3 text-foreground text-sm font-medium">{app.entreprise}</td>
                    <td className="px-4 py-3 text-muted text-sm">{app.poste}</td>
                    <td className="px-4 py-3 text-muted text-sm capitalize">{app.type_contrat ?? '—'}</td>
                    <td className="px-4 py-3"><Badge status={app.statut} /></td>
                    <td className="px-4 py-3 text-muted text-sm">
                      {app.date_postulation ? new Date(app.date_postulation).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2 justify-end">
                        <select
                          value={app.statut}
                          onChange={e => onUpdate(app.id, { statut: e.target.value as ApplicationStatus })}
                          className="bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none"
                        >
                          <option value="en_cours">En cours</option>
                          <option value="relance">Relance</option>
                          <option value="termine">Terminé</option>
                        </select>
                        <button onClick={() => setEditApp(app)} className="text-muted hover:text-accent text-xs px-2 py-1 rounded hover:bg-accent/10 transition-colors">Éditer</button>
                        <button onClick={() => { if (confirm(`Supprimer la candidature chez ${app.entreprise} ?`)) onDelete(app.id) }} className="text-muted hover:text-red-400 text-xs px-2 py-1 rounded hover:bg-red-500/10 transition-colors">Sup.</button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === app.id && app.notes && (
                    <tr key={`${app.id}-notes`} className="border-b border-border bg-background/30">
                      <td colSpan={6} className="px-4 py-3">
                        <p className="text-muted text-xs"><span className="text-foreground font-medium">Notes:</span> {app.notes}</p>
                        {app.lien_offre && (
                          <a href={app.lien_offre} target="_blank" rel="noopener noreferrer" className="text-accent text-xs hover:underline mt-1 block">
                            Voir l&apos;offre →
                          </a>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {showCreate && (
        <ApplicationForm onClose={() => setShowCreate(false)} onSave={onCreate} />
      )}
      {editApp && (
        <ApplicationForm
          application={editApp}
          onClose={() => setEditApp(null)}
          onSave={(data) => onUpdate(editApp.id, data)}
        />
      )}
    </div>
  )
}
