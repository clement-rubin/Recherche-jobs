'use client'

import { useState, type ReactNode } from 'react'
import type { AnalysisResult } from '@/lib/analysis/types'
import { PriorityBadge } from './PriorityBadge'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--muted)' }}>{title}</h3>
      {children}
    </div>
  )
}

const ACTION_LABELS = {
  ajouter: 'Ajouter', reformuler: 'Reformuler', mettre_en_avant: 'Mettre en avant', retirer: 'Retirer',
} as const

export function AnalysisPanel({ analysis }: { analysis: AnalysisResult }) {
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const present = analysis.exigences.filter(e => e.present)
  const missing = analysis.exigences.filter(e => !e.present)
  const { entreprise_recherche: research, accroche, priorite } = analysis

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(accroche.texte)
      setCopyFailed(false)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
      setCopyFailed(true)
      setTimeout(() => setCopyFailed(false), 2500)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <PriorityBadge niveau={priorite.niveau} score={priorite.score} />
        <span className="text-xs" style={{ color: 'var(--muted)' }}>
          Correspondance {analysis.correspondance.score_global}/100
        </span>
        <span className="text-sm" style={{ color: 'var(--foreground-dim)' }}>{priorite.raison}</span>
      </div>

      {analysis.avertissements.length > 0 && (
        <ul className="rounded-lg px-3 py-2 text-xs space-y-1" style={{ background: 'rgba(217,119,6,0.08)', color: 'var(--warning)', border: '1px solid rgba(217,119,6,0.2)' }}>
          {analysis.avertissements.map((w, i) => <li key={`${i}-${w}`}>{w}</li>)}
        </ul>
      )}

      {accroche.texte && (
        <Section title="Accroche">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>{accroche.texte}</p>
          {accroche.avertissement && (
            <p className="text-xs mt-1" style={{ color: 'var(--warning)' }}>{accroche.avertissement}</p>
          )}
          <button
            onClick={copy}
            className="mt-2 text-xs px-3 py-1 rounded-lg border"
            style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
          >
            {copied ? 'Copié' : copyFailed ? 'Échec de la copie' : 'Copier'}
          </button>
        </Section>
      )}

      {present.length > 0 && (
        <Section title="Compétences présentes">
          <ul className="space-y-1">
            {present.map((e, i) => (
              <li key={`${i}-${e.competence}`} className="text-sm" style={{ color: 'var(--foreground-dim)' }}>
                <span className="font-medium" style={{ color: 'var(--success)' }}>{e.competence}</span>
                {e.preuve_cv && <span style={{ color: 'var(--muted)' }}> — {e.preuve_cv}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {missing.length > 0 && (
        <Section title="Compétences manquantes">
          <ul className="space-y-1">
            {missing.map((e, i) => (
              <li key={`${i}-${e.competence}`} className="text-sm" style={{ color: 'var(--foreground-dim)' }}>
                <span className="font-medium">{e.competence}</span>
                <span className="text-xs" style={{ color: e.bloquante ? 'var(--danger)' : 'var(--muted)' }}>
                  {' '}({e.bloquante ? 'bloquante' : e.obligatoire ? 'obligatoire' : 'souhaitée'})
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {analysis.recommandations_cv.length > 0 && (
        <Section title={`Recommandations CV (${analysis.cv_utilise.toUpperCase()})`}>
          <ul className="space-y-2">
            {analysis.recommandations_cv.map((r, i) => (
              <li key={`${i}-${r.section}-${r.action}`} className="text-sm" style={{ color: 'var(--foreground-dim)' }}>
                <span className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>{ACTION_LABELS[r.action]} · {r.section}</span>
                {r.texte_actuel && <p className="text-xs italic" style={{ color: 'var(--muted)' }}>« {r.texte_actuel} »</p>}
                {r.texte_suggere && <p>{r.texte_suggere}</p>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={`Entreprise${research.perimetre ? ` (${research.perimetre})` : ''}`}>
        {research.statut === 'insuffisante' ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Aucune information fiable trouvée sur cette entreprise.</p>
        ) : (
          <div className="space-y-2">
            {research.valeurs.map(v => (
              <p key={v.source_url + v.valeur} className="text-sm">
                <a href={v.source_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>{v.valeur}</a>
              </p>
            ))}
            {research.actualites.map(a => (
              <p key={a.source_url + a.resume} className="text-sm" style={{ color: 'var(--foreground-dim)' }}>
                <a href={a.source_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>{a.resume}</a>
                {a.date && <span style={{ color: 'var(--muted)' }}> · {a.date}</span>}
              </p>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
