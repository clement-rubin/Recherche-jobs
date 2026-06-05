// app/about/page.tsx
import Link from 'next/link'
import { AboutTabs } from '@/components/about/AboutTabs'
import { FaqAccordion } from '@/components/about/FaqAccordion'

const FEATURES = [
  {
    icon: '📊',
    title: 'Dashboard',
    desc: "Vue d'ensemble de vos candidatures avec statistiques de progression en temps réel.",
  },
  {
    icon: '🔍',
    title: 'Scraping automatique',
    desc: "Recherche quotidienne sur JSearch, APEC, France Travail et HelloWork selon vos profils.",
  },
  {
    icon: '📋',
    title: 'Gestion des offres',
    desc: "Consultez les détails complets, filtrez, sauvegardez et archivez les offres pertinentes.",
  },
  {
    icon: '✉️',
    title: 'Suivi des candidatures',
    desc: "Statuts, notes et relances — historique complet de chaque candidature en un endroit.",
  },
  {
    icon: '🎤',
    title: 'Alex — Assistant IA',
    desc: "Dictez des commandes vocales en français pour mettre à jour vos candidatures instantanément.",
  },
  {
    icon: '🔒',
    title: 'Sécurité',
    desc: "Authentification Google OAuth, données chiffrées Supabase EU, headers HTTP renforcés.",
  },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen" style={{ background: '#08090e', color: '#e8eaf5' }}>
      {/* Background grid */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(124,58,237,0.07) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />
      {/* Ambient glow top */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 pointer-events-none" style={{
        width: '600px', height: '300px',
        background: 'radial-gradient(ellipse, rgba(124,58,237,0.15) 0%, transparent 70%)',
      }} />

      <div className="relative">
        {/* ── Hero ─────────────────────────────────────────── */}
        <section className="flex flex-col items-center text-center px-6 pt-20 pb-14">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5" style={{
            background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
            boxShadow: '0 0 40px rgba(124,58,237,0.4), 0 0 0 1px rgba(124,58,237,0.3)',
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
              <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-3">JobTracker IA</h1>
          <p className="text-lg max-w-lg mb-8" style={{ color: '#8b92b8' }}>
            Gérez votre recherche d&apos;emploi avec intelligence, en toute transparence.
          </p>
          <div className="flex gap-3">
            <Link
              href="/login"
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', boxShadow: '0 0 20px rgba(124,58,237,0.35)' }}
            >
              Se connecter
            </Link>
            <Link
              href="/login"
              className="px-5 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #242847', color: '#8b92b8' }}
            >
              ← Retour
            </Link>
          </div>
        </section>

        {/* ── Sticky tab nav ────────────────────────────────── */}
        <AboutTabs />

        {/* ── Section: Fonctionnalités ──────────────────────── */}
        <section id="features" className="max-w-4xl mx-auto px-6 py-16" style={{ scrollMarginTop: '56px' }}>
          <h2 className="text-2xl font-bold mb-2">Fonctionnalités</h2>
          <p className="mb-10" style={{ color: '#8b92b8' }}>Tout ce dont vous avez besoin pour une recherche d&apos;emploi structurée.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon, title, desc }) => (
              <div
                key={title}
                className="rounded-xl p-5 transition-all"
                style={{ background: 'rgba(16,18,32,0.7)', border: '1px solid rgba(124,58,237,0.12)' }}
              >
                <div className="text-2xl mb-3">{icon}</div>
                <h3 className="font-semibold mb-1.5 text-sm">{title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: '#6b7280' }}>{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section: Données ─────────────────────────────── */}
        <section id="data" className="max-w-4xl mx-auto px-6 py-16" style={{ scrollMarginTop: '56px' }}>
          <h2 className="text-2xl font-bold mb-2">Données &amp; Confidentialité</h2>
          <p className="mb-10" style={{ color: '#8b92b8' }}>Nous croyons en une transparence totale sur l&apos;usage de vos données.</p>
          <div className="space-y-4">
            <div className="rounded-xl p-6" style={{ background: 'rgba(16,18,32,0.7)', border: '1px solid rgba(124,58,237,0.15)' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🏗️</span>
                <h3 className="font-semibold text-sm">Où vont vos données ?</h3>
              </div>
              <ul className="space-y-2 text-sm" style={{ color: '#8b92b8' }}>
                <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>›</span> Hébergement : <strong style={{ color: '#e8eaf5' }}>Supabase (région Europe)</strong> — données isolées par compte</li>
                <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>›</span> Authentification : <strong style={{ color: '#e8eaf5' }}>Google OAuth</strong> — aucun mot de passe stocké</li>
                <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>›</span> Déploiement : <strong style={{ color: '#e8eaf5' }}>Netlify CDN Europe</strong></li>
              </ul>
            </div>
            <div className="rounded-xl p-6" style={{ background: 'rgba(16,18,32,0.7)', border: '1px solid rgba(34,197,94,0.15)' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">✅</span>
                <h3 className="font-semibold text-sm">Ce que nous ne faisons pas</h3>
              </div>
              <ul className="space-y-2 text-sm" style={{ color: '#8b92b8' }}>
                <li className="flex gap-2"><span style={{ color: '#22c55e' }}>✗</span> Pas de revente de données à des tiers</li>
                <li className="flex gap-2"><span style={{ color: '#22c55e' }}>✗</span> Pas de tracking publicitaire ni d&apos;analytics tiers</li>
                <li className="flex gap-2"><span style={{ color: '#22c55e' }}>✗</span> Pas d&apos;accès à vos données par d&apos;autres utilisateurs</li>
                <li className="flex gap-2"><span style={{ color: '#22c55e' }}>✗</span> Pas d&apos;entraînement de modèles IA sur vos données</li>
              </ul>
            </div>
            <div className="rounded-xl p-6" style={{ background: 'rgba(16,18,32,0.7)', border: '1px solid rgba(96,165,250,0.15)' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🎤</span>
                <h3 className="font-semibold text-sm">Données audio (assistant Alex)</h3>
              </div>
              <ul className="space-y-2 text-sm" style={{ color: '#8b92b8' }}>
                <li className="flex gap-2"><span style={{ color: '#60a5fa' }}>›</span> L&apos;audio capturé est envoyé directement à <strong style={{ color: '#e8eaf5' }}>Groq Whisper</strong> pour transcription</li>
                <li className="flex gap-2"><span style={{ color: '#60a5fa' }}>›</span> Groq ne stocke pas les fichiers audio après transcription</li>
                <li className="flex gap-2"><span style={{ color: '#60a5fa' }}>›</span> Seule la transcription textuelle transite côté serveur pour générer la réponse</li>
                <li className="flex gap-2"><span style={{ color: '#60a5fa' }}>›</span> <strong style={{ color: '#e8eaf5' }}>Aucun audio, aucune transcription</strong> n&apos;est sauvegardé en base de données</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── Section: FAQ ─────────────────────────────────── */}
        <section id="faq" className="max-w-4xl mx-auto px-6 py-16" style={{ scrollMarginTop: '56px' }}>
          <h2 className="text-2xl font-bold mb-2">FAQ — Assistant Alex</h2>
          <p className="mb-10" style={{ color: '#8b92b8' }}>Tout ce que vous devez savoir sur l&apos;assistant vocal.</p>
          <FaqAccordion />
        </section>

        {/* ── Footer CTA ───────────────────────────────────── */}
        <section className="flex flex-col items-center text-center px-6 py-20">
          <h2 className="text-2xl font-bold mb-3">Prêt à commencer ?</h2>
          <p className="mb-8" style={{ color: '#8b92b8' }}>Connectez-vous pour accéder à votre espace de suivi de candidatures.</p>
          <Link
            href="/login"
            className="px-6 py-3 rounded-lg text-sm font-semibold text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', boxShadow: '0 0 30px rgba(124,58,237,0.4)' }}
          >
            Se connecter avec Google
          </Link>
        </section>
      </div>
    </div>
  )
}
