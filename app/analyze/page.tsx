'use client'

import { useState, type FormEvent } from 'react'
import { AnalysisPanel } from '@/components/analysis/AnalysisPanel'
import type { AnalysisResult } from '@/lib/analysis/types'

interface ApiOk {
  offer: { titre: string; entreprise: string; localisation: string; type_contrat: string }
  analysis: AnalysisResult
}
interface BlockedResponse { blocked: true; domain: string; reason: string }
interface ConfirmResponse { requiresConfirmation: true; domain: string; reason: string }
type ApiResponse = ApiOk | BlockedResponse | ConfirmResponse | { error: string }

export default function AnalyzePage() {
  const [url, setUrl] = useState('')
  const [manualText, setManualText] = useState('')
  const [company, setCompany] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ApiOk | null>(null)
  const [blocked, setBlocked] = useState<{ domain: string; reason: string } | null>(null)
  const [needsConfirmation, setNeedsConfirmation] = useState<{ domain: string; reason: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'url' | 'manual' | 'confirm' | 'result'>('url')

  const reset = () => {
    setResult(null)
    setBlocked(null)
    setNeedsConfirmation(null)
    setError(null)
    setManualText('')
    setCompany('')
    setStep('url')
  }

  const runAnalysis = async (opts: { manualText?: string; force?: boolean; company?: string } = {}) => {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, ...opts }),
      })
      const data: ApiResponse = await resp.json().catch(() => ({ error: '' }))

      if (!resp.ok || 'error' in data) {
        setError(('error' in data && data.error) || "L'analyse a échoué (délai dépassé ?)")
      } else if ('blocked' in data) {
        setBlocked({ domain: data.domain, reason: data.reason })
        setStep('manual')
      } else if ('requiresConfirmation' in data) {
        setNeedsConfirmation({ domain: data.domain, reason: data.reason })
        setStep('confirm')
      } else {
        setResult(data)
        setStep('result')
      }
    } catch {
      setError('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitUrl = (e: FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return
    reset()
    runAnalysis()
  }

  const handleSubmitManual = (e: FormEvent) => {
    e.preventDefault()
    runAnalysis({ manualText: manualText.trim(), company: company.trim() || undefined })
  }

  const handleConfirm = () => {
    setNeedsConfirmation(null)
    runAnalysis({ force: true })
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Analyser une offre</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          Colle le lien d&apos;une offre : l&apos;IA compare l&apos;offre à ton CV, recherche l&apos;entreprise et prépare une accroche personnalisée.
        </p>
      </div>

      <form onSubmit={handleSubmitUrl} className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://www.welcometothejungle.com/..."
          required
          className="flex-1 px-4 py-2.5 rounded-lg text-sm outline-none"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="px-4 py-2.5 rounded-lg text-sm font-medium transition-opacity"
          style={{ background: 'var(--accent)', color: '#fff', opacity: loading || !url.trim() ? 0.5 : 1 }}
        >
          {loading ? 'Analyse…' : 'Analyser'}
        </button>
        {step !== 'url' && (
          <button
            type="button"
            onClick={reset}
            aria-label="Réinitialiser"
            className="px-3 py-2.5 rounded-lg text-sm"
            style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
          >
            ✕
          </button>
        )}
      </form>

      {error && (
        <div className="px-4 py-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.2)' }}>
          {error}
        </div>
      )}

      {step === 'manual' && blocked && (
        <div className="space-y-4">
          <div className="px-4 py-3 rounded-lg text-sm" style={{ background: 'rgba(217,119,6,0.08)', color: 'var(--warning)', border: '1px solid rgba(217,119,6,0.2)' }}>
            <strong>{blocked.domain}</strong> : lecture automatique impossible ({blocked.reason}).<br />
            Ouvre l&apos;offre dans ton navigateur, sélectionne tout le texte (Ctrl+A → Ctrl+C) et colle-le ci-dessous.
          </div>
          <form onSubmit={handleSubmitManual} className="space-y-3">
            <input
              type="text"
              value={company}
              onChange={e => setCompany(e.target.value)}
              placeholder="Entreprise (pour la recherche web)"
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
              style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
            />
            <textarea
              value={manualText}
              onChange={e => setManualText(e.target.value)}
              placeholder="Colle ici le texte complet de l'offre…"
              rows={8}
              className="w-full px-4 py-3 rounded-lg text-sm outline-none resize-y"
              style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
            />
            <button
              type="submit"
              disabled={loading || !manualText.trim()}
              className="px-4 py-2.5 rounded-lg text-sm font-medium"
              style={{ background: 'var(--accent)', color: '#fff', opacity: loading || !manualText.trim() ? 0.5 : 1 }}
            >
              {loading ? 'Analyse…' : 'Analyser ce texte'}
            </button>
          </form>
        </div>
      )}

      {step === 'confirm' && needsConfirmation && (
        <div className="space-y-4">
          <div className="px-4 py-3 rounded-lg text-sm" style={{ background: 'rgba(99,102,241,0.08)', color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <strong>{needsConfirmation.domain}</strong> : impossible de vérifier les CGU ({needsConfirmation.reason}).<br />
            Veux-tu tenter la lecture automatique quand même ?
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="px-4 py-2.5 rounded-lg text-sm font-medium"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {loading ? 'En cours…' : 'Oui, essayer'}
            </button>
            <button
              onClick={() => { setNeedsConfirmation(null); setStep('manual'); setBlocked({ domain: needsConfirmation.domain, reason: 'domaine inconnu' }) }}
              className="px-4 py-2.5 rounded-lg text-sm"
              style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
            >
              Non, je vais coller le texte
            </button>
          </div>
        </div>
      )}

      {step === 'result' && result && (
        <div className="space-y-4 animate-fade-up">
          <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              {result.analysis.offre.titre || result.offer.titre || 'Offre analysée'}
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
              {[result.analysis.offre.entreprise, result.analysis.offre.lieu].filter(Boolean).join(' · ')}
            </div>
          </div>
          <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <AnalysisPanel analysis={result.analysis} />
          </div>
        </div>
      )}
    </div>
  )
}
