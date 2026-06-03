'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/` },
    })
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: '#08090e' }}
    >
      {/* Background grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(124, 58, 237, 0.07) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* Ambient glows */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2"
        style={{
          width: '500px',
          height: '300px',
          background: 'radial-gradient(ellipse, rgba(124, 58, 237, 0.18) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        className="absolute bottom-0 right-1/4"
        style={{
          width: '300px',
          height: '300px',
          background: 'radial-gradient(ellipse, rgba(96, 165, 250, 0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Card */}
      <div className="relative w-full max-w-sm animate-fade-up">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4" style={{
            background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
            boxShadow: '0 0 30px rgba(124, 58, 237, 0.4), 0 0 0 1px rgba(124, 58, 237, 0.3)',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
              <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">JobTracker IA</h1>
          <p className="text-muted text-sm mt-1">Gérez vos candidatures intelligemment</p>
        </div>

        {sent ? (
          <div
            className="rounded-2xl p-8 text-center"
            style={{
              background: 'rgba(16, 18, 32, 0.8)',
              border: '1px solid #1a1d32',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div
              className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center"
              style={{ background: 'rgba(52, 211, 153, 0.15)', border: '1px solid rgba(52, 211, 153, 0.3)' }}
            >
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#34d399" strokeWidth={2}>
                <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-foreground font-semibold mb-1.5">Email envoyé !</p>
            <p className="text-muted text-sm">Vérifiez votre boîte mail à</p>
            <p className="text-accent-light text-sm font-medium mt-0.5">{email}</p>
          </div>
        ) : (
          <form
            onSubmit={handleLogin}
            className="rounded-2xl p-7 space-y-5"
            style={{
              background: 'rgba(16, 18, 32, 0.8)',
              border: '1px solid #1a1d32',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.5)',
            }}
          >
            {error && (
              <div
                className="rounded-lg px-4 py-3 text-sm flex items-center gap-2"
                style={{ background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.2)', color: '#fb7185' }}
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0 }}>
                  <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7880a0' }}>
                Adresse email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="vous@example.com"
                className="w-full rounded-lg px-4 py-3 text-sm"
                style={{
                  background: 'rgba(12, 13, 22, 0.8)',
                  border: '1px solid #1a1d32',
                  color: '#e8eaf5',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-accent w-full text-white font-semibold py-3 rounded-lg text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Envoi en cours...
                </>
              ) : (
                <>
                  Connexion par email
                  <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <path d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              )}
            </button>

            <p className="text-center text-xs" style={{ color: '#4b5175' }}>
              Un lien magique sera envoyé à votre email
            </p>
          </form>
        )}

        {/* Footer */}
        <p className="text-center text-xs mt-6" style={{ color: '#2a2f4a' }}>
          JobTracker IA · Recherche d&apos;emploi intelligente
        </p>
      </div>
    </div>
  )
}
