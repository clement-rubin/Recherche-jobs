/** Returns a normalized https LinkedIn profile URL, or null if the input isn't a LinkedIn URL. */
export function normalizeLinkedInUrl(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const raw = input.trim()
  if (!raw) return null
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    const url = new URL(withProto)
    const host = url.hostname.toLowerCase()
    if (host !== 'linkedin.com' && !host.endsWith('.linkedin.com')) return null
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    url.protocol = 'https:'
    return url.toString()
  } catch {
    return null
  }
}

export const CONTACT_STATUSES = ['a_contacter', 'contacte', 'repondu'] as const
