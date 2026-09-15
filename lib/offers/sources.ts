export const SOURCE_LABELS: Record<string, string> = {
  jsearch: 'JSearch',
  apec: 'APEC',
  hellowork: 'HelloWork',
  france_travail: 'France Travail',
  eures: 'EURES',
  email: 'Email',
}

export function sourceLabel(source: string | null | undefined): string {
  // Empty string counts as missing too — a labeled "Inconnu" badge beats a blank one.
  if (!source) return 'Inconnu'
  return SOURCE_LABELS[source] ?? source
}
