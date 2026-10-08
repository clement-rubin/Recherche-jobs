import type { Lang } from './types'

const FR = new Set(['le', 'la', 'les', 'des', 'du', 'de', 'et', 'un', 'une', 'pour', 'vous', 'nous', 'avec', 'dans', 'sur', 'est', 'en', 'au', 'aux', 'notre', 'votre', 'stage', 'poste'])
const EN = new Set(['the', 'and', 'for', 'you', 'with', 'are', 'our', 'your', 'will', 'to', 'of', 'in', 'is', 'we', 'as', 'an', 'team', 'role', 'experience'])

export function detectLang(text: string): Lang {
  const words = text.toLowerCase().replace(/[’']/g, ' ').match(/[a-zà-ÿ]+/g) ?? []
  let fr = 0
  let en = 0
  for (const w of words) {
    if (FR.has(w)) fr++
    if (EN.has(w)) en++
  }
  if (fr + en < 5) return 'autre'
  if (fr >= en * 1.3) return 'fr'
  if (en >= fr * 1.3) return 'en'
  return 'autre'
}
