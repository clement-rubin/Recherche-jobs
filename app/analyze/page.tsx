'use client'

import { useState, type ReactNode, type FormEvent } from 'react'
import type { OfferData } from '@/lib/analyzer/scraper'
import type { CompanyData } from '@/lib/analyzer/company'
import type { FitResult } from '@/lib/analyzer/fit'

interface AnalysisResult {
  offer: OfferData
  company: CompanyData
  fit: FitResult
}

interface BlockedResponse {
  blocked: true
  domain: string
  reason: string
}

interface ConfirmResponse {
  requiresConfirmation: true
  domain: string
  reason: string
}

type ApiResponse = AnalysisResult | BlockedResponse | ConfirmResponse | { error: string }

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 80 ? 'var(--success)' : score >= 60 ? 'var(--accent)' : score >= 40 ? 'var(--warning)' : 'var(--danger)'
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative w-28 h-28 rounded-full flex items-center justify-center"
        style={{ background: `conic-gradient(${color} ${score * 3.6}deg, var(--border) 0deg)` }}
      >
        <div className="w-20 h-20 rounded-full flex flex-col items-center justify-center" style={{ background: 'var(--card)' }}>
          <span className="text-2xl font-bold" style={{ color }}>{score}</span>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>/100</span>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>{title}</h3>
      {children}
    </div>
  )
}

