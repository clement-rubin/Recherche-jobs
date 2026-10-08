/**
 * @jest-environment node
 */
import { detectLang } from '@/lib/analysis/lang'

describe('detectLang', () => {
  it('detects French', () => {
    expect(detectLang("Nous recherchons un stagiaire pour rejoindre notre équipe data. Vous travaillerez avec les équipes de la direction et vous participerez à des projets dans un environnement exigeant.")).toBe('fr')
  })

  it('detects English', () => {
    expect(detectLang('We are looking for an intern to join our team. You will work with the data team and support the analysis of customer projects in a fast environment.')).toBe('en')
  })

  it('returns autre for another language', () => {
    expect(detectLang('Wir suchen einen Praktikanten für unser Team im Bereich Datenanalyse. Sie arbeiten mit Python und SQL und unterstützen unsere Kunden bei der Auswertung.')).toBe('autre')
  })

  it('returns autre when the text is too short to tell', () => {
    expect(detectLang('Data analyst')).toBe('autre')
  })
})
