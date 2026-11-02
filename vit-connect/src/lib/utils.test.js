import { describe, expect, it } from 'vitest'
import { eventStatus, isAdult, isVitEmail, validateImage, REG_RE, USERNAME_RE } from './utils'

describe('email domain validation', () => {
  it('accepts only @vitstudent.ac.in', () => {
    expect(isVitEmail('a.b2022@vitstudent.ac.in')).toBe(true)
    expect(isVitEmail('A@VITSTUDENT.AC.IN')).toBe(true)
    expect(isVitEmail('a@gmail.com')).toBe(false)
    expect(isVitEmail('a@vitstudent.ac.in.evil.com')).toBe(false)
    expect(isVitEmail('a@evilvitstudent.ac.in')).toBe(false)
    expect(isVitEmail('')).toBe(false)
  })
})
describe('identifiers', () => {
  it('validates reg numbers and usernames', () => {
    expect(REG_RE.test('22BCE1234')).toBe(true); expect(REG_RE.test('22bce1234')).toBe(false); expect(REG_RE.test('BCE1234')).toBe(false)
    expect(USERNAME_RE.test('good_name1')).toBe(true); expect(USERNAME_RE.test('Bad Name')).toBe(false); expect(USERNAME_RE.test('ab')).toBe(false)
  })
})
describe('image validation', () => {
  it('rejects wrong type and oversize files', () => {
    expect(validateImage({ type: 'image/png', size: 1000 })).toBeNull()
    expect(validateImage({ type: 'video/mp4', size: 1000 })).toMatch(/Only JPG/)
    expect(validateImage({ type: 'image/gif', size: 1000 })).toMatch(/Only JPG/)
    expect(validateImage({ type: 'image/jpeg', size: 4 * 1024 * 1024 })).toMatch(/3 MB/)
    expect(validateImage(null)).toBeTruthy()
  })
})
describe('age check', () => {
  const now = new Date('2026-11-02')
  it('requires 18+', () => {
    expect(isAdult('2008-11-03', now)).toBe(false); expect(isAdult('2008-11-02', now)).toBe(true); expect(isAdult('', now)).toBe(false)
  })
})
describe('event status', () => {
  const ev = { event_date: '2026-11-10', start_time: '10:00:00', end_time: '12:00:00' }
  it('distinguishes upcoming, ongoing, completed', () => {
    expect(eventStatus(ev, new Date('2026-11-10T09:00:00'))).toBe('upcoming')
    expect(eventStatus(ev, new Date('2026-11-10T11:00:00'))).toBe('ongoing')
    expect(eventStatus(ev, new Date('2026-11-10T13:00:00'))).toBe('completed')
  })
})
