'use client'

import { useState } from 'react'
import type { Application, ContractType } from '@/lib/supabase/types'
import { Modal } from '@/components/ui/Modal'

interface Props {
  application?: Application | null
  onClose: () => void
  onSave: (data: Partial<Application>) => Promise<void>
}

const CONTRACT_TYPES: { value: ContractType; label: string }[] = [
  { value: 'interim', label: 'Intérim' },
  { value: 'stage', label: 'Stage' },
  { value: 'cdi', label: 'CDI' },
  { value: 'cdd', label: 'CDD' },
  { value: 'alternance', label: 'Alternance' },
]

export function ApplicationForm({ application, onClose, onSave }: Props) {
  const [form, setForm] = useState({
    entreprise: application?.entreprise ?? '',
    poste: application?.poste ?? '',
    lien_offre: application?.lien_offre ?? '',
    type_contrat: application?.type_contrat ?? 'interim' as ContractType,
    date_postulation: application?.date_postulation ?? new Date().toISOString().split('T')[0],
    notes: application?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSave({
        ...form,
        lien_offre: form.lien_offre || null,
        notes: form.notes || null,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = "w-full bg-[var(--background)] border border-[color:var(--border)] rounded-[var(--r-lg)] px-3 py-2 text-[color:var(--foreground)] text-sm focus:outline-none focus:border-[color:var(--accent)] transition-colors placeholder:text-[color:var(--muted)]"

  const footer = (
    <>
      <button
        type="button"
        onClick={onClose}
        className="flex-1 border border-[color:var(--border)] py-2 rounded-[var(--r-lg)] text-sm transition-colors"
        style={{ color: 'var(--muted)' }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--foreground)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)' }}
      >
        Annuler
      </button>
      <button
        type="submit"
        form="app-form"
        disabled={saving}
        className="flex-1 btn-accent disabled:opacity-50 text-white py-2 rounded-[var(--r-lg)] text-sm font-medium transition-colors"
      >
        {saving ? 'Enregistrement...' : 'Enregistrer'}
      </button>
    </>
  )

  return (
    <Modal
      title={application ? 'Modifier la candidature' : 'Nouvelle candidature'}
      onClose={onClose}
      footer={footer}
    >
      <form id="app-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div
            className="rounded-[var(--r-lg)] px-3 py-2 text-sm"
            style={{ background: 'var(--danger-surface)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)' }}
          >
            {error}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-[color:var(--muted)] text-xs mb-1.5">Entreprise *</label>
            <input required value={form.entreprise} onChange={e => setForm(f => ({ ...f, entreprise: e.target.value }))} placeholder="Ex: Decathlon" className={inputClass} />
          </div>
          <div className="col-span-2">
            <label className="block text-[color:var(--muted)] text-xs mb-1.5">Poste *</label>
            <input required value={form.poste} onChange={e => setForm(f => ({ ...f, poste: e.target.value }))} placeholder="Ex: Magasinier" className={inputClass} />
          </div>
          <div>
            <label className="block text-[color:var(--muted)] text-xs mb-1.5">Type de contrat</label>
            <select value={form.type_contrat} onChange={e => setForm(f => ({ ...f, type_contrat: e.target.value as ContractType }))} className={inputClass}>
              {CONTRACT_TYPES.map(ct => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[color:var(--muted)] text-xs mb-1.5">Date de postulation</label>
            <input type="date" value={form.date_postulation} onChange={e => setForm(f => ({ ...f, date_postulation: e.target.value }))} className={inputClass} />
          </div>
          <div className="col-span-2">
            <label className="block text-[color:var(--muted)] text-xs mb-1.5">Lien de l&apos;offre</label>
            <input type="url" value={form.lien_offre} onChange={e => setForm(f => ({ ...f, lien_offre: e.target.value }))} placeholder="https://..." className={inputClass} />
          </div>
          <div className="col-span-2">
            <label className="block text-[color:var(--muted)] text-xs mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Notes, contacts, informations..." className={inputClass} />
          </div>
        </div>
      </form>
    </Modal>
  )
}
