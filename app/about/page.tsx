// app/about/page.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BarChart3, Search, ClipboardList, Mail, Mic, ShieldCheck, Hammer, CircleCheck, type LucideIcon } from 'lucide-react'
import { AboutTabs } from '@/components/about/AboutTabs'
import { FaqAccordion } from '@/components/about/FaqAccordion'

const FEATURES: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: BarChart3,
    title: 'Dashboard',
    desc: "Vue d'ensemble de vos candidatures avec statistiques de progression en temps réel.",
  },
  {
    icon: Search,
    title: 'Scraping automatique',
    desc: "Recherche quotidienne sur JSearch, EURES, Adzuna, France Travail, Jooble et Reed selon vos profils.",
  },
  {
    icon: ClipboardList,
    title: 'Gestion des offres',
    desc: "Consultez les détails complets, filtrez, sauvegardez et archivez les offres pertinentes.",
  },
  {
    icon: Mail,
    title: 'Suivi des candidatures',
    desc: "Statuts, notes et relances — historique complet de chaque candidature en un endroit.",
  },
  {
    icon: Mic,
    title: 'Alex — Assistant IA',
    desc: "Dictez des commandes vocales en français pour mettre à jour vos candidatures instantanément.",
  },
  {
    icon: ShieldCheck,
    title: 'Sécurité',
    desc: "Authentification Google OAuth, données chiffrées Supabase EU, headers HTTP renforcés.",
  },
]

