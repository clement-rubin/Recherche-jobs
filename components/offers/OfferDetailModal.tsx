'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import type { Offer } from '@/lib/supabase/types'
import { InlineConfirm } from '@/components/ui/InlineConfirm'
import { useState } from 'react'

const SOURCE_LABELS: Record<string, string> = {
  jsearch: 'JSearch',
  apec: 'APEC',
  hellowork: 'HelloWork',
  france_travail: 'France Travail',
  email: 'Email',
}

interface Props {
  offer: Offer
  onAction: (id: string, action: 'postule' | 'ignore' | 'sauvegarde') => Promise<void>
  onClose: () => void
}

function extractRaw(raw: Record<string, unknown> | null) {
  if (!raw) return {}
  return {
    description:   raw.job_description as string | undefined,
    experience:    raw.job_required_experience as Record<string, unknown> | undefined,
    education:     raw.job_required_education as Record<string, unknown> | undefined,
    benefits:      raw.job_benefits as string | undefined,
    remote:        raw.job_is_remote as boolean | undefined,
    posted:        raw.job_posted_at_datetime_utc as string | undefined,
    publisher:     raw.job_publisher as string | undefined,
    employerLogo:  raw.employer_logo as string | undefined,
    highlights:    raw.job_highlights as Record<string, string[]> | undefined,
  }
}

