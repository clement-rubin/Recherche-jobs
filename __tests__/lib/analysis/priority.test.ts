/**
 * @jest-environment node
 */
import {
  computeMatchScore, computeUrgency, computePriority, daysBetween,
} from '@/lib/analysis/priority'
import type { Requirement } from '@/lib/analysis/types'

const req = (over: Partial<Requirement> = {}): Requirement => ({
  competence: 'Python', obligatoire: true, present: true, preuve_cv: 'Fridgia', bloquante: false, ...over,
})

const TODAY = '2026-10-08'

describe('daysBetween', () => {
  it('counts calendar days', () => {
    expect(daysBetween('2026-10-08', '2026-10-15')).toBe(7)
    expect(daysBetween('2026-10-08', '2026-10-07')).toBe(-1)
    expect(daysBetween('2026-10-08', '2026-10-08')).toBe(0)
  })
})

describe('computeMatchScore', () => {
  it('gives 100 when everything is present and domain matches', () => {
    expect(computeMatchScore([req(), req({ competence: 'SQL' }), req({ competence: 'Docker', obligatoire: false })], true)).toBe(100)
  })

  it('gives 90 with no requirements and no domain match (70 + 20)', () => {
    expect(computeMatchScore([], false)).toBe(90)
  })

  it('weights obligatoires 70 and souhaitees 20', () => {
    // 1/2 obligatoires = 35, 0/1 souhaitees = 0, no domain
    expect(computeMatchScore([req(), req({ present: false }), req({ obligatoire: false, present: false })], false)).toBe(35)
  })

  it('caps at 40 when a bloquante requirement is missing', () => {
    const exigences = [req(), req(), req({ present: false, bloquante: true })]
    // uncapped would be round(46.67 + 20 + 10) = 77
    expect(computeMatchScore(exigences, true)).toBe(40)
  })

  it('does not cap when the bloquante requirement is present', () => {
    expect(computeMatchScore([req({ bloquante: true })], true)).toBe(100)
  })
})

describe('computeUrgency', () => {
  it.each([
    ['2026-10-08', 100], // today
    ['2026-10-15', 100], // +7
    ['2026-10-16', 85],  // +8
    ['2026-10-22', 85],  // +14
    ['2026-10-23', 60],  // +15
    ['2026-11-07', 60],  // +30
    ['2026-11-08', 30],  // +31
  ])('deadline %s -> %i', (date, expected) => {
    expect(computeUrgency(date, TODAY)).toBe(expected)
  })

  it('is neutral (50) when there is no deadline or it is malformed', () => {
    expect(computeUrgency(null, TODAY)).toBe(50)
    expect(computeUrgency('bientôt', TODAY)).toBe(50)
  })
})

describe('computePriority', () => {
  it('marks a past deadline as expiree with score 0', () => {
    expect(computePriority(90, '2026-10-07', TODAY)).toEqual({ niveau: 'expiree', score: 0, urgence: 0 })
  })

  it('combines 70% match and 30% urgency', () => {
    expect(computePriority(80, '2026-10-15', TODAY)).toEqual({ niveau: 'haute', score: 86, urgence: 100 })
  })

  it.each([
    [42, 44, 'basse'],
    [43, 45, 'moyenne'],
    [77, 69, 'moyenne'],
    [78, 70, 'haute'],
  ])('with no deadline, match %i -> score %i (%s)', (match, score, niveau) => {
    expect(computePriority(match, null, TODAY)).toEqual({ niveau, score, urgence: 50 })
  })
})
