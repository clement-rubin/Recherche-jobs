import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const statut = searchParams.get('statut')
  const source = searchParams.get('source')

  let query = supabase
    .from('offers')
    .select('*')
    .eq('user_id', user.id)
    .order('date_scraped', { ascending: false })

  if (statut) query = query.eq('statut', statut as any)
  if (source) query = query.eq('source', source)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const statut = searchParams.get('statut') ?? 'non_traite'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateQuery = (supabase.from('offers') as any)
    .update({ statut: 'ignore' })
    .eq('user_id', user.id)
    .eq('statut', statut)
  const { error } = await updateQuery

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
