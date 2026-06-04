'use client'

import { useState, useRef, useCallback } from 'react'

interface TestResult {
  name: string
  status: 'pending' | 'running' | 'pass' | 'fail' | 'warn'
  duration?: number
  details: string
  raw?: unknown
}

function LogBlock({ label, data }: { label: string; data: unknown }) {
  return (
    <details className="mt-1">
      <summary className="text-xs text-muted cursor-pointer hover:text-foreground">{label}</summary>
      <pre className="text-xs bg-background border border-border rounded p-2 mt-1 overflow-x-auto max-h-60 whitespace-pre-wrap break-all">
        {typeof data === 'string' ? data : JSON.stringify(data, null, 2)}
      </pre>
    </details>
  )
}

function StatusIcon({ status }: { status: TestResult['status'] }) {
  switch (status) {
    case 'pass': return <span className="text-green-400 text-lg">✓</span>
    case 'fail': return <span className="text-red-400 text-lg">✗</span>
    case 'warn': return <span className="text-yellow-400 text-lg">⚠</span>
    case 'running': return <span className="text-blue-400 animate-spin inline-block">↻</span>
    default: return <span className="text-muted">○</span>
  }
}

export default function TestPage() {
  const [results, setResults] = useState<TestResult[]>([])
  const [running, setRunning] = useState(false)
  const [globalLog, setGlobalLog] = useState<string[]>([])
  const abortRef = useRef<AbortController | null>(null)

  const log = useCallback((msg: string) => {
    const ts = new Date().toISOString().slice(11, 23)
    setGlobalLog(prev => [...prev, `[${ts}] ${msg}`])
  }, [])

  const updateResult = useCallback((name: string, update: Partial<TestResult>) => {
    setResults(prev => prev.map(r => r.name === name ? { ...r, ...update } : r))
  }, [])

  const addResult = useCallback((r: TestResult) => {
    setResults(prev => [...prev, r])
  }, [])

  const runAllTests = async () => {
    setRunning(true)
    setResults([])
    setGlobalLog([])
    abortRef.current = new AbortController()
    const signal = abortRef.current.signal

    // ═══════════════════════════════════════
    // TEST 1: Auth / Session
    // ═══════════════════════════════════════
    const authTest: TestResult = { name: 'Auth / Session', status: 'running', details: '' }
    addResult(authTest)
    log('Testing auth session...')
    try {
      const t0 = Date.now()
      const res = await fetch('/api/applications?_limit=1', { signal })
      const ms = Date.now() - t0
      if (res.status === 401) {
        updateResult('Auth / Session', { status: 'fail', duration: ms, details: 'Not authenticated. Login required.', raw: await res.json() })
        log('AUTH FAIL: Not logged in')
      } else if (res.ok) {
        const data = await res.json()
        updateResult('Auth / Session', { status: 'pass', duration: ms, details: `Authenticated. ${data.length} applications returned.`, raw: { count: data.length, firstId: data[0]?.id } })
        log(`AUTH OK: ${data.length} applications`)
      } else {
        const body = await res.json()
        updateResult('Auth / Session', { status: 'fail', duration: ms, details: `HTTP ${res.status}: ${body.error}`, raw: body })
        log(`AUTH ERROR: ${res.status}`)
      }
    } catch (e: any) {
      updateResult('Auth / Session', { status: 'fail', details: `Network error: ${e.message}` })
      log(`AUTH NETWORK ERROR: ${e.message}`)
    }

    // ═══════════════════════════════════════
    // TEST 2: Search Profiles
    // ═══════════════════════════════════════
    const profilesTest: TestResult = { name: 'Search Profiles', status: 'running', details: '' }
    addResult(profilesTest)
    log('Fetching search profiles...')
    let profiles: any[] = []
    try {
      const t0 = Date.now()
      const res = await fetch('/api/search-profiles', { signal })
      const ms = Date.now() - t0
      if (res.ok) {
        profiles = await res.json()
        const activeCount = profiles.filter((p: any) => p.actif).length
        const detail = profiles.map((p: any) => `• "${p.nom}" actif=${p.actif} user_id=${p.user_id?.slice(0,8)}... mots_cles=[${(p.mots_cles||[]).join(',')}] loc=${p.localisation}`).join('\n')
        updateResult('Search Profiles', {
          status: activeCount > 0 ? 'pass' : 'warn',
          duration: ms,
          details: `${profiles.length} profile(s), ${activeCount} actif(s).\n${detail}`,
          raw: profiles,
        })
        log(`PROFILES: ${profiles.length} total, ${activeCount} active`)
        if (activeCount === 0) log('⚠ WARNING: No active profiles → jobs/fetch will return 400')
      } else {
        const body = await res.json()
        updateResult('Search Profiles', { status: 'fail', duration: ms, details: `HTTP ${res.status}: ${body.error}`, raw: body })
        log(`PROFILES ERROR: ${res.status}`)
      }
    } catch (e: any) {
      updateResult('Search Profiles', { status: 'fail', details: `Network: ${e.message}` })
    }

    // ═══════════════════════════════════════
    // TEST 3: Jobs Fetch
    // ═══════════════════════════════════════
    const jobsTest: TestResult = { name: 'Jobs Fetch (/api/jobs/fetch)', status: 'running', details: '' }
    addResult(jobsTest)
    log('Testing jobs/fetch POST...')
    try {
      const t0 = Date.now()
      const res = await fetch('/api/jobs/fetch', { method: 'POST', signal })
      const ms = Date.now() - t0
      const body = await res.json()
      if (res.ok) {
        updateResult('Jobs Fetch (/api/jobs/fetch)', {
          status: 'pass', duration: ms,
          details: `Inserted: ${body.fetched?.inserted}, Skipped: ${body.fetched?.skipped}, Errors: ${body.fetched?.errors?.length ?? 0}`,
          raw: body,
        })
        log(`JOBS FETCH OK: ${body.fetched?.inserted} inserted, ${ms}ms`)
      } else if (res.status === 400) {
        updateResult('Jobs Fetch (/api/jobs/fetch)', {
          status: 'fail', duration: ms,
          details: `400 Bad Request: "${body.error}"\n\n→ This means no active search profile was found.\n→ Check that profile.actif=true AND profile.user_id matches your session user_id.\n→ Profiles found above: ${profiles.length}. Active: ${profiles.filter((p: any) => p.actif).length}`,
          raw: body,
        })
        log(`JOBS FETCH 400: ${body.error}`)
      } else if (res.status === 429) {
        updateResult('Jobs Fetch (/api/jobs/fetch)', {
          status: 'warn', duration: ms,
          details: `Rate limited (429). Already fetched in last 10min.`,
          raw: body,
        })
        log('JOBS FETCH rate limited')
      } else {
        updateResult('Jobs Fetch (/api/jobs/fetch)', { status: 'fail', duration: ms, details: `HTTP ${res.status}: ${JSON.stringify(body)}`, raw: body })
        log(`JOBS FETCH ERROR: ${res.status}`)
      }
    } catch (e: any) {
      updateResult('Jobs Fetch (/api/jobs/fetch)', { status: 'fail', details: `Network: ${e.message}` })
    }

    // ═══════════════════════════════════════
    // TEST 4: Offers listing
    // ═══════════════════════════════════════
    const offersTest: TestResult = { name: 'Offers List', status: 'running', details: '' }
    addResult(offersTest)
    log('Fetching offers...')
    try {
      const t0 = Date.now()
      const res = await fetch('/api/offers', { signal })
      const ms = Date.now() - t0
      if (res.ok) {
        const data = await res.json()
        const sources = data.reduce((acc: Record<string, number>, o: any) => {
          acc[o.source ?? 'unknown'] = (acc[o.source ?? 'unknown'] ?? 0) + 1
          return acc
        }, {})
        updateResult('Offers List', {
          status: data.length > 0 ? 'pass' : 'warn',
          duration: ms,
          details: `${data.length} offre(s). Sources: ${JSON.stringify(sources)}`,
          raw: { count: data.length, sources, sample: data.slice(0, 3).map((o: any) => ({ titre: o.titre, entreprise: o.entreprise, source: o.source })) },
        })
        log(`OFFERS: ${data.length} total`)
      } else {
        const body = await res.json()
        updateResult('Offers List', { status: 'fail', duration: ms, details: `HTTP ${res.status}: ${body.error}`, raw: body })
      }
    } catch (e: any) {
      updateResult('Offers List', { status: 'fail', details: `Network: ${e.message}` })
    }

    // ═══════════════════════════════════════
    // TEST 5: Applications CRUD
    // ═══════════════════════════════════════
    const appsCrudTest: TestResult = { name: 'Applications CRUD', status: 'running', details: '' }
    addResult(appsCrudTest)
    log('Testing applications CRUD...')
    try {
      const t0 = Date.now()
      // Create test application
      const createRes = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entreprise: '__TEST_DIAG__',
          poste: 'Test Diagnostic',
          type_contrat: 'interim',
          source: 'test-page',
        }),
        signal,
      })
      const createBody = await createRes.json()
      if (!createRes.ok) {
        updateResult('Applications CRUD', { status: 'fail', duration: Date.now() - t0, details: `Create failed: ${createBody.error}`, raw: createBody })
        log(`CRUD CREATE FAIL: ${createBody.error}`)
      } else {
        const testId = createBody.id
        log(`CRUD created: ${testId}`)

        // Read
        const listRes = await fetch('/api/applications', { signal })
        const listData = await listRes.json()
        const found = listData.find((a: any) => a.id === testId)

        // Delete
        const delRes = await fetch(`/api/applications/${testId}`, { method: 'DELETE', signal })
        const delOk = delRes.ok || delRes.status === 204
        const ms = Date.now() - t0

        updateResult('Applications CRUD', {
          status: found && delOk ? 'pass' : 'warn',
          duration: ms,
          details: `Create: ✓ (id=${testId})\nRead: ${found ? '✓ found in list' : '✗ not found'}\nDelete: ${delOk ? '✓' : `✗ HTTP ${delRes.status}`}`,
          raw: { createBody, foundInList: !!found, deleteStatus: delRes.status },
        })
        log(`CRUD full cycle: ${ms}ms`)
      }
    } catch (e: any) {
      updateResult('Applications CRUD', { status: 'fail', details: `Error: ${e.message}` })
    }

    // ═══════════════════════════════════════
    // TEST 6: Assistant / Groq
    // ═══════════════════════════════════════
    const assistantTest: TestResult = { name: 'Assistant (Groq)', status: 'running', details: '' }
    addResult(assistantTest)
    log('Testing assistant/process...')
    try {
      const t0 = Date.now()
      const res = await fetch('/api/assistant/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcription: "combien de candidatures j'ai en cours ?" }),
        signal,
      })
      const ms = Date.now() - t0
      const body = await res.json()
      if (res.ok) {
        updateResult('Assistant (Groq)', {
          status: 'pass', duration: ms,
          details: `Intent: ${body.intent}, Confidence: ${body.confidence}\nMessage: "${body.message}"\nExecuted: ${body.executed}`,
          raw: body,
        })
        log(`ASSISTANT OK: intent=${body.intent}, ${ms}ms`)
      } else if (res.status === 503) {
        updateResult('Assistant (Groq)', {
          status: 'fail', duration: ms,
          details: `503: Groq unavailable.\n→ Check GROQ_API_KEY in Netlify env vars.\n→ Response: ${body.message}`,
          raw: body,
        })
        log('ASSISTANT 503: Groq down or missing API key')
      } else {
        updateResult('Assistant (Groq)', { status: 'fail', duration: ms, details: `HTTP ${res.status}: ${JSON.stringify(body)}`, raw: body })
        log(`ASSISTANT ERROR: ${res.status}`)
      }
    } catch (e: any) {
      updateResult('Assistant (Groq)', { status: 'fail', details: `Network: ${e.message}` })
    }

    // ═══════════════════════════════════════
    // TEST 7: Speech Recognition (browser)
    // ═══════════════════════════════════════
    const speechTest: TestResult = { name: 'Speech Recognition (browser)', status: 'running', details: '' }
    addResult(speechTest)
    log('Testing SpeechRecognition API...')
    try {
      const w = window as any
      const SpeechAPI = w.SpeechRecognition || w.webkitSpeechRecognition
      if (!SpeechAPI) {
        updateResult('Speech Recognition (browser)', {
          status: 'fail',
          details: 'SpeechRecognition API not available.\n→ Use Chrome or Edge.\n→ Firefox/Safari do not support this API.',
        })
        log('SPEECH: API not available')
      } else {
        const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost'
        const hasMicPermission = navigator.mediaDevices ? true : false
        let micStatus = 'unknown'
        try {
          const permResult = await navigator.permissions.query({ name: 'microphone' as PermissionName })
          micStatus = permResult.state
        } catch { micStatus = 'query not supported' }

        updateResult('Speech Recognition (browser)', {
          status: isSecure ? 'pass' : 'fail',
          details: [
            `SpeechRecognition API: ✓ Available`,
            `Protocol: ${window.location.protocol} ${isSecure ? '✓' : '✗ HTTPS required for mic!'}`,
            `Microphone permission: ${micStatus}`,
            `mediaDevices API: ${hasMicPermission ? '✓' : '✗'}`,
            `UserAgent: ${navigator.userAgent.slice(0, 80)}`,
            '',
            micStatus === 'denied' ? '→ Mic blocked! Click lock icon in address bar → allow microphone.' : '',
            !isSecure ? '→ "network" error = non-HTTPS. Speech API requires HTTPS.' : '',
          ].filter(Boolean).join('\n'),
        })
        log(`SPEECH: available, secure=${isSecure}, mic=${micStatus}`)
      }
    } catch (e: any) {
      updateResult('Speech Recognition (browser)', { status: 'fail', details: `Error: ${e.message}` })
    }

    // ═══════════════════════════════════════
    // TEST 8: Email OAuth tokens
    // ═══════════════════════════════════════
    const emailTest: TestResult = { name: 'Email OAuth Tokens', status: 'running', details: '' }
    addResult(emailTest)
    log('Checking OAuth tokens via settings...')
    try {
      const t0 = Date.now()
      // We don't have a direct endpoint for tokens, check email sync
      const res = await fetch('/api/emails/sync', { method: 'POST', signal })
      const ms = Date.now() - t0
      const body = await res.json()
      if (res.ok) {
        updateResult('Email OAuth Tokens', {
          status: (body.synced?.gmail > 0) ? 'pass' : 'warn',
          duration: ms,
          details: [
            `Gmail emails synced: ${body.synced?.gmail ?? 0}`,
            body.synced?.errors?.length > 0 ? `Errors: ${body.synced.errors.join(', ')}` : '',
            '',
            body.synced?.gmail === 0 ? '→ 0 emails: no OAuth token, token expired, or no job-related emails in last 24h.' : '',
            '→ To connect Gmail: go to Paramètres > Connecter Gmail',
            '→ Requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI env vars',
          ].filter(Boolean).join('\n'),
          raw: body,
        })
        log(`EMAIL SYNC: gmail=${body.synced?.gmail}, outlook=${body.synced?.outlook}`)
      } else if (res.status === 401) {
        updateResult('Email OAuth Tokens', {
          status: 'fail', duration: ms,
          details: 'Unauthorized — not logged in or CRON_SECRET not matching.',
          raw: body,
        })
        log('EMAIL SYNC: 401')
      } else {
        updateResult('Email OAuth Tokens', { status: 'fail', duration: ms, details: `HTTP ${res.status}: ${JSON.stringify(body)}`, raw: body })
      }
    } catch (e: any) {
      updateResult('Email OAuth Tokens', { status: 'fail', details: `Network: ${e.message}` })
    }

    // ═══════════════════════════════════════
    // TEST 9: Environment check
    // ═══════════════════════════════════════
    const envTest: TestResult = { name: 'Environment', status: 'pass', details: '' }
    addResult(envTest)
    const envDetails = [
      `URL: ${window.location.origin}`,
      `Protocol: ${window.location.protocol}`,
      `NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓ set' : '✗ MISSING'}`,
      `NEXT_PUBLIC_SUPABASE_ANON_KEY: ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✓ set (' + process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.slice(0, 20) + '...)' : '✗ MISSING'}`,
      `NEXT_PUBLIC_APP_URL: ${process.env.NEXT_PUBLIC_APP_URL ?? '✗ MISSING'}`,
    ]
    const envMissing = envDetails.filter(d => d.includes('MISSING'))
    updateResult('Environment', {
      status: envMissing.length > 0 ? 'fail' : 'pass',
      details: envDetails.join('\n'),
    })
    log(`ENV: ${envMissing.length} missing vars`)

    setRunning(false)
    log('═══ All tests complete ═══')
  }

  const stop = () => {
    abortRef.current?.abort()
    setRunning(false)
  }

  const passCount = results.filter(r => r.status === 'pass').length
  const failCount = results.filter(r => r.status === 'fail').length
  const warnCount = results.filter(r => r.status === 'warn').length

  return (
    <div className="max-w-4xl space-y-6 py-2">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-5 rounded-full" style={{ background: 'linear-gradient(to bottom, #f59e0b, #ef4444)' }} />
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Diagnostic</h1>
        </div>
        <p className="text-muted text-sm ml-3.5">Test complet de toutes les fonctionnalités</p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={running ? stop : runAllTests}
          className={`text-sm font-semibold px-5 py-2.5 rounded-lg inline-flex items-center gap-2 ${
            running
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'btn-accent text-white'
          }`}
        >
          {running ? '■ Stop' : '▶ Lancer tous les tests'}
        </button>
        {results.length > 0 && (
          <span className="text-sm text-muted">
            <span className="text-green-400">{passCount}✓</span>{' '}
            <span className="text-red-400">{failCount}✗</span>{' '}
            <span className="text-yellow-400">{warnCount}⚠</span>
          </span>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          {results.map((r) => (
            <div
              key={r.name}
              className={`rounded-xl border p-4 ${
                r.status === 'fail' ? 'border-red-500/30 bg-red-500/5' :
                r.status === 'warn' ? 'border-yellow-500/30 bg-yellow-500/5' :
                r.status === 'pass' ? 'border-green-500/20 bg-green-500/5' :
                'border-border bg-card'
              }`}
            >
              <div className="flex items-start gap-3">
                <StatusIcon status={r.status} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-foreground font-semibold text-sm">{r.name}</h3>
                    {r.duration && <span className="text-muted text-xs font-mono">{r.duration}ms</span>}
                  </div>
                  <pre className="text-sm text-foreground-dim mt-1 whitespace-pre-wrap">{r.details}</pre>
                  {r.raw !== undefined && <LogBlock label="Raw JSON response" data={r.raw} />}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Global log */}
      {globalLog.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-foreground font-semibold text-sm">Console Log</h2>
            <button onClick={() => setGlobalLog([])} className="text-xs text-muted hover:text-foreground">Clear</button>
          </div>
          <pre className="p-4 text-xs text-foreground-dim font-mono max-h-80 overflow-y-auto whitespace-pre-wrap">
            {globalLog.join('\n')}
          </pre>
        </div>
      )}

      {/* Quick fixes guide */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-foreground font-semibold text-sm mb-3">Guide de dépannage rapide</h2>
        <div className="space-y-3 text-xs text-muted">
          <div>
            <p className="text-foreground-dim font-medium">❌ jobs/fetch 400 "No active search profile"</p>
            <p>Le profil existe mais user_id ne match pas, OU actif=false. Vérifier dans Supabase &gt; search_profiles que user_id = votre auth user id.</p>
          </div>
          <div>
            <p className="text-foreground-dim font-medium">❌ Erreur microphone: network</p>
            <p>SpeechRecognition nécessite HTTPS. Sur HTTP ou si le certificat est invalide → &quot;network&quot; error. Vérifier que vous êtes sur https://jobtrackeria.netlify.app</p>
          </div>
          <div>
            <p className="text-foreground-dim font-medium">❌ Assistant 503</p>
            <p>GROQ_API_KEY manquante dans Netlify &gt; Environment Variables. Ou quota Groq épuisé.</p>
          </div>
          <div>
            <p className="text-foreground-dim font-medium">❌ Email sync 0 résultats</p>
            <p>1) Pas de token OAuth → aller dans Paramètres &gt; Connecter Gmail. 2) Token expiré sans refresh_token. 3) Pas d&apos;emails job-related dans les 24h. 4) GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI manquants dans Netlify env.</p>
          </div>
          <div>
            <p className="text-foreground-dim font-medium">⚠ 0 offres après fetch</p>
            <p>Les scrapers (apec, hellowork, france_travail) sont des stubs — seul jsearch est implémenté. Vérifier RAPIDAPI_KEY dans Netlify env.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
