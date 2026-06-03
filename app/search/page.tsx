'use client'

import { useState, useEffect, useCallback } from 'react'
import type { SearchProfile } from '@/lib/supabase/types'

const CONTRACT_TYPES = ['interim', 'stage', 'cdi', 'cdd', 'alternance']

function ProfileForm({
  profile,
  onSave,
  onCancel,
}: {
  profile?: SearchProfile | null
  onSave: (data: Partial<SearchProfile>) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    nom: profile?.nom ?? '',
    localisation: profile?.localisation ?? 'Lille',
    rayon_km: profile?.rayon_km ?? 30,
    mots_cles: (profile?.mots_cles ?? ['emploi']).join(', '),
    type_contrat: profile?.type_contrat ?? [] as string[],
    salaire_min: profile?.salaire_min ?? '',
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await onSave({
      nom: form.nom,
      localisation: form.localisation,
      rayon_km: Number(form.rayon_km),
      mots_cles: form.mots_cles.split(',').map(k => k.trim()).filter(Boolean),
      type_contrat: form.type_contrat,
      salaire_min: form.salaire_min ? Number(form.salaire_min) : null,
    })
    setSaving(false)
  }

  const toggleContract = (ct: string) => {
    setForm(f => ({
      ...f,
      type_contrat: f.type_contrat.includes(ct)
        ? f.type_contrat.filter(c => c !== ct)
        : [...f.type_contrat, ct],
    }))
  }

  const inputClass = "w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-accent"

  return (
    <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-4 space-y-4">
      <h3 className="text-foreground font-semibold">{profile ? 'Modifier le profil' : 'Nouveau profil'}</h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-muted text-xs mb-1">Nom du profil</label>
          <input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder="Ex: Intérim Lille 2026" className={inputClass} />
        </div>
        <div>
          <label className="block text-muted text-xs mb-1">Localisation</label>
          <input value={form.localisation} onChange={e => setForm(f => ({ ...f, localisation: e.target.value }))} placeholder="Lille" className={inputClass} />
        </div>
        <div>
          <label className="block text-muted text-xs mb-1">Rayon (km)</label>
          <input type="number" min="0" max="100" value={form.rayon_km} onChange={e => setForm(f => ({ ...f, rayon_km: Number(e.target.value) }))} className={inputClass} />
        </div>
        <div className="col-span-2">
          <label className="block text-muted text-xs mb-1">Mots-clés (séparés par virgules)</label>
          <input value={form.mots_cles} onChange={e => setForm(f => ({ ...f, mots_cles: e.target.value }))} placeholder="magasinier, logistique, entrepôt" className={inputClass} />
        </div>
        <div className="col-span-2">
          <label className="block text-muted text-xs mb-2">Types de contrat</label>
          <div className="flex flex-wrap gap-2">
            {CONTRACT_TYPES.map(ct => (
              <button
                key={ct}
                type="button"
                onClick={() => toggleContract(ct)}
                className={`px-3 py-1 rounded-full text-xs border transition-colors capitalize ${
                  form.type_contrat.includes(ct)
                    ? 'bg-accent border-accent text-white'
                    : 'border-border text-muted hover:border-foreground/30 hover:text-foreground'
                }`}
              >
                {ct}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-muted text-xs mb-1">Salaire min (€/mois)</label>
          <input type="number" value={form.salaire_min} onChange={e => setForm(f => ({ ...f, salaire_min: e.target.value }))} placeholder="1500" className={inputClass} />
        </div>
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 border border-border text-muted hover:text-foreground py-2 rounded-lg text-sm">Annuler</button>
        <button type="submit" disabled={saving} className="flex-1 bg-accent hover:bg-indigo-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </form>
  )
}

export default function SearchPage() {
  const [profiles, setProfiles] = useState<SearchProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editProfile, setEditProfile] = useState<SearchProfile | null>(null)
  const [fetching, setFetching] = useState(false)
  const [fetchResult, setFetchResult] = useState<string | null>(null)

  const loadProfiles = useCallback(async () => {
    const res = await fetch('/api/search-profiles')
    if (res.ok) {
      const data = await res.json()
      setProfiles(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadProfiles() }, [loadProfiles])

  const handleCreate = async (data: Partial<SearchProfile>) => {
    const res = await fetch('/api/search-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      await loadProfiles()
      setShowForm(false)
    }
  }

  const handleUpdate = async (id: string, data: Partial<SearchProfile>) => {
    const res = await fetch(`/api/search-profiles/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      await loadProfiles()
      setEditProfile(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce profil ?')) return
    await fetch(`/api/search-profiles/${id}`, { method: 'DELETE' })
    setProfiles(prev => prev.filter(p => p.id !== id))
  }

  const handleActivate = (id: string, current: boolean) => handleUpdate(id, { actif: !current })

  const handleFetchNow = async () => {
    setFetching(true)
    setFetchResult(null)
    const res = await fetch('/api/jobs/fetch', { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      setFetchResult(`✓ ${data.fetched?.inserted ?? 0} offres ajoutées`)
    } else {
      setFetchResult(`✗ ${data.error ?? 'Erreur'}`)
    }
    setFetching(false)
  }

  if (loading) return <div className="h-64 bg-card rounded-xl animate-pulse" />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Recherche</h1>
          <p className="text-muted text-sm mt-1">Configurez vos profils de recherche d&apos;emploi</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleFetchNow}
            disabled={fetching}
            className="border border-border text-foreground hover:border-accent/50 text-sm px-4 py-2 rounded-lg disabled:opacity-50 transition-colors"
          >
            {fetching ? 'Recherche...' : '↻ Lancer maintenant'}
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="bg-accent hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            + Nouveau profil
          </button>
        </div>
      </div>

      {fetchResult && (
        <div className={`rounded-lg px-4 py-2.5 text-sm border ${fetchResult.startsWith('✓') ? 'bg-green-500/10 border-green-500/30 text-success' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
          {fetchResult}
        </div>
      )}

      {showForm && (
        <ProfileForm onSave={handleCreate} onCancel={() => setShowForm(false)} />
      )}

      {profiles.length === 0 && !showForm ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <p className="text-foreground font-medium mb-1">Aucun profil de recherche</p>
          <p className="text-muted text-sm">Créez un profil pour commencer à scraper des offres.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {profiles.map(profile => (
            editProfile?.id === profile.id ? (
              <ProfileForm
                key={profile.id}
                profile={profile}
                onSave={(data) => handleUpdate(profile.id, data)}
                onCancel={() => setEditProfile(null)}
              />
            ) : (
              <div key={profile.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-foreground font-medium">{profile.nom || 'Profil sans nom'}</h3>
                      {profile.actif && (
                        <span className="text-xs bg-green-500/20 text-success border border-green-500/30 px-2 py-0.5 rounded-full">Actif</span>
                      )}
                    </div>
                    <p className="text-muted text-sm mt-0.5">
                      {profile.localisation} · {profile.rayon_km}km
                    </p>
                    <p className="text-muted text-xs mt-1">
                      Mots-clés: {(profile.mots_cles ?? []).join(', ')}
                    </p>
                    {(profile.type_contrat ?? []).length > 0 && (
                      <p className="text-muted text-xs mt-0.5">
                        Contrats: {(profile.type_contrat ?? []).join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleActivate(profile.id, profile.actif)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                        profile.actif
                          ? 'border-green-500/30 text-success hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30'
                          : 'border-border text-muted hover:text-foreground hover:border-accent/30'
                      }`}
                    >
                      {profile.actif ? 'Désactiver' : 'Activer'}
                    </button>
                    <button onClick={() => setEditProfile(profile)} className="text-muted hover:text-accent text-xs px-2 py-1.5 rounded-lg hover:bg-accent/10 transition-colors">Éditer</button>
                    <button onClick={() => handleDelete(profile.id)} className="text-muted hover:text-red-400 text-xs px-2 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors">Sup.</button>
                  </div>
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  )
}
