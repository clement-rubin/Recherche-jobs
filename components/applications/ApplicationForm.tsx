'use client'

import { useState } from 'react'
import type { Application, ContractType } from '@/lib/supabase/types'

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

  const inputClass = "w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-accent transition-colors placeholder:text-muted"

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-foreground font-semibold">
            {application ? 'Modifier la candidature' : 'Nouvelle candidature'}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 text-sm">{error}</div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-muted text-xs mb-1.5">Entreprise *</label>
              <input required value={form.entreprise} onChange={e => setForm(f => ({ ...f, entreprise: e.target.value }))} placeholder="Ex: Decathlon" className={inputClass} />
            </div>
            <div className="col-span-2">
              <label className="block text-muted text-xs mb-1.5">Poste *</label>
              <input required value={form.poste} onChange={e => setForm(f => ({ ...f, poste: e.target.value }))} placeholder="Ex: Magasinier" className={inputClass} />
            </div>
            <div>
              <label className="block text-muted text-xs mb-1.5">Type de contrat</label>
              <select value={form.type_contrat} onChange={e => setForm(f => ({ ...f, type_contrat: e.target.value as ContractType }))} className={inputClass}>
                {CONTRACT_TYPES.map(ct => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-muted text-xs mb-1.5">Date de postulation</label>
              <input type="date" value={form.date_postulation} onChange={e => setForm(f => ({ ...f, date_postulation: e.target.value }))} className={inputClass} />
            </div>
            <div className="col-span-2">
              <label className="block text-muted text-xs mb-1.5">Lien de l&apos;offre</label>
              <input type="url" value={form.lien_offre} onChange={e => setForm(f => ({ ...f, lien_offre: e.target.value }))} placeholder="https://..." className={inputClass} />
            </div>
            <div className="col-span-2">
              <label className="block text-muted text-xs mb-1.5">Notes</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Notes, contacts, informations..." className={inputClass} />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-border text-muted hover:text-foreground py-2 rounded-lg text-sm transition-colors">Annuler</button>
            <button type="submit" disabled={saving} className="flex-1 bg-accent hover:bg-indigo-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors">
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
