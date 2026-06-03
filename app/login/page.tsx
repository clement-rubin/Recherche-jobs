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
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-1">Job Tracker</h1>
          <p className="text-muted text-sm">Gérez vos candidatures</p>
        </div>
        {sent ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <p className="text-foreground font-medium mb-1">Vérifiez vos emails</p>
            <p className="text-muted text-sm">Lien de connexion envoyé à {email}</p>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="bg-card border border-border rounded-xl p-6 space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 text-sm">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm text-muted mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="vous@example.com"
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-foreground placeholder-muted text-sm focus:outline-none focus:border-accent transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
            >
              {loading ? 'Envoi...' : 'Connexion par email'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
