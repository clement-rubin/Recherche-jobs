import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

type RouteParams = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rawBody = await req.json()
  const body: Record<string, unknown> = {
    ...(rawBody.nom              !== undefined && { nom: rawBody.nom }),
    ...(rawBody.actif            !== undefined && { actif: rawBody.actif }),
    ...(rawBody.domaine          !== undefined && { domaine: rawBody.domaine }),
    ...(rawBody.type_contrat     !== undefined && { type_contrat: rawBody.type_contrat }),
    ...(rawBody.mots_cles        !== undefined && { mots_cles: rawBody.mots_cles }),
    ...(rawBody.mots_cles_exclus !== undefined && { mots_cles_exclus: rawBody.mots_cles_exclus }),
    ...(rawBody.qualifications   !== undefined && { qualifications: rawBody.qualifications }),
    ...(rawBody.duree_contrat    !== undefined && { duree_contrat: rawBody.duree_contrat }),
    ...(rawBody.localisations    !== undefined && { localisations: rawBody.localisations }),
    ...(rawBody.salaire_min      !== undefined && { salaire_min: rawBody.salaire_min }),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // If activating this profile, deactivate all others first
  if (body.actif === true) {
    await db
      .from('search_profiles')
      .update({ actif: false })
      .eq('user_id', user.id)
  }

  const { data, error } = await db
    .from('search_profiles')
    .update(body)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('search_profiles')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