export default function AboutPage() {
  const [ctaHover, setCtaHover] = useState(false)
  const [footerCtaHover, setFooterCtaHover] = useState(false)

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <div className="relative">
        {/* ── Hero ─────────────────────────────────────────── */}
        <section className="flex flex-col items-center text-center px-6 pt-16 pb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-[var(--r-2xl)] mb-5" style={{
            background: 'var(--accent)',
            boxShadow: 'var(--shadow-md)',
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
              <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-3">JobTracker IA</h1>
          <p className="text-lg max-w-lg mb-6" style={{ color: 'var(--muted)' }}>
            Gérez votre recherche d&apos;emploi avec intelligence, en toute transparence.
          </p>
          <div className="flex gap-3">
            <Link
              href="/login"
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all"
              style={{
                background: 'var(--accent)',
                boxShadow: ctaHover ? 'var(--shadow-accent)' : 'none',
              }}
              onMouseEnter={() => setCtaHover(true)}
              onMouseLeave={() => setCtaHover(false)}
            >
              Se connecter
            </Link>
            <Link
              href="/login"
              className="px-5 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{ background: 'var(--card-gradient)', border: '1px solid var(--border)', color: 'var(--muted)' }}
            >
              ← Retour
            </Link>
          </div>
        </section>

        {/* ── Sticky tab nav ────────────────────────────────── */}
        <AboutTabs />

        {/* ── Section: Fonctionnalités ──────────────────────── */}
        <section id="features" className="max-w-4xl mx-auto px-6 py-10" style={{ scrollMarginTop: '56px' }}>
          <h2 className="text-2xl font-bold mb-2">Fonctionnalités</h2>
          <p className="mb-6" style={{ color: 'var(--muted)' }}>Tout ce dont vous avez besoin pour une recherche d&apos;emploi structurée.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-[var(--r-xl)] p-5 transition-all"
                style={{ background: 'var(--card-gradient)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}
              >
                <div className="mb-3 flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: 'var(--accent-surface)' }}>
                  <Icon size={16} style={{ color: 'var(--accent-text)' }} />
                </div>
                <h3 className="font-semibold mb-1.5 text-sm">{title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section: Données ─────────────────────────────── */}
        <section id="data" className="max-w-4xl mx-auto px-6 py-10" style={{ scrollMarginTop: '56px' }}>
          <h2 className="text-2xl font-bold mb-2">Données &amp; Confidentialité</h2>
          <p className="mb-6" style={{ color: 'var(--muted)' }}>Nous croyons en une transparence totale sur l&apos;usage de vos données.</p>
          <div className="space-y-4">
            <div className="rounded-[var(--r-xl)] p-6" style={{ background: 'var(--card-gradient)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
              <div className="flex items-center gap-2 mb-3">
                <Hammer size={18} style={{ color: 'var(--accent-text)' }} />
                <h3 className="font-semibold text-sm">Où vont vos données ?</h3>
              </div>
              <ul className="space-y-2 text-sm" style={{ color: 'var(--muted)' }}>
                <li className="flex gap-2"><span style={{ color: 'var(--accent-text)' }}>›</span> Hébergement : <strong style={{ color: 'var(--foreground)' }}>Supabase (région Europe)</strong> — données isolées par compte</li>
                <li className="flex gap-2"><span style={{ color: 'var(--accent-text)' }}>›</span> Authentification : <strong style={{ color: 'var(--foreground)' }}>Google OAuth</strong> — aucun mot de passe stocké</li>
                <li className="flex gap-2"><span style={{ color: 'var(--accent-text)' }}>›</span> Déploiement : <strong style={{ color: 'var(--foreground)' }}>Netlify CDN Europe</strong></li>
              </ul>
            </div>
            <div className="rounded-[var(--r-xl)] p-6" style={{ background: 'var(--card-gradient)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
              <div className="flex items-center gap-2 mb-3">
                <CircleCheck size={18} style={{ color: 'var(--success-text)' }} />
                <h3 className="font-semibold text-sm">Ce que nous ne faisons pas</h3>
              </div>
              <ul className="space-y-2 text-sm" style={{ color: 'var(--muted)' }}>
                <li className="flex gap-2"><span style={{ color: 'var(--success-text)' }}>✓</span> Pas de revente de données à des tiers</li>
                <li className="flex gap-2"><span style={{ color: 'var(--success-text)' }}>✓</span> Pas de tracking publicitaire ni d&apos;analytics tiers</li>
                <li className="flex gap-2"><span style={{ color: 'var(--success-text)' }}>✓</span> Pas d&apos;accès à vos données par d&apos;autres utilisateurs</li>
                <li className="flex gap-2"><span style={{ color: 'var(--success-text)' }}>✓</span> Pas d&apos;entraînement de modèles IA sur vos données</li>
              </ul>
            </div>
            <div className="rounded-[var(--r-xl)] p-6" style={{ background: 'var(--card-gradient)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
              <div className="flex items-center gap-2 mb-3">
                <Mic size={18} style={{ color: 'var(--accent-text)' }} />
                <h3 className="font-semibold text-sm">Données audio (assistant Alex)</h3>
              </div>
              <ul className="space-y-2 text-sm" style={{ color: 'var(--muted)' }}>
                <li className="flex gap-2"><span style={{ color: 'var(--accent-text)' }}>›</span> L&apos;audio capturé est envoyé directement à <strong style={{ color: 'var(--foreground)' }}>Groq Whisper</strong> pour transcription</li>
                <li className="flex gap-2"><span style={{ color: 'var(--accent-text)' }}>›</span> Groq ne stocke pas les fichiers audio après transcription</li>
                <li className="flex gap-2"><span style={{ color: 'var(--accent-text)' }}>›</span> Seule la transcription textuelle transite côté serveur pour générer la réponse</li>
                <li className="flex gap-2"><span style={{ color: 'var(--accent-text)' }}>›</span> <strong style={{ color: 'var(--foreground)' }}>Aucun audio, aucune transcription</strong> n&apos;est sauvegardé en base de données</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── Section: FAQ ─────────────────────────────────── */}
        <section id="faq" className="max-w-4xl mx-auto px-6 py-10" style={{ scrollMarginTop: '56px' }}>
          <h2 className="text-2xl font-bold mb-2">FAQ — Assistant Alex</h2>
          <p className="mb-6" style={{ color: 'var(--muted)' }}>Tout ce que vous devez savoir sur l&apos;assistant vocal.</p>
          <FaqAccordion />
        </section>

        {/* ── Footer CTA ───────────────────────────────────── */}
        <section className="flex flex-col items-center text-center px-6 py-14">
          <h2 className="text-2xl font-bold mb-3">Prêt à commencer ?</h2>
          <p className="mb-8" style={{ color: 'var(--muted)' }}>Connectez-vous pour accéder à votre espace de suivi de candidatures.</p>
          <Link
            href="/login"
            className="px-6 py-3 rounded-lg text-sm font-semibold text-white transition-all"
            style={{
              background: 'var(--accent)',
              boxShadow: footerCtaHover ? 'var(--shadow-accent)' : 'none',
            }}
            onMouseEnter={() => setFooterCtaHover(true)}
            onMouseLeave={() => setFooterCtaHover(false)}
          >
            Se connecter avec Google
          </Link>
        </section>
      </div>
    </div>
  )
}
