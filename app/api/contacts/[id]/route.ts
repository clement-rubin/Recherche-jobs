import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { CONTACT_STATUSES, normalizeLinkedInUrl } from '@/lib/contacts'

type RouteParams = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const raw = await req.json()
  const body: Record<string, unknown> = {}
  if (raw.nom !== undefined) {
    const nom = typeof raw.nom === 'string' ? raw.nom.trim() : ''
    if (!nom) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })
    body.nom = nom
  }
  if (raw.linkedin_url !== undefined) {
    const url = normalizeLinkedInUrl(raw.linkedin_url)
    if (!url) return NextResponse.json({ error: 'Lien LinkedIn invalide' }, { status: 400 })
    body.linkedin_url = url
  }
  if (raw.statut !== undefined) {
    if (!CONTACT_STATUSES.includes(raw.statut)) return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
    body.statut = raw.statut
    if (raw.statut === 'a_contacter') body.date_contact = null
    else if (raw.date_contact === undefined) body.date_contact = new Date().toISOString().slice(0, 10)
  }
  for (const k of ['poste', 'entreprise', 'notes', 'profil_texte'] as const) {
    if (raw[k] !== undefined) body[k] = raw[k] || null
  }
  if (raw.date_contact !== undefined && body.date_contact === undefined) body.date_contact = raw.date_contact || null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('linkedin_contacts')
    .update(body)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase.from('linkedin_contacts').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
