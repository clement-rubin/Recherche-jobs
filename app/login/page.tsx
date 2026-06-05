'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
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

        <div
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

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid #242847',
              color: '#e8eaf5',
            }}
          >
            {loading ? (
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Se connecter avec Google
              </>
            )}
          </button>

          <p className="text-center text-xs" style={{ color: '#4b5175' }}>
            Connexion sécurisée via votre compte Google
          </p>

          <Link
            href="/about"
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all"
            style={{
              background: 'transparent',
              border: '1px solid #1a1d32',
              color: '#6b7280',
            }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            En savoir plus sur JobTracker IA
          </Link>
        </div>

        {/* Footer */}
        <p className="text-center text-xs mt-6" style={{ color: '#2a2f4a' }}>
          JobTracker IA ·{' '}
          <Link href="/about" className="hover:underline" style={{ color: '#4b5175' }}>
            Comment ça fonctionne ?
          </Link>
        </p>
      </div>
    </div>
  )
}