function List({ items, color }: { items: string[]; color?: string }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="text-sm flex gap-2" style={{ color: color || 'var(--foreground-dim)' }}>
          <span className="flex-shrink-0 mt-0.5">–</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export default function AnalyzePage() {
  const [url, setUrl] = useState('')
  const [manualText, setManualText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
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
    setStep('url')
  }

  const runAnalysis = async (opts: { manualText?: string; force?: boolean } = {}) => {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, ...opts }),
      })
      const data: ApiResponse = await resp.json()

      if ('error' in data) {
        setError(data.error)
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
    } catch (e) {
      setError(`Erreur réseau : ${e}`)
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
    runAnalysis({ manualText: manualText.trim() })
  }

  const handleConfirm = () => {
    setNeedsConfirmation(null)
    runAnalysis({ force: true })
  }

  const fit = result?.fit

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Analyser une offre</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          Colle le lien d&apos;une offre pour obtenir un score de fit, des angles de lettre de motivation et les points à mettre en avant dans ton CV.
        </p>
      </div>

      {/* URL form — always visible */}
      <form onSubmit={handleSubmitUrl} className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://www.welcometothejungle.com/..."
          required
          className="flex-1 px-4 py-2.5 rounded-lg text-sm outline-none"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            color: 'var(--foreground)',
          }}
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="px-4 py-2.5 rounded-lg text-sm font-medium transition-opacity"
          style={{
            background: 'var(--accent)',
            color: '#fff',
            opacity: loading || !url.trim() ? 0.5 : 1,
          }}
        >
          {loading ? 'Analyse…' : 'Analyser'}
        </button>
        {step !== 'url' && (
          <button
            type="button"
            onClick={reset}
            className="px-3 py-2.5 rounded-lg text-sm"
            style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
          >
            ✕
          </button>
        )}
      </form>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.2)' }}>
          {error}
        </div>
      )}

      {/* Blocked → manual paste */}
      {step === 'manual' && blocked && (
        <div className="space-y-4">
          <div className="px-4 py-3 rounded-lg text-sm" style={{ background: 'rgba(217,119,6,0.08)', color: 'var(--warning)', border: '1px solid rgba(217,119,6,0.2)' }}>
            <strong>{blocked.domain}</strong> ne permet pas le scraping automatique ({blocked.reason}).<br />
            Ouvre l&apos;offre dans ton navigateur, sélectionne tout le texte (Ctrl+A → Ctrl+C) et colle-le ci-dessous.
          </div>
          <form onSubmit={handleSubmitManual} className="space-y-3">
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

      {/* Unknown domain → ask confirmation */}
      {step === 'confirm' && needsConfirmation && (
        <div className="space-y-4">
          <div className="px-4 py-3 rounded-lg text-sm" style={{ background: 'rgba(99,102,241,0.08)', color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <strong>{needsConfirmation.domain}</strong> — impossible de vérifier les CGU ({needsConfirmation.reason}).<br />
            Veux-tu tenter le scraping quand même ?
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="px-4 py-2.5 rounded-lg text-sm font-medium"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {loading ? 'En cours…' : 'Oui, scraper'}
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

      {/* Results */}
      {step === 'result' && result && fit && (
        <div className="space-y-4 animate-fade-up">
          {/* Score card */}
          <div className="rounded-xl p-5 flex items-center gap-6" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <ScoreGauge score={fit.score} />
            <div className="flex-1">
              <div className="text-sm font-semibold mb-1" style={{ color: 'var(--foreground)' }}>{result.offer.titre || 'Offre analysée'}</div>
              {result.offer.entreprise && <div className="text-xs mb-1" style={{ color: 'var(--muted)' }}>{result.offer.entreprise}</div>}
              {result.offer.localisation && <div className="text-xs mb-2" style={{ color: 'var(--muted)' }}>📍 {result.offer.localisation}</div>}
              {result.offer.type_contrat && (
                <span className="inline-block px-2 py-0.5 rounded text-xs" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                  {result.offer.type_contrat}
                </span>
              )}
              <p className="text-sm mt-3" style={{ color: 'var(--foreground-dim)' }}>{fit.verdict}</p>
            </div>
          </div>

          {/* Company info — remonté juste après la score card pour donner le
              contexte entreprise dès le haut du compte-rendu */}
          <Section title={`Entreprise : ${result.offer.entreprise || 'inconnue'}`}>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span style={{ color: 'var(--muted)' }}>Secteur</span>
                <p style={{ color: 'var(--foreground-dim)' }}>{result.company.secteur}</p>
              </div>
              <div>
                <span style={{ color: 'var(--muted)' }}>Taille</span>
                <p style={{ color: 'var(--foreground-dim)' }}>{result.company.taille}</p>
              </div>
            </div>
            {result.company.culture && !result.company.culture.includes('hypothèse') && (
              <div className="mt-3">
                <span className="text-xs" style={{ color: 'var(--muted)' }}>À propos</span>
                <p className="text-sm mt-0.5" style={{ color: 'var(--foreground-dim)' }}>{result.company.culture}</p>
              </div>
            )}
            {result.company.tech_stack.length > 0 && (
              <div className="mt-3">
                <span className="text-xs" style={{ color: 'var(--muted)' }}>Stack tech détectée</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {result.company.tech_stack.map(t => (
                    <span key={t} className="px-2 py-0.5 rounded text-xs" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>{t}</span>
                  ))}
                </div>
              </div>
            )}
            {result.company.actualites.length > 0 && (
              <div className="mt-3">
                <span className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Actualités récentes</span>
                <ul className="space-y-1">
                  {result.company.actualites.map((n, i) => (
                    <li key={i} className="text-xs" style={{ color: 'var(--foreground-dim)' }}>
                      {n.source_url ? <a href={n.source_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>{n.titre}</a> : n.titre}
                      {n.date && <span style={{ color: 'var(--muted)' }}> · {n.date}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.company.sources.length > 0 && (
              <div className="mt-3">
                <span className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Sources</span>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {result.company.sources.map((s, i) => (
                    <a key={i} href={s} target="_blank" rel="noopener noreferrer" className="text-xs truncate max-w-[220px]" style={{ color: 'var(--accent)' }}>
                      {(() => { try { return new URL(s).hostname.replace('www.', '') } catch { return s } })()}
                    </a>
                  ))}
                </div>
              </div>
            )}
            {result.company.incertitudes.length > 0 && (
              <div className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>
                ⚠️ {result.company.incertitudes.join(' · ')}
              </div>
            )}
          </Section>

          {/* Score detail */}
          <Section title="Détail du score">
            <div className="space-y-2">
              {Object.entries(fit.detail_scores).map(([key, val]) => {
                const labels: Record<string, { label: string; max: number }> = {
                  contrat_stage: { label: 'Type de contrat (stage)', max: 30 },
                  periode: { label: 'Période compatible', max: 15 },
                  competences: { label: 'Compétences matchées', max: 20 },
                  consulting: { label: 'Dimension client/conseil', max: 15 },
                  pas_senior: { label: 'Niveau accessible (pas senior)', max: 10 },
                  domaine_data: { label: 'Domaine data confirmé', max: 10 },
                }
                const info = labels[key]
                if (!info) return null
                const pct = (val / info.max) * 100
                return (
                  <div key={key}>
                    <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--muted)' }}>
                      <span>{info.label}</span>
                      <span>{val}/{info.max}</span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: 'var(--border)' }}>
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{ width: `${pct}%`, background: pct === 100 ? 'var(--success)' : 'var(--accent)' }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </Section>

          {/* Points forts */}
          <Section title="Points forts">
            <List items={fit.points_forts} />
          </Section>

          {/* Angles lettre */}
          <Section title="Angles pour ta lettre de motivation">
            <List items={fit.angles_lettre} />
          </Section>

          {/* CV */}
          <Section title="CV — formulations à privilégier">
            <List items={fit.cv_adapter} />
            {(fit.mots_cles_ats.length > 0 || fit.conseils_ats.length > 0) && (
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                <h4 className="text-xs font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Pour passer les filtres ATS/IA</h4>
                {fit.mots_cles_ats.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {fit.mots_cles_ats.map(kw => (
                      <span key={kw} className="px-2 py-0.5 rounded text-xs" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>{kw}</span>
                    ))}
                  </div>
                )}
                <List items={fit.conseils_ats} />
              </div>
            )}
          </Section>

          {/* Pièges */}
          <Section title="Points de vigilance">
            <List items={fit.pieges} color="var(--warning)" />
          </Section>

          {/* Si match faible */}
          {fit.si_match_faible.length > 0 && (
            <Section title="Si le match te semble faible">
              <List items={fit.si_match_faible} />
            </Section>
          )}

          {/* Skills extracted */}
          {result.offer.competences_extraites.length > 0 && (
            <Section title="Compétences détectées dans l'offre">
              <div className="flex flex-wrap gap-1.5">
                {result.offer.competences_extraites.map(skill => (
                  <span key={skill} className="px-2 py-0.5 rounded text-xs" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground-dim)' }}>
                    {skill}
                  </span>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  )
}
