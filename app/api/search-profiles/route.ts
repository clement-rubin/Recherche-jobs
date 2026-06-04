import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('search_profiles')
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
  const allowed = {
    nom:             body.nom ?? null,
    actif:           body.actif ?? false,
    type_contrat:    body.type_contrat ?? [],
    mots_cles:       body.mots_cles ?? [],
    mots_cles_exclus: body.mots_cles_exclus ?? [],
    qualifications:  body.qualifications ?? [],
    duree_contrat:   body.duree_contrat ?? 'peu_importe',
    localisation:    body.localisation ?? 'Lille',
    rayon_km:        Number(body.rayon_km ?? 30),
    salaire_min:     body.salaire_min ?? null,
  }
  const { data, error } = await supabase
    .from('search_profiles')
    .insert({ ...allowed, user_id: user.id } as any)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
