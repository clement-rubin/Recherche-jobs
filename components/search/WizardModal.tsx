'use client'

import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import type { SearchProfile, SearchLocation } from '@/lib/supabase/types'
import { AsyncButton } from '@/components/ui/AsyncButton'
import { DOMAIN_SUGGESTIONS, DOMAIN_OPTIONS } from './domainSuggestions'
import { StepIdentite } from './steps/StepIdentite'
import { StepVilles } from './steps/StepVilles'
import { StepMotsClesInclus } from './steps/StepMotsClesInclus'
import { StepMotsClesExclus } from './steps/StepMotsClesExclus'
import { StepQualifications } from './steps/StepQualifications'
import { StepContrat } from './steps/StepContrat'

const STEP_LABELS = ['Identité', 'Villes', 'Mots-clés inclus', 'Mots-clés exclus', 'Qualifications', 'Contrat']

function resolveDomaine(domaineKey: string, domaineAutre: string): string | null {
  if (domaineKey === 'autre') return domaineAutre.trim() || null
  return domaineKey
}

function initDomain(profile: SearchProfile | null | undefined): { domaineKey: string; domaineAutre: string } {
  const domaine = profile?.domaine
  if (domaine && domaine in DOMAIN_SUGGESTIONS) return { domaineKey: domaine, domaineAutre: '' }
  if (!profile) return { domaineKey: DOMAIN_OPTIONS[0].value, domaineAutre: '' }
  return { domaineKey: 'autre', domaineAutre: domaine ?? '' }
}

interface WizardModalProps {
  profile?: SearchProfile | null
  onSave: (data: Partial<SearchProfile>) => Promise<void>
  onClose: () => void
}

export function WizardModal({ profile, onSave, onClose }: WizardModalProps) {
  const { domaineKey: initialDomaineKey, domaineAutre: initialDomaineAutre } = initDomain(profile)

  const [form, setForm] = useState({
    nom: profile?.nom ?? '',
    domaineKey: initialDomaineKey,
    domaineAutre: initialDomaineAutre,
    localisations: profile?.localisations?.length ? profile.localisations : [{ ville: 'Lille', rayon_km: 30, pays: 'FR' } as SearchLocation],
    mots_cles: profile?.mots_cles ?? ['emploi'],
    mots_cles_exclus: profile?.mots_cles_exclus ?? [] as string[],
    qualifications: profile?.qualifications ?? [] as string[],
    duree_contrat: profile?.duree_contrat ?? 'peu_importe' as SearchProfile['duree_contrat'],
    type_contrat: profile?.type_contrat ?? [] as string[],
    salaire_min: profile?.salaire_min ?? ('' as number | ''),
  })

  const [step, setStep] = useState(0)
  const [visited, setVisited] = useState<Set<number>>(
    () => new Set(profile ? [0, 1, 2, 3, 4, 5] : [0])
  )

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

  const patch = (p: Partial<typeof form>) => setForm(f => ({ ...f, ...p }))

  const isStepValid = (s: number): boolean => {
    if (s === 0) {
      return form.nom.trim().length > 0
    }
    if (s === 1) {
      return form.localisations.some(l => l.ville.trim().length > 0)
    }
    return true
  }

  const goNext = () => {
    if (!isStepValid(step)) return
    const next = step + 1
    setStep(next)
    setVisited(v => new Set(v).add(next))
  }

  const goTo = (target: number) => {
    if (!visited.has(target)) return
    setStep(target)
  }

  const handleSave = async () => {
    await onSave({
      nom: form.nom,
      domaine: resolveDomaine(form.domaineKey, form.domaineAutre),
      localisations: form.localisations.filter(l => l.ville.trim().length > 0),
      mots_cles: form.mots_cles,
      mots_cles_exclus: form.mots_cles_exclus,
      qualifications: form.qualifications,
      duree_contrat: form.duree_contrat,
      type_contrat: form.type_contrat,
      salaire_min: form.salaire_min !== '' ? Number(form.salaire_min) : null,
    })
    handleClose()
  }

  const isLastStep = step === STEP_LABELS.length - 1

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

        <div className="flex items-center gap-1.5 px-6 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          {STEP_LABELS.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => goTo(i)}
              disabled={!visited.has(i)}
              aria-label={`Étape ${i + 1} : ${label}`}
              aria-current={i === step ? 'step' : undefined}
              className="flex-1 h-1.5 rounded-full transition-colors disabled:cursor-not-allowed"
              style={{ background: i === step ? 'var(--accent)' : visited.has(i) ? 'var(--accent-dim)' : 'var(--border)' }}
            />
          ))}
        </div>

        <div className="px-4 sm:px-6 py-5 max-h-[70vh] overflow-y-auto">
          <p className="text-xs font-medium mb-4" style={{ color: 'var(--muted-light)' }}>
            Étape {step + 1}/{STEP_LABELS.length} — {STEP_LABELS[step]}
          </p>
          {step === 0 && (
            <StepIdentite
              nom={form.nom}
              domaineKey={form.domaineKey}
              domaineAutre={form.domaineAutre}
              onChange={patch}
            />
          )}
          {step === 1 && (
            <StepVilles
              value={form.localisations}
              onChange={v => patch({ localisations: v })}
            />
          )}
          {step === 2 && (
            <StepMotsClesInclus
              value={form.mots_cles}
              onChange={v => patch({ mots_cles: v })}
              domaineKey={form.domaineKey}
              conflictsWith={form.mots_cles_exclus}
            />
          )}
          {step === 3 && (
            <StepMotsClesExclus
              value={form.mots_cles_exclus}
              onChange={v => patch({ mots_cles_exclus: v })}
              domaineKey={form.domaineKey}
              conflictsWith={form.mots_cles}
            />
          )}
          {step === 4 && (
            <StepQualifications
              value={form.qualifications}
              onChange={v => patch({ qualifications: v })}
              domaineKey={form.domaineKey}
            />
          )}
          {step === 5 && (
            <StepContrat
              typeContrat={form.type_contrat}
              dureeContrat={form.duree_contrat}
              salaireMin={form.salaire_min}
              onChange={patch}
            />
          )}
        </div>

        <div className="flex gap-3 px-6 py-4" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={step === 0 ? handleClose : () => setStep(step - 1)}
            className="flex-1 border rounded-lg py-2 text-sm transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
          >
            {step === 0 ? 'Annuler' : 'Précédent'}
          </button>
          {isLastStep ? (
            <AsyncButton
              onClick={handleSave}
              loadingLabel="Enregistrement..."
              successLabel="✓ Enregistré"
              className="flex-1 py-2"
              disabled={!isStepValid(0) || !isStepValid(1)}
            >
              Enregistrer
            </AsyncButton>
          ) : (
            <button
              type="button"
              onClick={goNext}
              disabled={!isStepValid(step)}
              className="btn-accent text-white text-sm font-medium flex-1 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Suivant
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
