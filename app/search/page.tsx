'use client'

import { useState, useEffect, useCallback } from 'react'
import type { SearchProfile } from '@/lib/supabase/types'
import { WizardModal } from '@/components/search/WizardModal'
import { DOMAIN_LABELS } from '@/components/search/domainSuggestions'
import { EUROPE_COUNTRIES } from '@/components/search/countries'
import { AsyncButton } from '@/components/ui/AsyncButton'
import { InlineConfirm } from '@/components/ui/InlineConfirm'

export default function SearchPage() {
  const [profiles, setProfiles] = useState<SearchProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editProfile, setEditProfile] = useState<SearchProfile | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [fetchResult, setFetchResult] = useState<string | null>(null)

  const loadProfiles = useCallback(async () => {
    const res = await fetch('/api/search-profiles')
    if (res.ok) setProfiles(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { loadProfiles() }, [loadProfiles])

  const handleCreate = async (data: Partial<SearchProfile>) => {
    const res = await fetch('/api/search-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Échec création')
    await loadProfiles()
    setShowModal(false)
  }

  const handleUpdate = async (id: string, data: Partial<SearchProfile>) => {
    const res = await fetch(`/api/search-profiles/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Échec mise à jour')
    await loadProfiles()
    setEditProfile(null)
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/search-profiles/${id}`, { method: 'DELETE' })
    setProfiles(prev => prev.filter(p => p.id !== id))
    setDeleteConfirmId(null)
  }

  const handleActivate = (id: string, current: boolean) => handleUpdate(id, { actif: !current })

  const handleFetchNow = async () => {
    setFetchResult(null)
    const res = await fetch('/api/jobs/fetch', { method: 'POST' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Erreur')
    setFetchResult(`✓ ${data.fetched?.inserted ?? 0} offres ajoutées`)
  }

  if (loading) return <div className="h-64 animate-pulse rounded-[var(--r-xl)]" style={{ background: 'var(--card)' }} />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Recherche</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Configurez vos profils de recherche d&apos;emploi</p>
        </div>
        <div className="flex gap-3">
          <AsyncButton
            onClick={handleFetchNow}
            variant="secondary"
            loadingLabel="Recherche..."
            successLabel="✓ Terminé"
            errorLabel="✕ Échec"
          >
            <span className="sm:hidden">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 4v6h6M20 20v-6h-6M20 9a8 8 0 00-14.9-3M4 15a8 8 0 0014.9 3"/></svg>
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 4v6h6M20 20v-6h-6M20 9a8 8 0 00-14.9-3M4 15a8 8 0 0014.9 3"/></svg>
              Lancer maintenant
            </span>
          </AsyncButton>
          <button
            onClick={() => setShowModal(true)}
            className="btn-accent text-white text-sm font-medium px-4 py-2 rounded-lg inline-flex items-center gap-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 4v16m8-8H4"/></svg>
            Nouveau profil
          </button>
        </div>
      </div>

      {fetchResult && (
        <div className="rounded-lg px-4 py-2.5 text-sm border" style={{ background: 'var(--success-surface)', borderColor: 'var(--success-border)', color: 'var(--success-text)' }}>
          {fetchResult}
        </div>
      )}

      {/* Empty state */}
      {profiles.length === 0 ? (
        <div className="border rounded-[var(--r-xl)] p-12 text-center" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <p className="font-medium mb-1" style={{ color: 'var(--foreground)' }}>Aucun profil de recherche</p>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Créez un profil pour commencer à scraper des offres.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {profiles.map(profile => (
            <div
              key={profile.id}
              className="border rounded-[var(--r-xl)] p-4 space-y-3 transition-shadow duration-200 hover:shadow-md"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              {/* Info — full width */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-medium" style={{ color: 'var(--foreground)' }}>
                    {profile.nom || 'Profil sans nom'}
                  </h3>
                  {profile.domaine && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-surface)', color: 'var(--accent)' }}>
                      {DOMAIN_LABELS[profile.domaine] ?? profile.domaine}
                    </span>
                  )}
                  {profile.actif && (
                    <span className="text-xs border px-2 py-0.5 rounded-full" style={{ background: 'var(--success-surface)', borderColor: 'var(--success-border)', color: 'var(--success-text)' }}>
                      Actif
                    </span>
                  )}
                </div>
                <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
                  {(profile.localisations ?? []).map(l => {
                    if (!l.pays || l.pays.toUpperCase() === 'FR') return `${l.ville} (${l.rayon_km}km)`
                    const country = EUROPE_COUNTRIES.find(c => c.code.toUpperCase() === l.pays!.toUpperCase())
                    return country ? `${l.ville}, ${country.label}` : `${l.ville}, ${l.pays}`
                  }).join(', ')}
                </p>
                {(profile.mots_cles ?? []).length > 0 && (
                  <p className="text-xs mt-1" style={{ color: 'var(--muted-light)' }}>
                    Mots-clés : {(profile.mots_cles ?? []).join(', ')}
                  </p>
                )}
                {(profile.qualifications ?? []).length > 0 && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted-light)' }}>
                    Qualifications : {(profile.qualifications ?? []).join(', ')}
                  </p>
                )}
                {(profile.type_contrat ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(profile.type_contrat ?? []).map(ct => (
                      <span
                        key={ct}
                        className="text-xs px-2 py-0.5 rounded capitalize"
                        style={{ background: 'var(--accent-surface)', color: 'var(--accent)' }}
                      >
                        {ct}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Action buttons — 36px touch targets */}
              <div className="flex items-center gap-2 border-t pt-1" style={{ borderColor: 'var(--border)' }}>
                <button
                  onClick={() => handleActivate(profile.id, profile.actif)}
                  className="flex-1 text-xs px-3 py-2.5 rounded-lg border transition-colors min-h-[36px]"
                  style={
                    profile.actif
                      ? { borderColor: 'var(--border)', color: 'var(--muted)' }
                      : { borderColor: 'var(--accent)', color: 'var(--accent)' }
                  }
                >
                  {profile.actif ? 'Désactiver' : 'Activer'}
                </button>
                <button
                  onClick={() => setEditProfile(profile)}
                  className="text-xs px-3 py-2.5 rounded-lg min-h-[36px]"
                  style={{ color: 'var(--muted)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '' }}
                >
                  Éditer
                </button>
                <button
                  onClick={() => setDeleteConfirmId(profile.id)}
                  className="text-xs px-3 py-2.5 rounded-lg min-h-[36px] flex items-center justify-center"
                  style={{ color: 'var(--muted)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-surface)'; e.currentTarget.style.color = 'var(--danger)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--muted)' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>

              <InlineConfirm
                visible={deleteConfirmId === profile.id}
                message="Supprimer ce profil ?"
                confirmLabel="Supprimer"
                onConfirm={() => handleDelete(profile.id)}
                onCancel={() => setDeleteConfirmId(null)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <WizardModal
          onSave={handleCreate}
          onClose={() => setShowModal(false)}
        />
      )}
      {editProfile && (
        <WizardModal
          profile={editProfile}
          onSave={(data) => handleUpdate(editProfile.id, data)}
          onClose={() => setEditProfile(null)}
        />
      )}
    </div>
  )
}
