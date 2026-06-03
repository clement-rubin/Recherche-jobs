import type { ApplicationStatus } from '@/lib/supabase/types'

const statusConfig: Record<string, { label: string; className: string }> = {
  en_cours: { label: 'En cours', className: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
  relance: { label: 'Relance', className: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  termine: { label: 'Terminé', className: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  accepte: { label: 'Accepté', className: 'bg-green-500/20 text-green-300 border-green-500/30' },
  refus: { label: 'Refus', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
  sans_reponse: { label: 'Sans réponse', className: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  non_traite: { label: 'À traiter', className: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  ignore: { label: 'Ignoré', className: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  postule: { label: 'Postulé', className: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
  sauvegarde: { label: 'Sauvegardé', className: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
}

export function Badge({ status }: { status: string }) {
  const config = statusConfig[status] ?? { label: status, className: 'bg-gray-500/20 text-gray-400 border-gray-500/30' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${config.className}`}>
      {config.label}
    </span>
  )
}
