import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { CONTACT_STATUSES, normalizeLinkedInUrl } from '@/lib/contacts'

export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('linkedin_contacts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const nom = typeof body.nom === 'string' ? body.nom.trim() : ''
  if (!nom) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })
  const linkedin_url = normalizeLinkedInUrl(body.linkedin_url)
  if (!linkedin_url) return NextResponse.json({ error: 'Lien LinkedIn invalide' }, { status: 400 })
  const statut = body.statut ?? 'a_contacter'
  if (!CONTACT_STATUSES.includes(statut)) return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })

  const row = {
    user_id: user.id,
    nom,
    poste: body.poste || null,
    entreprise: body.entreprise || null,
    linkedin_url,
    profil_texte: body.profil_texte || null,
    statut,
    date_contact: statut === 'a_contacter' ? null : (body.date_contact || new Date().toISOString().slice(0, 10)),
    notes: body.notes || null,
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).from('linkedin_contacts').insert(row).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
