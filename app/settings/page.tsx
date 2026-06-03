'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function SettingsContent() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const [gmailConnected, setGmailConnected] = useState(false)
  const [outlookConnected, setOutlookConnected] = useState(false)
  const [groqKey, setGroqKey] = useState('')
  const [groqSaved, setGroqSaved] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)

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
      setOutlookConnected((tokens ?? []).some((t: { provider: string }) => t.provider === 'outlook'))
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
    setSyncResult(res.ok ? `✓ ${(data.synced?.gmail ?? 0) + (data.synced?.outlook ?? 0)} emails traités` : `✗ ${data.error ?? 'Erreur'}`)
    setSyncing(false)
  }

  const sectionClass = "bg-card border border-border rounded-xl p-5 space-y-4"
  const inputClass = "flex-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm font-mono focus:outline-none focus:border-accent"

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Paramètres</h1>
        <p className="text-muted text-sm mt-1">Configuration de votre compte</p>
      </div>

      {/* OAuth feedback */}
      {success && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-2.5 text-success text-sm">
          {success === 'gmail_connected' && '✓ Gmail connecté avec succès'}
          {success === 'outlook_connected' && '✓ Outlook connecté avec succès'}
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2.5 text-red-400 text-sm">
          {error === 'gmail_denied' && 'Connexion Gmail annulée'}
          {error === 'gmail_csrf' && 'Erreur de sécurité Gmail. Réessayez.'}
          {error === 'gmail_token_failed' && 'Échec de connexion Gmail. Réessayez.'}
          {error === 'outlook_denied' && 'Connexion Outlook annulée'}
          {error === 'outlook_csrf' && 'Erreur de sécurité Outlook. Réessayez.'}
          {error === 'outlook_token_failed' && 'Échec de connexion Outlook. Réessayez.'}
        </div>
      )}

      {/* Email section */}
      <div className={sectionClass}>
        <h2 className="text-foreground font-semibold">Synchronisation emails</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${gmailConnected ? 'bg-success' : 'bg-muted'}`} />
              <div>
                <p className="text-foreground text-sm font-medium">Gmail</p>
                <p className="text-muted text-xs">{gmailConnected ? 'Connecté' : 'Non connecté'}</p>
              </div>
            </div>
            <a
              href="/api/auth/gmail/connect"
              className={`text-sm px-4 py-2 rounded-lg border transition-colors ${
                gmailConnected
                  ? 'border-border text-muted hover:text-red-400 hover:border-red-500/30'
                  : 'border-accent text-accent hover:bg-accent hover:text-white'
              }`}
            >
              {gmailConnected ? 'Reconnecter' : 'Connecter'}
            </a>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${outlookConnected ? 'bg-success' : 'bg-muted'}`} />
              <div>
                <p className="text-foreground text-sm font-medium">Outlook</p>
                <p className="text-muted text-xs">{outlookConnected ? 'Connecté' : 'Non connecté'}</p>
              </div>
            </div>
            <a
              href="/api/auth/outlook/connect"
              className={`text-sm px-4 py-2 rounded-lg border transition-colors ${
                outlookConnected
                  ? 'border-border text-muted hover:text-red-400 hover:border-red-500/30'
                  : 'border-accent text-accent hover:bg-accent hover:text-white'
              }`}
            >
              {outlookConnected ? 'Reconnecter' : 'Connecter'}
            </a>
          </div>
        </div>

        <div className="pt-2 border-t border-border">
          <button
            onClick={handleSyncNow}
            disabled={syncing || (!gmailConnected && !outlookConnected)}
            className="text-sm text-foreground border border-border hover:border-accent/50 px-4 py-2 rounded-lg disabled:opacity-50 transition-colors"
          >
            {syncing ? 'Synchronisation...' : '↻ Synchroniser maintenant'}
          </button>
          {syncResult && (
            <p className={`text-xs mt-2 ${syncResult.startsWith('✓') ? 'text-success' : 'text-red-400'}`}>{syncResult}</p>
          )}
        </div>
      </div>

      {/* Groq API key section */}
      <div className={sectionClass}>
        <h2 className="text-foreground font-semibold">Assistant Alex</h2>
        <p className="text-muted text-xs">Clé API Groq pour la reconnaissance d&apos;intentions vocales.</p>
        <div className="flex gap-2">
          <input
            type="password"
            value={groqKey}
            onChange={e => setGroqKey(e.target.value)}
            placeholder="gsk_..."
            className={inputClass}
          />
          <button
            onClick={saveGroqKey}
            className="bg-accent hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            {groqSaved ? '✓ Sauvegardé' : 'Sauvegarder'}
          </button>
        </div>
        <p className="text-muted text-xs">
          Obtenez une clé gratuite sur{' '}
          <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
            console.groq.com
          </a>
        </p>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="h-64 bg-card rounded-xl animate-pulse" />}>
      <SettingsContent />
    </Suspense>
  )
}