export function OfferDetailModal({ offer, onAction, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [confirmIgnore, setConfirmIgnore] = useState(false)

  const raw = extractRaw(offer.raw_data)

  useEffect(() => {
    gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 })
    gsap.fromTo(cardRef.current, { opacity: 0, scale: 0.94, y: 14 }, { opacity: 1, scale: 1, y: 0, duration: 0.28, ease: 'power2.out' })
  }, [])

  const handleClose = () => {
    gsap.to(cardRef.current, { opacity: 0, scale: 0.95, y: 8, duration: 0.18, ease: 'power2.in', onComplete: onClose })
    gsap.to(overlayRef.current, { opacity: 0, duration: 0.18 })
  }

  const handleAction = async (action: 'postule' | 'ignore' | 'sauvegarde') => {
    await onAction(offer.id, action)
    handleClose()
  }

  const expYears = raw.experience?.required_experience_in_months
    ? Math.round((raw.experience.required_experience_in_months as number) / 12)
    : null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30"
      onClick={e => { if (e.target === overlayRef.current) handleClose() }}
    >
      <div
        ref={cardRef}
        className="w-full max-w-2xl rounded-2xl shadow-xl flex flex-col"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-start gap-4 px-6 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
          {raw.employerLogo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={raw.employerLogo} alt="" className="w-10 h-10 rounded-lg object-contain flex-shrink-0 border" style={{ borderColor: 'var(--border)' }} />
          )}
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-base leading-snug" style={{ color: 'var(--foreground)' }}>{offer.titre}</h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
              {offer.entreprise && <span className="font-medium" style={{ color: 'var(--foreground-dim)' }}>{offer.entreprise}</span>}
              {offer.entreprise && offer.localisation && ' · '}
              {offer.localisation}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors hover:bg-zinc-100"
            style={{ color: 'var(--muted)' }}
            aria-label="Fermer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Meta pills */}
        <div className="px-6 py-3 flex flex-wrap gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
          {offer.type_contrat && (
            <span className="text-xs px-2.5 py-1 rounded-full border capitalize" style={{ borderColor: 'var(--border)', color: 'var(--foreground-dim)', background: 'var(--background)' }}>
              {offer.type_contrat}
            </span>
          )}
          {(offer.salaire_min || offer.salaire_max) && (
            <span className="text-xs px-2.5 py-1 rounded-full border font-medium" style={{ borderColor: 'rgba(22,163,74,0.3)', color: 'var(--success)', background: 'rgba(22,163,74,0.06)' }}>
              {offer.salaire_min && `${offer.salaire_min.toLocaleString('fr-FR')}€`}
              {offer.salaire_min && offer.salaire_max && ' – '}
              {offer.salaire_max && `${offer.salaire_max.toLocaleString('fr-FR')}€`}
            </span>
          )}
          {raw.remote === true && (
            <span className="text-xs px-2.5 py-1 rounded-full border" style={{ borderColor: 'rgba(99,102,241,0.3)', color: 'var(--accent)', background: 'var(--accent-surface)' }}>
              Télétravail
            </span>
          )}
          {expYears !== null && (
            <span className="text-xs px-2.5 py-1 rounded-full border" style={{ borderColor: 'var(--border)', color: 'var(--muted)', background: 'var(--background)' }}>
              {expYears === 0 ? 'Débutant accepté' : `${expYears} ans d'expérience`}
            </span>
          )}
          <span className="text-xs px-2.5 py-1 rounded-full border ml-auto" style={{ background: 'var(--accent-surface)', color: 'var(--accent)', borderColor: 'rgba(99,102,241,0.2)' }}>
            {SOURCE_LABELS[offer.source ?? ''] ?? offer.source ?? 'Inconnu'}
          </span>
          {raw.posted && (
            <span className="text-xs px-2.5 py-1 rounded-full border" style={{ borderColor: 'var(--border)', color: 'var(--muted-light)', background: 'var(--background)' }}>
              {new Date(raw.posted).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          )}
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Highlights (JSearch) */}
          {raw.highlights && Object.keys(raw.highlights).length > 0 && (
            <div className="space-y-3">
              {Object.entries(raw.highlights).map(([section, items]) => (
                Array.isArray(items) && items.length > 0 ? (
                  <div key={section}>
                    <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--muted)' }}>{section}</h3>
                    <ul className="space-y-1">
                      {items.map((item, i) => (
                        <li key={i} className="flex gap-2 text-sm" style={{ color: 'var(--foreground-dim)' }}>
                          <span className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0" style={{ background: 'var(--accent)' }} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null
              ))}
            </div>
          )}

          {/* Description */}
          {raw.description && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--muted)' }}>Description</h3>
              <div
                className="text-sm leading-relaxed whitespace-pre-wrap"
                style={{ color: 'var(--foreground-dim)' }}
              >
                {raw.description.length > 2000
                  ? raw.description.slice(0, 2000) + '…'
                  : raw.description}
              </div>
            </div>
          )}

          {/* Benefits */}
          {raw.benefits && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--muted)' }}>Avantages</h3>
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--foreground-dim)' }}>{raw.benefits}</p>
            </div>
          )}

          {/* Education */}
          {raw.education && (raw.education.required_credential as string[] | undefined)?.length ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--muted)' }}>Formation requise</h3>
              <p className="text-sm" style={{ color: 'var(--foreground-dim)' }}>
                {(raw.education.required_credential as string[]).join(', ')}
              </p>
            </div>
          ) : null}

          {/* No description fallback */}
          {!raw.description && !raw.highlights && (
            <p className="text-sm italic" style={{ color: 'var(--muted)' }}>Aucune description disponible pour cette source.</p>
          )}

          {offer.lien && (
            <a
              href={offer.lien}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
              style={{ color: 'var(--accent)' }}
            >
              Voir l&apos;offre complète →
            </a>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 space-y-2" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="flex gap-2">
            <button
              onClick={() => handleAction('postule')}
              className="flex-1 text-white text-sm font-medium py-2 rounded-lg transition-colors btn-accent"
            >
              Postuler
            </button>
            <button
              onClick={() => handleAction('sauvegarde')}
              className="flex-1 text-sm py-2 rounded-lg transition-colors border"
              style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
            >
              Sauvegarder
            </button>
            <button
              onClick={() => setConfirmIgnore(true)}
              className="px-4 text-sm py-2 rounded-lg transition-colors"
              style={{ color: 'var(--muted-light)' }}
            >
              Ignorer
            </button>
          </div>
          <InlineConfirm
            visible={confirmIgnore}
            message="Ignorer cette offre ?"
            confirmLabel="Ignorer"
            onConfirm={() => handleAction('ignore')}
            onCancel={() => setConfirmIgnore(false)}
          />
        </div>
      </div>
    </div>
  )
}
