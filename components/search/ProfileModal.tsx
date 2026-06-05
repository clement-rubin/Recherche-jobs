'use client'

import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import type { SearchProfile } from '@/lib/supabase/types'
import { TagInput } from '@/components/ui/TagInput'
import { AsyncButton } from '@/components/ui/AsyncButton'

const CONTRACT_TYPES = ['interim', 'stage', 'cdi', 'cdd', 'alternance']
const DUREE_OPTIONS = [
  { value: 'peu_importe',  label: 'Peu importe' },
  { value: '1_semaine',    label: '1 semaine' },
  { value: '2_semaines',   label: '2 semaines' },
  { value: '3_semaines',   label: '3 semaines' },
  { value: 'moins_1_mois', label: 'Moins de 1 mois' },
  { value: '1_3_mois',     label: '1 à 3 mois' },
  { value: '3_6_mois',     label: '3 à 6 mois' },
  { value: '6_plus',       label: '6 mois et plus' },
]
const EXCLUSION_PRESETS = [
  { label: 'CDI', value: 'cdi' },
  { label: 'CDD', value: 'cdd' },
  { label: 'Alternance', value: 'alternance' },
  { label: 'Stage', value: 'stage' },
  { label: 'Freelance', value: 'freelance' },
  { label: 'Temps plein', value: 'temps plein' },
  { label: 'Temps partiel', value: 'temps partiel' },
]
const KW_SUGGESTIONS = ['magasinier', 'logistique', 'entrepôt', 'manutentionnaire', 'cariste', 'préparateur de commandes']
const QUAL_SUGGESTIONS = ['CACES 1', 'CACES 3', 'CACES 5', 'Permis B', 'Bac+2', 'Bac+3']

interface ProfileModalProps {
  profile?: SearchProfile | null
  onSave: (data: Partial<SearchProfile>) => Promise<void>
  onClose: () => void
}

