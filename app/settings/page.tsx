'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { Card } from '@/components/ui/Card'

function SettingsContent() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const [gmailConnected, setGmailConnected] = useState(false)
  const [groqKey, setGroqKey] = useState('')
  const [groqSaved, setGroqSaved] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [saveHover, setSaveHover] = useState(false)

  // Check OAuth status
  useEffect(() => {
    const checkConnections = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: tokens } = await (supabase as any)
        .from('oauth_tokens')
        .select('provider')
        .eq('user_id', user.id)

      setGmailConnected((tokens ?? []).some((t: { provider: string }) => t.provider === 'gmail'))
    }
    checkConnections()

    // Load saved Groq key from localStorage
    const savedKey = localStorage.getItem('groq_api_key') ?? ''
    setGroqKey(savedKey)
  }, [supabase])

  // Handle OAuth success/error params
  const success = searchParams.get('success')
  const error = searchParams.get('error')

  const saveGroqKey = () => {
    if (groqKey.trim()) {
      localStorage.setItem('groq_api_key', groqKey.trim())
      setGroqSaved(true)
      setTimeout(() => setGroqSaved(false), 2000)
    }
  }

  const handleSyncNow = async () => {
    setSyncing(true)
    setSyncResult(null)
    const res = await fetch('/api/emails/sync', { method: 'POST' })
    const data = await res.json()
    setSyncResult(res.ok ? `ok ${data.synced?.gmail ?? 0} emails traités` : `err ${data.error ?? 'Erreur'}`)
    setSyncing(false)
  }

  const inputClass = "flex-1 border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none"

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Paramètres</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Configuration de votre compte</p>
      </div>

      {/* OAuth feedback */}
      {success === 'gmail_connected' && (
        <div
          className="border rounded-lg px-4 py-2.5 text-sm"
          style={{
            background: 'var(--success-surface)',
            borderColor: 'var(--success-border)',
            color: 'var(--success-text)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="inline mr-1.5 align-text-bottom"><path d="M5 13l4 4L19 7"/></svg>
          Gmail connecté avec succès
        </div>
      )}
      {error && (
        <div
          className="border rounded-lg px-4 py-2.5 text-sm"
          style={{
            background: 'var(--danger-surface)',
            borderColor: 'var(--danger-border)',
            color: 'var(--danger-text)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="inline mr-1.5 align-text-bottom"><path d="M18 6L6 18M6 6l12 12"/></svg>
          {error === 'gmail_denied' && 'Connexion Gmail annulée'}
          {error === 'gmail_csrf' && 'Erreur de sécurité Gmail. Réessayez.'}
          {error === 'gmail_token_failed' && 'Échec de connexion Gmail. Réessayez.'}
        </div>
      )}

      {/* Email section */}
      <Card className="p-5 space-y-4">
        <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>Synchronisation emails</h2>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: gmailConnected ? 'var(--success-text)' : 'var(--muted)' }}
              />
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Gmail</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>{gmailConnected ? 'Connecté' : 'Non connecté'}</p>
              </div>
            </div>
            <a
              href="/api/auth/gmail/connect"
              className="text-sm px-4 py-2 rounded-lg border transition-colors"
              style={
                gmailConnected
                  ? { borderColor: 'var(--border)', color: 'var(--muted)' }
                  : { borderColor: 'var(--accent)', color: 'var(--accent)' }
              }
            >
              {gmailConnected ? 'Reconnecter' : 'Connecter'}
            </a>
          </div>

        </div>

        <div className="pt-2" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={handleSyncNow}
            disabled={syncing || !gmailConnected}
            className="text-sm px-4 py-2 rounded-lg disabled:opacity-50 transition-colors"
            style={{
              color: 'var(--foreground)',
              border: '1px solid var(--border)',
            }}
          >
            {syncing ? 'Synchronisation...' : '↻ Synchroniser maintenant'}
          </button>
          {syncResult && (
            <p
              className="text-xs mt-2"
              style={{ color: syncResult.startsWith('ok') ? 'var(--success-text)' : 'var(--danger-text)' }}
            >
              {syncResult.startsWith('ok') ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="inline mr-1 align-text-bottom"><path d="M5 13l4 4L19 7"/></svg>
                  {syncResult.slice(3)}
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="inline mr-1 align-text-bottom"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  {syncResult.slice(4)}
                </>
              )}
            </p>
          )}
        </div>
      </Card>

      {/* Groq API key section */}
      <Card className="p-5 space-y-4">
        <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>Assistant Alex</h2>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>Clé API Groq pour la reconnaissance d&apos;intentions vocales.</p>
        <div className="flex gap-2">
          <input
            type="password"
            value={groqKey}
            onChange={e => setGroqKey(e.target.value)}
            placeholder="gsk_..."
            className={inputClass}
            style={{
              background: 'var(--background)',
              borderColor: 'var(--border)',
              color: 'var(--foreground)',
            }}
          />
          <button
            onClick={saveGroqKey}
            onMouseEnter={() => setSaveHover(true)}
            onMouseLeave={() => setSaveHover(false)}
            className="text-white text-sm px-4 py-2 rounded-lg transition-colors whitespace-nowrap flex-shrink-0 min-h-[40px]"
            style={{ background: saveHover ? 'var(--accent-hover)' : 'var(--accent)' }}
          >
            {groqSaved ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="inline mr-1 align-text-bottom"><path d="M5 13l4 4L19 7"/></svg>
                Sauvegardé
              </>
            ) : 'Sauvegarder'}
          </button>
        </div>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          Obtenez une clé gratuite sur{' '}
          <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }} className="hover:underline">
            console.groq.com
          </a>
        </p>
      </Card>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="h-64 rounded-xl animate-pulse" style={{ background: 'var(--card)' }} />}>
      <SettingsContent />
    </Suspense>
  )
}
