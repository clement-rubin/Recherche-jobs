'use client'

import { useState } from 'react'
import type { LinkedInContact, ContactStatus } from '@/lib/supabase/types'
import { Modal } from '@/components/ui/Modal'

interface Props {
  contact?: LinkedInContact | null
  onClose: () => void
  onSave: (data: Partial<LinkedInContact>) => Promise<void>
}

const STATUSES: { value: ContactStatus; label: string }[] = [
  { value: 'a_contacter', label: 'À contacter' },
  { value: 'contacte', label: 'Contacté' },
  { value: 'repondu', label: 'A répondu' },
]

export function ContactForm({ contact, onClose, onSave }: Props) {
  const [form, setForm] = useState({
    nom: contact?.nom ?? '',
    poste: contact?.poste ?? '',
    entreprise: contact?.entreprise ?? '',
    linkedin_url: contact?.linkedin_url ?? '',
    profil_texte: contact?.profil_texte ?? '',
    statut: contact?.statut ?? ('a_contacter' as ContactStatus),
    notes: contact?.notes ?? '',
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
        poste: form.poste || null,
        entreprise: form.entreprise || null,
        notes: form.notes || null,
        profil_texte: form.profil_texte || null,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = "w-full bg-[var(--background)] border border-[color:var(--border)] rounded-[var(--r-lg)] px-3 py-2 text-[color:var(--foreground)] text-sm focus:outline-none focus:border-[color:var(--accent)] transition-colors placeholder:text-[color:var(--muted)]"
  const labelClass = "block text-[color:var(--muted)] text-xs mb-1.5"

  const footer = (
    <>
      <button type="button" onClick={onClose} className="flex-1 border border-[color:var(--border)] py-2 rounded-[var(--r-lg)] text-sm" style={{ color: 'var(--muted)' }}>
        Annuler
      </button>
      <button type="submit" form="contact-form" disabled={saving} className="flex-1 btn-accent disabled:opacity-50 text-white py-2 rounded-[var(--r-lg)] text-sm font-medium">
        {saving ? 'Enregistrement...' : 'Enregistrer'}
      </button>
    </>
  )

  return (
    <Modal title={contact ? 'Modifier le contact' : 'Nouveau contact'} onClose={onClose} footer={footer}>
      <form id="contact-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-[var(--r-lg)] px-3 py-2 text-sm" style={{ background: 'var(--danger-surface)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)' }}>
            {error}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={labelClass}>Nom *</label>
            <input required value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder="Ex: Marie Dupont" className={inputClass} />
          </div>
          <div className="col-span-2">
            <label className={labelClass}>Profil LinkedIn *</label>
            <input required value={form.linkedin_url} onChange={e => setForm(f => ({ ...f, linkedin_url: e.target.value }))} placeholder="https://www.linkedin.com/in/..." className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Poste</label>
            <input value={form.poste} onChange={e => setForm(f => ({ ...f, poste: e.target.value }))} placeholder="Ex: Recruteuse" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Entreprise</label>
            <input value={form.entreprise} onChange={e => setForm(f => ({ ...f, entreprise: e.target.value }))} placeholder="Ex: Decathlon" className={inputClass} />
          </div>
          <div className="col-span-2">
            <label className={labelClass}>Expériences du profil (copie-colle depuis LinkedIn)</label>
            <textarea value={form.profil_texte} onChange={e => setForm(f => ({ ...f, profil_texte: e.target.value }))} rows={5} placeholder="Titre, expériences, formation... sert à suggérer un message personnalisé" className={inputClass} />
          </div>
          <div className="col-span-2">
            <label className={labelClass}>Statut</label>
            <select value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value as ContactStatus }))} className={inputClass}>
              {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className={labelClass}>Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Contexte, message envoyé..." className={inputClass} />
          </div>
        </div>
      </form>
    </Modal>
  )
}
