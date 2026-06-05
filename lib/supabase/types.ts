export type ApplicationStatus = 'en_cours' | 'termine' | 'relance'
export type ApplicationResult = 'accepte' | 'refus' | 'sans_reponse'
export type ContractType = 'interim' | 'stage' | 'cdi' | 'cdd' | 'alternance'
export type OfferStatus = 'non_traite' | 'ignore' | 'postule' | 'sauvegarde'
export type EmailType = 'offre' | 'reponse' | 'relance' | 'autre'
export type OAuthProvider = 'gmail' | 'outlook'

export interface Application {
  id: string
  user_id: string
  entreprise: string
  poste: string
  lien_offre: string | null
  statut: ApplicationStatus
  resultat: ApplicationResult | null
  type_contrat: ContractType | null
  date_postulation: string
  notes: string | null
  source: string
  created_at: string
  updated_at: string
}

export interface Offer {
  id: string
  user_id: string
  titre: string
  entreprise: string | null
  lien: string | null
  salaire_min: number | null
  salaire_max: number | null
  localisation: string | null
  source: string | null
  type_contrat: string | null
  statut: OfferStatus
  date_scraped: string
  raw_data: Record<string, unknown> | null
}

export interface EmailImport {
  id: string
  user_id: string
  provider: OAuthProvider | null
  email_id: string | null
  expediteur: string | null
  sujet: string | null
  date_reception: string | null
  type_detecte: EmailType | null
  application_id: string | null
  offer_id: string | null
  parsed_data: Record<string, unknown> | null
  traite: boolean
}

export interface SearchProfile {
  id: string
  user_id: string
  nom: string | null
  actif: boolean
  type_contrat: string[] | null
  mots_cles: string[] | null
  mots_cles_exclus: string[] | null
  qualifications: string[] | null
  duree_contrat: 'peu_importe' | '1_semaine' | '2_semaines' | '3_semaines' | 'moins_1_mois' | '1_3_mois' | '3_6_mois' | '6_plus' | null
  localisation: string | null
  rayon_km: number
  salaire_min: number | null
  created_at: string
}

export interface OAuthToken {
  id: string
  user_id: string
  provider: OAuthProvider | null
  access_token: string | null
  refresh_token: string | null
  expires_at: string | null
  scopes: string[] | null
}

export interface AssistantLog {
  id: string
  user_id: string
  transcription: string | null
  intent: string | null
  action_taken: string | null
  success: boolean | null
  created_at: string
}

export type Database = {
  public: {
    Tables: {
      applications: { Row: Application; Insert: Omit<Application, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Application, 'id' | 'user_id'>>; Relationships: [] }
      offers: { Row: Offer; Insert: Omit<Offer, 'id' | 'date_scraped'>; Update: Partial<Omit<Offer, 'id' | 'user_id'>>; Relationships: [] }
      email_imports: { Row: EmailImport; Insert: Omit<EmailImport, 'id'>; Update: Partial<Omit<EmailImport, 'id' | 'user_id'>>; Relationships: [] }
      search_profiles: { Row: SearchProfile; Insert: Omit<SearchProfile, 'id' | 'created_at'>; Update: Partial<Omit<SearchProfile, 'id' | 'user_id'>>; Relationships: [] }
      oauth_tokens: { Row: OAuthToken; Insert: Omit<OAuthToken, 'id'>; Update: Partial<Omit<OAuthToken, 'id' | 'user_id'>>; Relationships: [] }
      assistant_logs: { Row: AssistantLog; Insert: Omit<AssistantLog, 'id' | 'created_at'>; Update: Partial<Omit<AssistantLog, 'id' | 'user_id'>>; Relationships: [] }
    }
    Views: Record<never, never>
    Functions: Record<never, never>
  }
}
