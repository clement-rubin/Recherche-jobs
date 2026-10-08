'use client'

import { useState, useEffect, useCallback } from 'react'
import type { LinkedInContact, ContactStatus } from '@/lib/supabase/types'
import { ContactForm } from '@/components/contacts/ContactForm'
import { Card } from '@/components/ui/Card'

type Tab = 'a_contacter' | 'contactes'

const STATUS_LABEL: Record<ContactStatus, string> = {
  a_contacter: 'À contacter',
  contacte: 'Contacté',
  repondu: 'A répondu',
}

const formatDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : '')

export default function ContactsPage() {
  const [contacts, setContacts] = useState<LinkedInContact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('a_contacter')
  const [editing, setEditing] = useState<LinkedInContact | null>(null)
  const [creating, setCreating] = useState(false)

  const fetchContacts = useCallback(async () => {
    const res = await fetch('/api/contacts')
    if (!res.ok) {
      setError('Impossible de charger les contacts')
    } else {
      setError(null)
      setContacts(await res.json())
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void Promise.resolve().then(fetchContacts)
  }, [fetchContacts])

  const request = async (url: string, method: string, data?: Partial<LinkedInContact>) => {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined,
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? `Erreur ${res.status}`)
    }
    return res
  }

  const handleCreate = async (data: Partial<LinkedInContact>) => {
    await request('/api/contacts', 'POST', data)
    await fetchContacts()
  }

  const handleUpdate = async (id: string, data: Partial<LinkedInContact>) => {
    await request(`/api/contacts/${id}`, 'PATCH', data)
    await fetchContacts()
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Supprimer ce contact ?')) return
    try {
      await request(`/api/contacts/${id}`, 'DELETE')
      setContacts(prev => prev.filter(c => c.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    }
  }

  const toContact = contacts.filter(c => c.statut === 'a_contacter')
  const contacted = contacts.filter(c => c.statut !== 'a_contacter')
  const shown = tab === 'a_contacter' ? toContact : contacted

  const quickAction = (c: LinkedInContact) =>
    c.statut === 'a_contacter'
      ? { label: 'Marquer contacté', next: 'contacte' as const }
      : c.statut === 'contacte'
        ? { label: 'A répondu', next: 'repondu' as const }
        : null

  const tabBtn = (id: Tab, label: string, count: number) => (
    <button
      onClick={() => setTab(id)}
      className="px-3 py-1.5 rounded-md text-sm transition-colors min-h-[34px]"
      style={tab === id ? { background: 'var(--accent)', color: 'white' } : { color: 'var(--muted)' }}
    >
      {label} ({count})
    </button>
  )

  if (loading) {
    return <div className="h-64 rounded-[var(--r-xl)] animate-pulse" style={{ background: 'var(--card)' }} />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Contacts LinkedIn</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            {toContact.length} à contacter · {contacted.length} contacté{contacted.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-accent text-white px-4 py-2 rounded-[var(--r-lg)] text-sm font-medium">
          + Ajouter
        </button>
      </div>

      <div className="inline-flex items-center gap-2 rounded-[var(--r-lg)] p-1" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        {tabBtn('a_contacter', 'À contacter', toContact.length)}
        {tabBtn('contactes', 'Déjà contactés', contacted.length)}
      </div>

      {error && (
        <div className="rounded-[var(--r-lg)] px-4 py-3 text-sm" style={{ background: 'var(--danger-surface)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)' }}>{error}</div>
      )}

      {shown.length === 0 ? (
        <p className="text-sm py-10 text-center" style={{ color: 'var(--muted)' }}>
          {tab === 'a_contacter' ? 'Aucune personne à contacter.' : 'Aucun contact effectué.'}
        </p>
      ) : (
        <div className="grid gap-3">
          {shown.map(c => {
            const action = quickAction(c)
            return (
              <Card key={c.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold" style={{ color: 'var(--foreground)' }}>{c.nom}</p>
                    <p className="text-sm" style={{ color: 'var(--muted)' }}>
                      {[c.poste, c.entreprise].filter(Boolean).join(' · ')}
                    </p>
                    <a
                      href={c.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm underline break-all"
                      style={{ color: 'var(--accent)' }}
                    >
                      Profil LinkedIn
                    </a>
                    {tab === 'contactes' && (
                      <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                        {STATUS_LABEL[c.statut]}{c.date_contact ? ` · ${formatDate(c.date_contact)}` : ''}
                      </p>
                    )}
                    {c.notes && <p className="text-sm mt-2 whitespace-pre-line" style={{ color: 'var(--foreground)' }}>{c.notes}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {action && (
                      <button
                        onClick={() => handleUpdate(c.id, { statut: action.next }).catch(err => setError(err.message))}
                        className="btn-accent text-white px-3 py-1.5 rounded-[var(--r-lg)] text-sm"
                      >
                        {action.label}
                      </button>
                    )}
                    <button onClick={() => setEditing(c)} className="border border-[color:var(--border)] px-3 py-1.5 rounded-[var(--r-lg)] text-sm" style={{ color: 'var(--muted)' }}>
                      Modifier
                    </button>
                    <button onClick={() => handleDelete(c.id)} className="border border-[color:var(--border)] px-3 py-1.5 rounded-[var(--r-lg)] text-sm" style={{ color: 'var(--danger-text)' }}>
                      Supprimer
                    </button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {creating && <ContactForm onClose={() => setCreating(false)} onSave={handleCreate} />}
      {editing && <ContactForm contact={editing} onClose={() => setEditing(null)} onSave={data => handleUpdate(editing.id, data)} />}
    </div>
  )
}
