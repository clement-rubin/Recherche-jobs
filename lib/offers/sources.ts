export const SOURCE_LABELS: Record<string, string> = {
  jsearch: 'JSearch',
  france_travail: 'France Travail',
  eures: 'EURES',
  adzuna: 'Adzuna',
  jooble: 'Jooble',
  reed: 'Reed',
  email: 'Email',
}

export function sourceLabel(source: string | null | undefined): string {
  // Empty string counts as missing too — a labeled "Inconnu" badge beats a blank one.
  if (!source) return 'Inconnu'
  return SOURCE_LABELS[source] ?? source
}
