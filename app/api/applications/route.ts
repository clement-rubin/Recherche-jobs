import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.warn('[applications] GET Unauthorized')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const statut = searchParams.get('statut')
  const type_contrat = searchParams.get('type_contrat')

  let query = supabase
    .from('applications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (statut) query = query.eq('statut', statut as any)
  if (type_contrat) query = query.eq('type_contrat', type_contrat as any)

  const { data, error } = await query
  if (error) {
    console.error('[applications] GET error', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  console.log('[applications] GET', { userId: user.id, count: data?.length ?? 0, statut, type_contrat })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.warn('[applications] POST Unauthorized')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { data, error } = await supabase
    .from('applications')
    .insert({ ...body, user_id: user.id })
    .select()
    .single()

  if (error) {
    console.error('[applications] POST error', error.message, { entreprise: body.entreprise })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  console.log('[applications] POST created', { userId: user.id, id: (data as any)?.id, entreprise: body.entreprise })
  return NextResponse.json(data, { status: 201 })
}
