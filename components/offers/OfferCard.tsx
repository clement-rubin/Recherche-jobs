import type { Offer } from '@/lib/supabase/types'

const SOURCE_LABELS: Record<string, string> = {
  jsearch: 'JSearch',
  apec: 'APEC',
  hellowork: 'HelloWork',
  france_travail: 'France Travail',
  email: 'Email',
}

interface Props {
  offer: Offer
  onAction: (id: string, action: 'postule' | 'ignore' | 'sauvegarde') => Promise<void>
}

export function OfferCard({ offer, onAction }: Props) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 hover:border-accent/50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-foreground font-semibold text-sm truncate">{offer.titre}</h3>
          <p className="text-muted text-xs mt-0.5">
            {offer.entreprise && <span className="font-medium text-foreground/70">{offer.entreprise}</span>}
            {offer.entreprise && offer.localisation && ' · '}
            {offer.localisation}
          </p>
          <div className="flex items-center gap-3 mt-2">
            {offer.type_contrat && (
              <span className="text-muted text-xs capitalize">{offer.type_contrat}</span>
            )}
            {(offer.salaire_min || offer.salaire_max) && (
              <span className="text-success text-xs">
                {offer.salaire_min && `${offer.salaire_min.toLocaleString('fr-FR')}€`}
                {offer.salaire_min && offer.salaire_max && ' – '}
                {offer.salaire_max && `${offer.salaire_max.toLocaleString('fr-FR')}€`}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <span className="text-xs bg-accent/10 text-accent/80 px-2 py-0.5 rounded border border-accent/20">
            {SOURCE_LABELS[offer.source ?? ''] ?? offer.source ?? 'Inconnu'}
          </span>
          {offer.lien && (
            <a
              href={offer.lien}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted text-xs hover:text-accent transition-colors"
            >
              Voir l&apos;offre →
            </a>
          )}
        </div>
      </div>
      <div className="flex gap-2 mt-4 pt-3 border-t border-border">
        <button
          onClick={() => onAction(offer.id, 'postule')}
          className="flex-1 bg-accent hover:bg-indigo-700 text-white text-xs font-medium py-1.5 rounded-lg transition-colors"
        >
          Postuler
        </button>
        <button
          onClick={() => onAction(offer.id, 'sauvegarde')}
          className="flex-1 border border-border text-muted hover:text-foreground hover:border-foreground/30 text-xs py-1.5 rounded-lg transition-colors"
        >
          Sauvegarder
        </button>
        <button
          onClick={() => onAction(offer.id, 'ignore')}
          className="px-3 text-muted hover:text-danger text-xs py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
        >
          Ignorer
        </button>
      </div>
    </div>
  )
}
