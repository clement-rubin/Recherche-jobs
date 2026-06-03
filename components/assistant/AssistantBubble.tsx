'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface AssistantResponse {
  intent: string
  message: string
  requires_confirmation: boolean
  executed: boolean
}

type AssistantState = 'idle' | 'listening' | 'processing' | 'response' | 'error'

export function AssistantBubble() {
  const [state, setState] = useState<AssistantState>('idle')
  const [transcript, setTranscript] = useState('')
  const [response, setResponse] = useState<AssistantResponse | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const responseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-dismiss response after 6s
  useEffect(() => {
    if (state === 'response' && response) {
      responseTimeoutRef.current = setTimeout(() => {
        setState('idle')
        setResponse(null)
      }, 6000)
    }
    return () => {
      if (responseTimeoutRef.current) clearTimeout(responseTimeoutRef.current)
    }
  }, [state, response])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
  }, [])

  const processTranscription = useCallback(async (text: string) => {
    setState('processing')
    try {
      const res = await fetch('/api/assistant/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcription: text }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.message ?? "Une erreur est survenue")
        setState('error')
        return
      }
      setResponse(data)
      setState('response')
    } catch {
      setErrorMsg("Impossible de contacter l'assistant")
      setState('error')
    }
  }, [])

  const startListening = useCallback(() => {
    if (state === 'listening') {
      stopListening()
      setState('idle')
      return
    }

    type SpeechRecognitionCtor = new () => SpeechRecognition
    const w = window as Window & { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }
    const SpeechRecognitionAPI: SpeechRecognitionCtor | undefined = w.SpeechRecognition || w.webkitSpeechRecognition

    if (!SpeechRecognitionAPI) {
      setErrorMsg("Votre navigateur ne supporte pas la dictée vocale. Utilisez Chrome.")
      setState('error')
      return
    }

    const recognition = new SpeechRecognitionAPI()
    recognition.lang = 'fr-FR'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onstart = () => setState('listening')

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      const text = e.results[0][0].transcript
      setTranscript(text)
      stopListening()
      processTranscription(text)
    }

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      recognitionRef.current = null
      if (e.error !== 'aborted') {
        setErrorMsg(`Erreur microphone: ${e.error}`)
        setState('error')
      } else {
        setState('idle')
      }
    }

    recognition.onend = () => {
      // If still in listening state (no result triggered), reset to idle
      setState(prev => prev === 'listening' ? 'idle' : prev)
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [state, stopListening, processTranscription])

  const dismiss = () => {
    setState('idle')
    setResponse(null)
    setErrorMsg('')
    setTranscript('')
  }

  const getButtonStyle = () => {
    switch (state) {
      case 'listening':
        return 'bg-red-500 hover:bg-red-600 animate-pulse'
      case 'processing':
        return 'bg-amber-500 cursor-wait'
      default:
        return 'bg-accent hover:bg-indigo-700'
    }
  }

  const getButtonTitle = () => {
    switch (state) {
      case 'listening': return 'Cliquer pour arrêter'
      case 'processing': return 'Traitement en cours...'
      default: return 'Parler à Alex (assistant IA)'
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Response tooltip */}
      {(state === 'response' && response) && (
        <div className="bg-card border border-border rounded-xl p-4 max-w-xs shadow-xl animate-in slide-in-from-bottom-2">
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-accent text-xs font-semibold uppercase tracking-wide">Alex</p>
            <button onClick={dismiss} className="text-muted hover:text-foreground text-sm leading-none">×</button>
          </div>
          {transcript && (
            <p className="text-muted text-xs italic mb-1.5 line-clamp-2">&quot;{transcript}&quot;</p>
          )}
          <p className="text-foreground text-sm">{response.message}</p>
          {response.requires_confirmation && (
            <p className="text-warning text-xs mt-2">⚠ Action en attente de confirmation</p>
          )}
          {response.executed && (
            <p className="text-success text-xs mt-1">✓ Mis à jour</p>
          )}
        </div>
      )}

      {/* Error tooltip */}
      {state === 'error' && (
        <div className="bg-card border border-red-500/30 rounded-xl p-4 max-w-xs shadow-xl">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="text-red-400 text-xs font-semibold">Alex</p>
            <button onClick={dismiss} className="text-muted hover:text-foreground text-sm leading-none">×</button>
          </div>
          <p className="text-red-400 text-sm">{errorMsg}</p>
        </div>
      )}

      {/* Mic button */}
      <button
        onClick={startListening}
        disabled={state === 'processing'}
        title={getButtonTitle()}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all ${getButtonStyle()}`}
        aria-label={getButtonTitle()}
      >
        {state === 'processing' ? (
          <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z" />
          </svg>
        )}
      </button>
    </div>
  )
}