export function ProfileModal({ profile, onSave, onClose }: ProfileModalProps) {
  const [form, setForm] = useState({
    nom: profile?.nom ?? '',
    localisation: profile?.localisation ?? 'Lille',
    rayon_km: profile?.rayon_km ?? 30,
    mots_cles: profile?.mots_cles ?? ['emploi'],
    mots_cles_exclus: profile?.mots_cles_exclus ?? [] as string[],
    qualifications: profile?.qualifications ?? [] as string[],
    duree_contrat: profile?.duree_contrat ?? 'peu_importe' as SearchProfile['duree_contrat'],
    type_contrat: profile?.type_contrat ?? [] as string[],
    salaire_min: profile?.salaire_min ?? ('' as number | ''),
  })

  const overlayRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 })
    gsap.fromTo(cardRef.current, { opacity: 0, scale: 0.93, y: 12 }, { opacity: 1, scale: 1, y: 0, duration: 0.28, ease: 'power2.out' })
  }, [])

  const handleClose = () => {
    gsap.to(cardRef.current, { opacity: 0, scale: 0.95, y: 8, duration: 0.18, ease: 'power2.in', onComplete: onClose })
    gsap.to(overlayRef.current, { opacity: 0, duration: 0.18 })
  }

  const toggleContract = (ct: string) =>
    setForm(f => ({
      ...f,
      type_contrat: f.type_contrat.includes(ct)
        ? f.type_contrat.filter(c => c !== ct)
        : [...f.type_contrat, ct],
    }))

  const handleSave = async () => {
    await onSave({
      nom: form.nom,
      localisation: form.localisation,
      rayon_km: Number(form.rayon_km),
      mots_cles: form.mots_cles,
      mots_cles_exclus: form.mots_cles_exclus,
      qualifications: form.qualifications,
      duree_contrat: form.duree_contrat,
      type_contrat: form.type_contrat,
      salaire_min: form.salaire_min !== '' ? Number(form.salaire_min) : null,
    })
    handleClose()
  }

  const inputClass = 'w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10'

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30"
      onClick={e => { if (e.target === overlayRef.current) handleClose() }}
    >
      <div
        ref={cardRef}
        className="w-full max-w-lg rounded-2xl shadow-xl overflow-hidden"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="font-semibold text-base" style={{ color: 'var(--foreground)' }}>
            {profile ? 'Modifier le profil' : 'Nouveau profil'}
          </h2>
          <button
            onClick={handleClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-zinc-100"
            style={{ color: 'var(--muted)' }}
            aria-label="Fermer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Nom */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Nom du profil</label>
            <input
              value={form.nom}
              onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
              placeholder="Ex: Intérim Lille 2026"
              className={inputClass}
            />
          </div>

          {/* Localisation + Rayon */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Localisation</label>
              <input
                value={form.localisation}
                onChange={e => setForm(f => ({ ...f, localisation: e.target.value }))}
                placeholder="Lille"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Rayon (km)</label>
              <input
                type="number" min="0" max="100"
                value={form.rayon_km}
                onChange={e => setForm(f => ({ ...f, rayon_km: Number(e.target.value) }))}
                className={inputClass}
              />
            </div>
          </div>

          {/* Mots-clés */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Mots-clés</label>
            <TagInput
              value={form.mots_cles}
              onChange={v => setForm(f => ({ ...f, mots_cles: v }))}
              suggestions={KW_SUGGESTIONS}
              placeholder="Tapez + Entrée ou virgule..."
              tagColor="indigo"
            />
          </div>

          {/* Mots-clés exclus */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
              Mots-clés à exclure
              <span className="ml-1.5 font-normal" style={{ color: 'var(--muted-light)' }}>(offres contenant ces mots seront ignorées)</span>
            </label>
            <TagInput
              value={form.mots_cles_exclus}
              onChange={v => setForm(f => ({ ...f, mots_cles_exclus: v }))}
              placeholder="Ex: cadre, senior, 5 ans d'expérience..."
              tagColor="blue"
            />
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-xs" style={{ color: 'var(--muted-light)' }}>Ajouter :</span>
              {EXCLUSION_PRESETS.map(({ label, value }) => {
                const active = form.mots_cles_exclus.includes(value)
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setForm(f => ({
                      ...f,
                      mots_cles_exclus: active
                        ? f.mots_cles_exclus.filter(k => k !== value)
                        : [...f.mots_cles_exclus, value],
                    }))}
                    className="px-2 py-0.5 rounded text-xs border transition-colors"
                    style={
                      active
                        ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' }
                        : { borderColor: 'var(--border)', color: 'var(--muted)', background: 'transparent' }
                    }
                  >
                    {active ? '✕ ' : '+ '}{label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Qualifications */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Qualifications</label>
            <TagInput
              value={form.qualifications}
              onChange={v => setForm(f => ({ ...f, qualifications: v }))}
              suggestions={QUAL_SUGGESTIONS}
              placeholder="Ex: CACES 3, Permis B..."
              tagColor="blue"
            />
          </div>

          {/* Durée contrat + Salaire */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Durée de contrat</label>
              <select
                value={form.duree_contrat ?? 'peu_importe'}
                onChange={e => setForm(f => ({ ...f, duree_contrat: e.target.value as SearchProfile['duree_contrat'] }))}
                className={inputClass}
              >
                {DUREE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Salaire min (€/mois)</label>
              <input
                type="number"
                value={form.salaire_min}
                onChange={e => setForm(f => ({ ...f, salaire_min: e.target.value === '' ? '' : Number(e.target.value) }))}
                placeholder="1500"
                className={inputClass}
              />
            </div>
          </div>

          {/* Types de contrat */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>Types de contrat</label>
            <div className="flex flex-wrap gap-2">
              {CONTRACT_TYPES.map(ct => (
                <button
                  key={ct}
                  type="button"
                  onClick={() => toggleContract(ct)}
                  className="px-3 py-1 rounded-full text-xs border transition-colors capitalize"
                  style={
                    form.type_contrat.includes(ct)
                      ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' }
                      : { borderColor: 'var(--border)', color: 'var(--muted)' }
                  }
                >
                  {ct}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 border rounded-lg py-2 text-sm transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
          >
            Annuler
          </button>
          <AsyncButton
            onClick={handleSave}
            loadingLabel="Enregistrement..."
            successLabel="✓ Enregistré"
            className="flex-1 py-2"
          >
            Enregistrer
          </AsyncButton>
        </div>
      </div>
    </div>
  )
}
