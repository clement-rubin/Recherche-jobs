import { PROFILE } from './profile'
import type { OfferData } from './scraper'
import type { CompanyData } from './company'

export interface FitResult {
  score: number
  verdict: string
  detail_scores: Record<string, number>
  points_forts: string[]
  angles_lettre: string[]
  cv_adapter: string[]
  pieges: string[]
  si_match_faible: string[]
  mots_cles_ats: string[]
  conseils_ats: string[]
}

function matchedSkills(text: string): string[] {
  return PROFILE.competences.filter(skill => text.toLowerCase().includes(skill.toLowerCase()))
}

const ATS_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'are', 'was', 'were', 'from', 'have', 'has',
  'not', 'but', 'you', 'your', 'its', 'all', 'any', 'can', 'will', 'just', 'more', 'than',
  'de', 'le', 'la', 'les', 'un', 'une', 'des', 'du', 'et', 'en', 'pour', 'dans', 'avec', 'sur',
  'que', 'qui', 'pas', 'plus', 'par', 'est', 'sont', 'être', 'etre', 'avoir', 'ce', 'cette',
  'ces', 'notre', 'votre', 'nous', 'vous', 'ils', 'elles', 'il', 'elle', 'stage', 'stagiaire',
])

// Mots significatifs du titre de poste (hors mots vides) : à reprendre tels
// quels dans le CV/la lettre pour matcher le titre exact recherché par les
// filtres ATS/IA.
function titleKeywords(title: string): string[] {
  return (title.match(/[a-zA-ZÀ-ÿ0-9+#.]{3,}/g) || [])
    .map(w => w.trim())
    .filter(w => w.length >= 3 && !ATS_STOPWORDS.has(w.toLowerCase()))
}

export function analyzeFit(offer: OfferData, company: CompanyData): FitResult {
  const text = (offer.description_brute + ' ' + offer.titre).toLowerCase()
  const titleLower = offer.titre.toLowerCase()
  const details: Record<string, number> = {}

  // Type de contrat = stage (30 pts)
  const stageKw = ['stage', 'stagiaire', 'internship', 'intern', 'trainee', 'praktikum', 'becario', 'tirocinio']
  const isStage = (offer.type_contrat?.toLowerCase().includes('stage') ?? false) ||
    (offer.type_contrat?.toLowerCase().includes('intern') ?? false) ||
    stageKw.some(kw => text.includes(kw))
  details.contrat_stage = isStage ? 30 : 0

  // Période compatible (15 pts — 5 par défaut si non mentionné)
  const periodKw = ['avril 2027', 'april 2027', 'mai 2027', 'may 2027', '3 mois', '3-month', 'three months', 'trois mois']
  const hasPeriod = periodKw.some(kw => text.includes(kw))
  details.periode = hasPeriod ? 15 : 5

  // Compétences matchées (20 pts)
  const matched = matchedSkills(text)
  details.competences = Math.min(20, Math.round((matched.length / PROFILE.competences.length) * 20))

  // Aspect client/consulting (15 pts)
  const consultingKw = ['consulting', 'conseil', 'client', 'customer-facing', 'customer facing', 'stakeholder']
  const hasConsulting = consultingKw.some(kw => text.includes(kw))
  details.consulting = hasConsulting ? 15 : 0

  // Pas de mot senior/lead dans le titre (10 pts)
  const seniorKw = ['senior', 'sr.', 'lead', 'principal', 'confirmé', 'expérimenté', 'head of', 'manager', 'directeur', 'director']
  const hasSenior = seniorKw.some(kw => titleLower.includes(kw))
  details.pas_senior = hasSenior ? 0 : 10

  // Domaine data (10 pts)
  const dataKw = ['data', 'analytics', 'analyst', 'engineer', 'engineering', 'science', 'scientist', 'business intelligence', 'machine learning']
  const hasData = dataKw.some(kw => text.includes(kw))
  details.domaine_data = hasData ? 10 : 0

  const score = Math.min(100, Object.values(details).reduce((a, b) => a + b, 0))

  let verdict: string
  if (score >= 80) verdict = 'Excellent match — candidature fortement conseillée'
  else if (score >= 60) verdict = 'Bon match — tu as ta chance'
  else if (score >= 40) verdict = 'Match acceptable — compense les lacunes dans ta lettre'
  else verdict = "Match risqué — vérifie si c'est vraiment adapté à ton profil"

  const points_forts: string[] = []
  if (isStage) points_forts.push('✅ Type de contrat correspondant : stage')
  if (matched.length > 0) points_forts.push(`✅ Compétences en commun : ${matched.slice(0, 4).join(', ')}`)
  if (hasConsulting) points_forts.push('✅ Dimension client/conseil présente — correspond à tes préférences')
  if (hasData) points_forts.push('✅ Domaine data confirmé')
  if (company.tech_stack.length > 0) points_forts.push(`✅ Stack tech identifiée : ${company.tech_stack.slice(0, 3).join(', ')}`)
  if (hasPeriod) points_forts.push('✅ Période compatible avec mi-avril / fin mai 2027')
  if (points_forts.length === 0) points_forts.push('Peu de correspondances détectées — voir les conseils ci-dessous')

  const cultureKnown = Boolean(company.culture) && !company.culture.includes('hypothèse')

  const angles_lettre: string[] = []
  if (hasConsulting) {
    angles_lettre.push("Valorise ta capacité à travailler en mode projet client — même en académique (présentations, études de cas, restitutions)")
  }
  if (matched.includes('Python') || matched.includes('SQL')) {
    angles_lettre.push('Cite des projets concrets en Python/SQL avec données réelles et résultats mesurables')
  }
  if (cultureKnown) {
    const snippet = company.culture.length > 160 ? company.culture.slice(0, 157).trimEnd() + '…' : company.culture
    angles_lettre.push(`Appuie-toi sur ce que fait vraiment l'entreprise (source Wikipedia) pour montrer que tu la connais : « ${snippet} »`)
  } else if (company.secteur && !company.secteur.includes('hypothèse')) {
    angles_lettre.push(`Montre que tu comprends le secteur "${company.secteur}" et l'enjeu data dans ce contexte`)
  }
  angles_lettre.push("En M1, mets en avant ta curiosité et ta capacité d'apprentissage rapide sur des technos nouvelles")
  if (angles_lettre.length < 3) {
    angles_lettre.push("Illustre l'impact de tes projets Data Viz ou dashboards avec des métriques business")
  }

  const cv_adapter: string[] = [
    'Mets les compétences data en premier : Python, SQL, et les outils spécifiques au poste',
    'Formule chaque projet avec un résultat concret : "réduit le temps de X%", "analysé N sources de données"',
  ]
  if (hasConsulting) {
    cv_adapter.push('Inclus une ligne sur les restitutions ou présentations à des non-techniciens')
  }

  // ---------------------------------------------------------------------
  // Optimisation ATS / filtrage IA : les filtres de recrutement combinent
  // un matching par mots-clés exacts et un scoring contextuel par IA (NLP)
  // qui reconnaît les synonymes mais score nettement mieux les termes
  // repris mot pour mot. Voir sources dans le plan/PR.
  // ---------------------------------------------------------------------
  const motsClesSet = new Set<string>(offer.competences_extraites)
  for (const kw of titleKeywords(offer.titre)) motsClesSet.add(kw)
  const mots_cles_ats = Array.from(motsClesSet).slice(0, 15)

  const conseils_ats: string[] = []
  if (mots_cles_ats.length > 0) {
    conseils_ats.push(
      `Reprends ces mots-clés tels quels dans le CV et la lettre, sans les paraphraser : ${mots_cles_ats.slice(0, 8).join(', ')} — un match exact score toujours mieux qu'une reformulation`
    )
  }
  conseils_ats.push('Place les mots-clés les plus importants dès le résumé/profil en tête de CV et dans la première ligne de chaque expérience : les filtres pondèrent plus fort ce qui est en tête de section')
  conseils_ats.push('Écris l\'acronyme ET le terme complet à la première occurrence (ex. "Machine Learning (ML)") pour matcher les deux formes de recherche')
  conseils_ats.push('CV au format simple : intitulés de section classiques (Expérience, Formation, Compétences), pas de tableaux/colonnes/zones de texte/graphiques que les parseurs ATS ignorent souvent, police standard (Arial/Calibri), export PDF texte (pas une image scannée)')
  conseils_ats.push('Quantifie chaque réalisation (%, volumes de données, nombre de projets) plutôt que des formulations vagues')
  conseils_ats.push('Dans la lettre, n\'empile pas les mots-clés en liste brute : intègre-les dans des phrases avec verbe d\'action + résultat chiffré, le scoring contextuel pénalise le bourrage de mots-clés isolés')
  conseils_ats.push('Adapte ces mots-clés à CHAQUE offre plutôt que de réutiliser un CV générique — le taux de passage chute fortement sinon')

  const pieges: string[] = []
  if (hasSenior) pieges.push("⚠️ Titre contient senior/lead — vérifie que le profil étudiant est accepté dans l'offre")
  if (!isStage) pieges.push("⚠️ Type de contrat incertain — confirme que c'est bien un stage avant de postuler")
  if (details.competences < 8) pieges.push("⚠️ Peu de compétences en commun — sois honnête sur ton niveau, ne surjoue pas dans la lettre")
  pieges.push("Ne mentionne pas ton manque d'expérience professionnelle — parle de projets et de ta formation")

  const si_match_faible: string[] = []
  if (score < 60) {
    si_match_faible.push("Cible d'abord des ESN et cabinets de conseil qui recrutent explicitement des étudiants data")
    si_match_faible.push("Cherche sur WTTJ et France Travail avec le filtre « stage » + « data » + « junior »")
    if (!hasConsulting) {
      si_match_faible.push("Préfère des offres avec dimension client/conseil — c'est ton point différenciant")
    }
  }

  return {
    score, verdict, detail_scores: details, points_forts, angles_lettre, cv_adapter, pieges,
    si_match_faible, mots_cles_ats, conseils_ats,
  }
}
