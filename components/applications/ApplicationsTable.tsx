'use client'

import { useState } from 'react'
import type { Application, ApplicationStatus, ContractType } from '@/lib/supabase/types'
import { Badge } from '@/components/ui/Badge'
import { ApplicationForm } from './ApplicationForm'
import { InlineConfirm } from '@/components/ui/InlineConfirm'

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
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const filtered = applications.filter(a => {
    if (filterStatus && a.statut !== filterStatus) return false
    if (filterContract && a.type_contrat !== filterContract) return false
    return true
  })

  const selectClass = 'border rounded-[var(--r-lg)] px-3 py-1.5 text-sm focus:outline-none focus:border-[color:var(--accent)]'
  const selectStyle = { background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap gap-2">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as ApplicationStatus | '')}
            className={selectClass}
            style={selectStyle}
          >
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            value={filterContract}
            onChange={e => setFilterContract(e.target.value as ContractType | '')}
            className={selectClass}
            style={selectStyle}
          >
            {CONTRACT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-accent text-white text-sm font-medium px-4 py-2.5 rounded-[var(--r-lg)] min-h-[40px] flex-shrink-0"
        >
          + Nouvelle
        </button>
      </div>

      {/* Table — horizontal scroll on small screens */}
      <div className="rounded-[var(--r-xl)] overflow-hidden overflow-x-auto" style={{ background: 'var(--card-gradient)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
        <table className="w-full min-w-[560px]">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th className="text-left text-xs px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>Entreprise</th>
              <th className="text-left text-xs px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>Poste</th>
              <th className="text-left text-xs px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>Contrat</th>
              <th className="text-left text-xs px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>Statut</th>
              <th className="text-left text-xs px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>Date</th>
              <th className="text-right text-xs px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-sm py-12" style={{ color: 'var(--muted)' }}>
                  Aucune candidature
                </td>
              </tr>
            ) : (
              filtered.map(app => (
                <>
                  <tr
                    key={app.id}
                    className="transition-colors cursor-pointer"
                    style={{ borderBottom: '1px solid var(--border)' }}
                    onClick={() => setExpandedId(expandedId === app.id ? null : app.id)}
                  >
                    <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--foreground)' }}>{app.entreprise}</td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--muted)' }}>{app.poste}</td>
                    <td className="px-4 py-3 text-sm capitalize" style={{ color: 'var(--muted)' }}>{app.type_contrat ?? '—'}</td>
                    <td className="px-4 py-3"><Badge status={app.statut} /></td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--muted)' }}>
                      {app.date_postulation ? new Date(app.date_postulation).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2 justify-end">
                        <select
                          value={app.statut}
                          onChange={e => onUpdate(app.id, { statut: e.target.value as ApplicationStatus })}
                          className="rounded px-2 py-1 text-xs focus:outline-none border"
                          style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                        >
                          <option value="en_cours">En cours</option>
                          <option value="relance">Relance</option>
                          <option value="termine">Terminé</option>
                        </select>
                        <button
                          onClick={() => setEditApp(app)}
                          className="text-xs px-2.5 py-1.5 rounded-md transition-colors min-h-[32px]"
                          style={{ color: 'var(--muted)' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                        >
                          Éditer
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(app.id)}
                          className="text-xs px-2.5 py-1.5 rounded-md transition-colors min-h-[32px]"
                          style={{ color: 'var(--muted)' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-surface)'; e.currentTarget.style.color = 'var(--danger-text)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted)' }}
                        >
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                  {deleteConfirmId === app.id && (
                    <tr key={`${app.id}-confirm`} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td colSpan={6} className="px-4 py-2">
                        <InlineConfirm
                          visible
                          message={`Supprimer la candidature chez ${app.entreprise} ?`}
                          confirmLabel="Supprimer"
                          onConfirm={() => { setDeleteConfirmId(null); onDelete(app.id) }}
                          onCancel={() => setDeleteConfirmId(null)}
                        />
                      </td>
                    </tr>
                  )}
                  {expandedId === app.id && app.notes && (
                    <tr key={`${app.id}-notes`} style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}>
                      <td colSpan={6} className="px-4 py-3">
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>
                          <span className="font-medium" style={{ color: 'var(--foreground)' }}>Notes :</span> {app.notes}
                        </p>
                        {app.lien_offre && (
                          <a href={app.lien_offre} target="_blank" rel="noopener noreferrer" className="text-xs mt-1 block" style={{ color: 'var(--accent)' }}>
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

      {showCreate && <ApplicationForm onClose={() => setShowCreate(false)} onSave={onCreate} />}
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
