'use client'

import { useState, useEffect, useCallback } from 'react'
import type { SearchProfile } from '@/lib/supabase/types'
import { ProfileModal } from '@/components/search/ProfileModal'
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

  if (loading) return <div className="h-64 bg-card rounded-xl animate-pulse" />

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
            ↻ Lancer maintenant
          </AsyncButton>
          <button
            onClick={() => setShowModal(true)}
            className="btn-accent text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            + Nouveau profil
          </button>
        </div>
      </div>

      {fetchResult && (
        <div className="rounded-lg px-4 py-2.5 text-sm border bg-green-50 border-green-200 text-green-700">
          {fetchResult}
        </div>
      )}

      {/* Empty state */}
      {profiles.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <p className="font-medium mb-1" style={{ color: 'var(--foreground)' }}>Aucun profil de recherche</p>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Créez un profil pour commencer à scraper des offres.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {profiles.map(profile => (
            <div key={profile.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium" style={{ color: 'var(--foreground)' }}>{profile.nom || 'Profil sans nom'}</h3>
                    {profile.actif && (
                      <span className="text-xs bg-green-50 border border-green-200 text-green-700 px-2 py-0.5 rounded-full">Actif</span>
                    )}
                  </div>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
                    {profile.localisation} · {profile.rayon_km}km
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
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted-light)' }}>
                      Contrats : {(profile.type_contrat ?? []).join(', ')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleActivate(profile.id, profile.actif)}
                    className="text-xs px-3 py-1.5 rounded-lg border transition-colors"
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
                    className="text-xs px-2 py-1.5 rounded-lg transition-colors hover:bg-zinc-100"
                    style={{ color: 'var(--muted)' }}
                  >
                    Éditer
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(profile.id)}
                    className="text-xs px-2 py-1.5 rounded-lg transition-colors hover:bg-red-50"
                    style={{ color: 'var(--muted)' }}
                  >
                    Sup.
                  </button>
                </div>
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
        <ProfileModal
          onSave={handleCreate}
          onClose={() => setShowModal(false)}
        />
      )}
      {editProfile && (
        <ProfileModal
          profile={editProfile}
          onSave={(data) => handleUpdate(editProfile.id, data)}
          onClose={() => setEditProfile(null)}
        />
      )}
    </div>
  )
}
