'use client'

import { useState } from 'react'

const FAQS = [
  {
    q: "Comment Alex comprend ma voix ?",
    a: "Votre navigateur enregistre votre voix via MediaRecorder. L'audio est envoyé à Groq Whisper (whisper-large-v3-turbo) qui le transcrit en texte, puis LLaMA 3.3 70B analyse l'intention et exécute l'action."
  },
  {
    q: "Mon audio est-il stocké ?",
    a: "Non. L'audio ne quitte jamais le serveur après transcription. Seul un log textuel minimal est conservé pour le débogage — sans le contenu audio ni la transcription complète."
  },
  {
    q: "Pourquoi Groq et pas Google ?",
    a: "L'API Web Speech de Chrome envoie l'audio aux serveurs Google, ce qui peut être bloqué sur certains réseaux. Groq est une alternative directe, plus fiable et privée."
  },
  {
    q: "Alex peut-il modifier mes candidatures ?",
    a: "Oui — il peut mettre à jour le statut, ajouter une note, ou créer une nouvelle candidature. Les actions irréversibles (ex: marquer comme refus) demandent une confirmation explicite."
  },
  {
    q: "Que faire si Alex se trompe ?",
    a: "Cliquez sur la croix pour ignorer la réponse. Toutes les modifications sont visibles immédiatement et peuvent être corrigées manuellement dans l'interface."
  },
  {
    q: "Alex fonctionne-t-il sans micro ?",
    a: "Non. Alex est un assistant vocal et requiert l'accès au microphone. Autorisez l'accès dans les paramètres de votre navigateur (icône cadenas dans la barre d'adresse)."
  },
]

export function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div className="space-y-2">
      {FAQS.map((faq, i) => (
        <div
          key={faq.q}
          className="rounded-[var(--r-xl)] overflow-hidden"
          style={{ border: '1px solid var(--border)', background: 'var(--card-gradient)', boxShadow: 'var(--shadow-sm)' }}
        >
          <button
            className="w-full flex items-center justify-between px-5 py-4 text-left gap-4"
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
            aria-controls={`faq-answer-${i}`}
          >
            <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{faq.q}</span>
            <span
              className="flex-shrink-0 transition-transform duration-200"
              style={{
                color: 'var(--accent-text)',
                transform: open === i ? 'rotate(45deg)' : 'rotate(0deg)',
              }}
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M12 4v16m8-8H4" />
              </svg>
            </span>
          </button>
          {open === i && (
            <div id={`faq-answer-${i}`} className="px-5 pb-4">
              <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{faq.a}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
