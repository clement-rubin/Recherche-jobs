import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

type RouteParams = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rawBody = await req.json()
  // Only allow status updates from the UI — no raw_data / titre / source overwrite
  const body = {
    ...(rawBody.statut !== undefined && { statut: rawBody.statut }),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('offers')
    .update(body)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
