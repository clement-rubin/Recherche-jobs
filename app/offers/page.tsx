'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Offer, OfferStatus } from '@/lib/supabase/types'
import { OfferCard } from '@/components/offers/OfferCard'

const STATUS_FILTER_OPTIONS: { value: OfferStatus | ''; label: string }[] = [
  { value: '', label: 'À traiter' },
  { value: 'non_traite', label: 'Non traités' },
  { value: 'sauvegarde', label: 'Sauvegardés' },
  { value: 'postule', label: 'Postulés' },
  { value: 'ignore', label: 'Ignorés' },
]

const SOURCE_OPTIONS = [
  { value: '', label: 'Toutes les sources' },
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

  const fetchOffers = useCallback(async () => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    // Default: show non_traite only (the "to process" view)
    const statusToFetch = filterStatus || 'non_traite'
    params.set('statut', statusToFetch)
    if (filterSource) params.set('source', filterSource)

    const res = await fetch(`/api/offers?${params}`)
    if (!res.ok) {
      setError('Impossible de charger les offres')
      setLoading(false)
      return
    }
    const data = await res.json()
    setOffers(data)
    setLoading(false)
  }, [filterStatus, filterSource])

  useEffect(() => {
    fetchOffers()
  }, [fetchOffers])

  const handleAction = async (id: string, action: 'postule' | 'ignore' | 'sauvegarde') => {
    // Update offer status
    const patchRes = await fetch(`/api/offers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: action }),
    })
    if (!patchRes.ok) return

    // If postule → also create an application
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

    // Remove from current view
    setOffers(prev => prev.filter(o => o.id !== id))
  }

  const nonTraiteCount = offers.length

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-card rounded animate-pulse" />
        {[1, 2, 3].map(i => <div key={i} className="h-36 bg-card rounded-xl animate-pulse" />)}
      </div>
    )
  }

  const selectClass = "bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Offres à traiter</h1>
        <p className="text-muted text-sm mt-1">{nonTraiteCount} offre{nonTraiteCount !== 1 ? 's' : ''}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as OfferStatus | '')} className={selectClass}>
          {STATUS_FILTER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className={selectClass}>
          {SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>
      )}

      {offers.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <p className="text-foreground font-medium mb-1">Aucune offre</p>
          <p className="text-muted text-sm">Les offres apparaîtront ici après la synchronisation des emails ou une recherche manuelle.</p>
        </div>
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
