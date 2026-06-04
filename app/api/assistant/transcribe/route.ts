import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const form = await req.formData()
  const audio = form.get('audio') as File | null
  if (!audio || audio.size === 0) {
    return NextResponse.json({ error: 'No audio', message: 'Aucun audio reçu' }, { status: 400 })
  }

  console.log('[transcribe] Received audio', { size: audio.size, type: audio.type, user: user.id })

  try {
    const transcription = await groq.audio.transcriptions.create({
      file: audio,
      model: 'whisper-large-v3-turbo',
      language: 'fr',
      response_format: 'json',
    })

    console.log('[transcribe] Groq Whisper result:', { text: transcription.text?.slice(0, 80) })

    if (!transcription.text?.trim()) {
      return NextResponse.json({ error: 'Empty transcript', message: "Aucune parole détectée" }, { status: 422 })
    }

    return NextResponse.json({ text: transcription.text.trim() })
  } catch (err: unknown) {
    console.error('[transcribe] Groq Whisper error:', err)
    const msg = (err as { message?: string }).message ?? 'Unknown error'
    return NextResponse.json(
      { error: 'Transcription failed', message: `Transcription impossible: ${msg}` },
      { status: 503 }
    )
  }
}
