import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import type { LinkedInContact } from '@/lib/supabase/types'
import { generateOutreachMessage, OutreachError } from '@/lib/contacts-message'

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.warn('[contacts] message Unauthorized')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('linkedin_contacts')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  const contact = data as LinkedInContact | null
  if (error || !contact) {
    console.warn('[contacts] message contact not found', { userId: user.id, id, dbError: error?.message })
    return NextResponse.json({ error: 'Contact introuvable' }, { status: 404 })
  }
  if (!contact.profil_texte?.trim()) {
    console.warn('[contacts] message no profil_texte', { userId: user.id, id })
    return NextResponse.json({ error: 'Ajoute d’abord les expériences du profil (Modifier)' }, { status: 400 })
  }

  console.log('[contacts] message request', { userId: user.id, id, profileChars: contact.profil_texte.length })
  try {
    const message = await generateOutreachMessage({
      nom: contact.nom,
      poste: contact.poste,
      entreprise: contact.entreprise,
      profil_texte: contact.profil_texte,
    })
    return NextResponse.json({ message })
  } catch (err) {
    if (err instanceof OutreachError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('[contacts] message generation failed (unexpected)', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Génération du message impossible' }, { status: 502 })
  }
}
