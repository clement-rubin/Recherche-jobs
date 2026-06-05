'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Offer, OfferStatus } from '@/lib/supabase/types'
import { OfferCard } from '@/components/offers/OfferCard'
import { InlineConfirm } from '@/components/ui/InlineConfirm'
import { SwipeDeck } from '@/components/offers/SwipeDeck'
import { ViewToggle } from '@/components/offers/ViewToggle'

const STATUS_FILTERS: { value: OfferStatus | ''; label: string }[] = [
  { value: '', label: 'À traiter' },
  { value: 'non_traite', label: 'Non traités' },
  { value: 'sauvegarde', label: 'Sauvegardés' },
  { value: 'postule', label: 'Postulés' },
  { value: 'ignore', label: 'Ignorés' },
]

const SOURCE_FILTERS = [
  { value: '', label: 'Toutes sources' },
  { value: 'jsearch', label: 'JSearch' },
  { value: 'apec', label: 'APEC' },
  { value: 'hellowork', label: 'HelloWork' },
  { value: 'france_travail', label: 'France Travail' },
  { value: 'email', label: 'Email' },
]

export default function OffersPage() {
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<OfferStatus | ''>('')
  const [filterSource, setFilterSource] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'swipe'>('list')

  useEffect(() => {
    const stored = localStorage.getItem('offers-view-mode') as 'list' | 'swipe' | null
    if (stored) {
      setViewMode(stored)
    } else {
      setViewMode(window.innerWidth < 1024 ? 'swipe' : 'list')
    }
  }, [])

  const handleViewModeChange = (mode: 'list' | 'swipe') => {
    setViewMode(mode)
    localStorage.setItem('offers-view-mode', mode)
  }

  const fetchOffers = useCallback(async () => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    params.set('statut', filterStatus || 'non_traite')
    if (filterSource) params.set('source', filterSource)

    const res = await fetch(`/api/offers?${params}`)
    if (!res.ok) {
      setError('Impossible de charger les offres')
      setLoading(false)
      return
    }
    setOffers(await res.json())
    setLoading(false)
  }, [filterStatus, filterSource])

  useEffect(() => { fetchOffers() }, [fetchOffers])

  const handleAction = async (id: string, action: 'postule' | 'ignore' | 'sauvegarde') => {
    const patchRes = await fetch(`/api/offers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: action }),
    })
    if (!patchRes.ok) return

    if (action === 'postule') {
      const offer = offers.find(o => o.id === id)
      if (offer) {
        await fetch('/api/applications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entreprise: offer.entreprise ?? 'Inconnu',
            poste: offer.titre,
            lien_offre: offer.lien,
            type_contrat: offer.type_contrat,
            source: offer.source ?? 'scraping',
          }),
        })
      }
    }

    setOffers(prev => prev.filter(o => o.id !== id))
  }

  const handleClearAll = async () => {
    const statut = filterStatus || 'non_traite'
    const res = await fetch(`/api/offers?statut=${statut}`, { method: 'DELETE' })
    if (res.ok) {
      setOffers([])
      setConfirmClear(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded animate-pulse" style={{ background: 'var(--card)' }} />
        {[1, 2, 3].map(i => <div key={i} className="h-36 rounded-xl animate-pulse" style={{ background: 'var(--card)' }} />)}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Offres à traiter</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{offers.length} offre{offers.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2 mt-1 flex-shrink-0">
          <ViewToggle mode={viewMode} onChange={handleViewModeChange} />
          {offers.length > 0 && viewMode === 'list' && (
            <button
              onClick={() => setConfirmClear(true)}
              className="text-xs px-3 py-1.5 rounded-lg border transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
            >
              Tout ignorer
            </button>
          )}
        </div>
      </div>
      {confirmClear && (
        <InlineConfirm
          visible
          message={`Ignorer toutes les offres affichées (${offers.length}) ?`}
          confirmLabel="Tout ignorer"
          onConfirm={handleClearAll}
          onCancel={() => setConfirmClear(false)}
        />
      )}

      {/* Pill filters */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilterStatus(f.value as OfferStatus | '')}
              className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
              style={
                filterStatus === f.value
                  ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' }
                  : { borderColor: 'var(--border)', color: 'var(--muted)', background: 'var(--card)' }
              }
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {SOURCE_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilterSource(f.value)}
              className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
              style={
                filterSource === f.value
                  ? { background: 'var(--foreground)', borderColor: 'var(--foreground)', color: '#fff' }
                  : { borderColor: 'var(--border)', color: 'var(--muted)', background: 'var(--card)' }
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg px-4 py-3 text-sm border bg-red-50 border-red-200 text-red-700">{error}</div>
      )}

      {offers.length === 0 && viewMode === 'list' ? (
        <div className="rounded-xl p-12 text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <p className="font-medium mb-1" style={{ color: 'var(--foreground)' }}>Aucune offre</p>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Les offres apparaîtront ici après synchronisation ou recherche manuelle.</p>
        </div>
      ) : viewMode === 'swipe' ? (
        <SwipeDeck
          offers={offers}
          onAction={handleAction}
          onNeedMore={fetchOffers}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {offers.map(offer => (
            <OfferCard key={offer.id} offer={offer} onAction={handleAction} />
          ))}
        </div>
      )}
    </div>
  )
}
