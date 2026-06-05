import * as cheerio from 'cheerio'
import type { ScrapedJob } from './jsearch'

const HW_CONTRACT_MAP: Record<string, string> = {
  interim: 'INTERIM',
  cdi: 'CDI',
  cdd: 'CDD',
  alternance: 'ALTERNANCE',
  stage: 'STAGE',
}

export async function fetchHelloWork(
  keywords: string,
  location: string,
  typeContrats?: string[]
): Promise<ScrapedJob[]> {
  try {
    const contractFilter =
      typeContrats && typeContrats.length > 0
        ? typeContrats.map(t => HW_CONTRACT_MAP[t.toLowerCase()] ?? t.toUpperCase()).join(',')
        : 'CDI,CDD,INTERIM,STAGE,ALTERNANCE'
    const url = `https://www.hellowork.com/fr-fr/emploi/recherche.html?k=${encodeURIComponent(keywords)}&l=${encodeURIComponent(location)}&c=${contractFilter}`

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
    })

    if (!res.ok) return []

    const html = await res.text()
    const $ = cheerio.load(html)
    const jobs: ScrapedJob[] = []

    // HelloWork uses various selectors — try multiple patterns
    $('[data-id-job], [data-offer-id], article.offer').each((_, el) => {
      const titleEl = $(el).find('[data-cy="jobTitle"], .job-title, h2, h3').first()
      const companyEl = $(el).find('[data-cy="company"], .company-name, .employer').first()
      const linkEl = $(el).find('a[href*="/emploi/"]').first()
      const contractEl = $(el).find('[data-cy="contract"], .contract-type').first()

      const titre = titleEl.text().trim()
      if (!titre) return // Skip if no title found

      const href = linkEl.attr('href')
      jobs.push({
        titre,
        entreprise: companyEl.text().trim() || null,
        lien: href ? (href.startsWith('http') ? href : `https://www.hellowork.com${href}`) : null,
        localisation: location,
        source: 'hellowork',
        type_contrat: contractEl.text().trim() || null,
        salaire_min: null,
        salaire_max: null,
        raw_data: {},
      })
    })

    return jobs.slice(0, 20)
  } catch {
    return []
  }
}
