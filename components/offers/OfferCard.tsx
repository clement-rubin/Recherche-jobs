'use client'

import { useState } from 'react'
import type { Offer } from '@/lib/supabase/types'
import { InlineConfirm } from '@/components/ui/InlineConfirm'
import { OfferDetailModal } from './OfferDetailModal'
import { sourceLabel } from '@/lib/offers/sources'

interface Props {
  offer: Offer
  onAction: (id: string, action: 'postule' | 'ignore' | 'sauvegarde') => Promise<void>
}

export function OfferCard({ offer, onAction }: Props) {
  const [confirmIgnore, setConfirmIgnore] = useState(false)
  const [showDetail, setShowDetail] = useState(false)

  return (
    <>
      <div
        className="rounded-[var(--r-xl)] p-4 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.99] active:translate-y-0"
        style={{
          background: 'var(--card-gradient)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-sm)',
        }}
        onClick={() => setShowDetail(true)}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)' }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>{offer.titre}</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
              {offer.entreprise && <span className="font-medium" style={{ color: 'var(--foreground-dim)' }}>{offer.entreprise}</span>}
              {offer.entreprise && offer.localisation && ' · '}
              {offer.localisation}
            </p>
            <div className="flex items-center gap-3 mt-2">
              {offer.type_contrat && (
                <span className="text-xs capitalize" style={{ color: 'var(--muted-light)' }}>{offer.type_contrat}</span>
              )}
              {(offer.salaire_min || offer.salaire_max) && (
                <span className="text-xs font-medium" style={{ color: 'var(--success)' }}>
                  {offer.salaire_min && `${offer.salaire_min.toLocaleString('fr-FR')}€`}
                  {offer.salaire_min && offer.salaire_max && ' – '}
                  {offer.salaire_max && `${offer.salaire_max.toLocaleString('fr-FR')}€`}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <span
              className="text-xs px-2 py-0.5 rounded border"
              style={{ background: 'var(--accent-surface)', color: 'var(--accent)', borderColor: 'var(--accent-border)' }}
            >
              {sourceLabel(offer.source)}
            </span>
            <span className="text-xs" style={{ color: 'var(--muted-light)' }}>Voir détails →</span>
          </div>
        </div>

        <div
          className="flex gap-2 mt-4 pt-3"
          style={{ borderTop: '1px solid var(--border)' }}
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => onAction(offer.id, 'postule')}
            className="flex-1 text-white text-xs font-medium py-2 rounded-[var(--r-lg)] transition-colors btn-accent min-h-[36px]"
          >
            Postuler
          </button>
          <button
            onClick={() => onAction(offer.id, 'sauvegarde')}
            className="flex-1 text-xs py-2 rounded-[var(--r-lg)] transition-colors border min-h-[36px]"
            style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-border)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
          >
            Sauvegarder
          </button>
          <button
            onClick={() => setConfirmIgnore(true)}
            className="px-3 text-xs py-2 rounded-[var(--r-lg)] transition-colors min-h-[36px]"
            style={{ color: 'var(--muted-light)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--foreground)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted-light)' }}
          >
            Ignorer
          </button>
        </div>

        {confirmIgnore && (
          <div className="mt-2" onClick={e => e.stopPropagation()}>
            <InlineConfirm
              visible={confirmIgnore}
              message="Ignorer cette offre ?"
              confirmLabel="Ignorer"
              onConfirm={() => { setConfirmIgnore(false); onAction(offer.id, 'ignore') }}
              onCancel={() => setConfirmIgnore(false)}
            />
          </div>
        )}
      </div>

      {showDetail && (
        <OfferDetailModal
          offer={offer}
          onAction={onAction}
          onClose={() => setShowDetail(false)}
        />
      )}
    </>
  )
}
