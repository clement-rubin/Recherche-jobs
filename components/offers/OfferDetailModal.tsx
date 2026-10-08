'use client'

import { useState } from 'react'
import type { Offer } from '@/lib/supabase/types'
import { InlineConfirm } from '@/components/ui/InlineConfirm'
import { Modal } from '@/components/ui/Modal'
import { sourceLabel } from '@/lib/offers/sources'

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
  const [confirmIgnore, setConfirmIgnore] = useState(false)

  const raw = extractRaw(offer.raw_data)

  const handleAction = async (action: 'postule' | 'ignore' | 'sauvegarde') => {
    await onAction(offer.id, action)
    onClose()
  }

  const expYears = raw.experience?.required_experience_in_months
    ? Math.round((raw.experience.required_experience_in_months as number) / 12)
    : null

  const footer = (
    <div className="w-full space-y-2">
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
  )

  return (
    <Modal title={offer.titre} onClose={onClose} footer={footer} className="sm:max-w-2xl">
      {/* Meta pills */}
      <div className="flex flex-wrap gap-2 pb-4 mb-5" style={{ borderBottom: '1px solid var(--border)' }}>
        {offer.type_contrat && (
          <span className="text-xs px-2.5 py-1 rounded-full border capitalize" style={{ borderColor: 'var(--border)', color: 'var(--foreground-dim)', background: 'var(--background)' }}>
            {offer.type_contrat}
          </span>
        )}
        {(offer.salaire_min || offer.salaire_max) && (
          <span className="text-xs px-2.5 py-1 rounded-full border font-medium" style={{ borderColor: 'var(--success-border)', color: 'var(--success)', background: 'var(--success-surface)' }}>
            {offer.salaire_min && `${offer.salaire_min.toLocaleString('fr-FR')}€`}
            {offer.salaire_min && offer.salaire_max && ' – '}
            {offer.salaire_max && `${offer.salaire_max.toLocaleString('fr-FR')}€`}
          </span>
        )}
        {raw.remote === true && (
          <span className="text-xs px-2.5 py-1 rounded-full border" style={{ borderColor: 'var(--accent-border)', color: 'var(--accent)', background: 'var(--accent-surface)' }}>
            Télétravail
          </span>
        )}
        {expYears !== null && (
          <span className="text-xs px-2.5 py-1 rounded-full border" style={{ borderColor: 'var(--border)', color: 'var(--muted)', background: 'var(--background)' }}>
            {expYears === 0 ? 'Débutant accepté' : `${expYears} ans d'expérience`}
          </span>
        )}
        <span className="text-xs px-2.5 py-1 rounded-full border ml-auto" style={{ background: 'var(--accent-surface)', color: 'var(--accent)', borderColor: 'var(--accent-border)' }}>
          {sourceLabel(offer.source)}
        </span>
        {raw.posted && (
          <span className="text-xs px-2.5 py-1 rounded-full border" style={{ borderColor: 'var(--border)', color: 'var(--muted-light)', background: 'var(--background)' }}>
            {new Date(raw.posted).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        )}
      </div>

      {/* Employer logo + company/location */}
      {(raw.employerLogo || offer.entreprise || offer.localisation) && (
        <div className="flex items-center gap-3 mb-5">
          {raw.employerLogo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={raw.employerLogo} alt="" className="w-10 h-10 rounded-lg object-contain flex-shrink-0 border" style={{ borderColor: 'var(--border)' }} />
          )}
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {offer.entreprise && <span className="font-medium" style={{ color: 'var(--foreground-dim)' }}>{offer.entreprise}</span>}
            {offer.entreprise && offer.localisation && ' · '}
            {offer.localisation}
          </p>
        </div>
      )}

      {/* Content sections */}
      <div className="space-y-5">
        {/* Highlights (JSearch) */}
        {raw.highlights && Object.keys(raw.highlights).length > 0 && (
          <div className="space-y-3">
            {Object.entries(raw.highlights).map(([section, items]) => (
              Array.isArray(items) && items.length > 0 ? (
                <div key={section}>
                  <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>{section}</h3>
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
            <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>Description</h3>
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
            <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>Avantages</h3>
            <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--foreground-dim)' }}>{raw.benefits}</p>
          </div>
        )}

        {/* Education */}
        {raw.education && (raw.education.required_credential as string[] | undefined)?.length ? (
          <div>
            <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>Formation requise</h3>
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
    </Modal>
  )
}
