import {
  compareTimeStrings,
  daysBetweenInclusive,
  isQuarterTimeString,
  isValidDateString,
  isValidTimeString,
  isValidTimeZone,
} from '../shared/time'

describe('date validation', () => {
  it('accepts real calendar days', () => {
    expect(isValidDateString('2026-09-10')).toBe(true)
    expect(isValidDateString('2024-02-29')).toBe(true) // leap year
  })

  it('rejects impossible or malformed dates', () => {
    expect(isValidDateString('2026-02-30')).toBe(false)
    expect(isValidDateString('2023-02-29')).toBe(false)
    expect(isValidDateString('2026-13-01')).toBe(false)
    expect(isValidDateString('2026-00-10')).toBe(false)
    expect(isValidDateString('2026-9-1')).toBe(false)
    expect(isValidDateString('09/10/2026')).toBe(false)
    expect(isValidDateString('')).toBe(false)
    expect(isValidDateString(null)).toBe(false)
    expect(isValidDateString(undefined)).toBe(false)
    expect(isValidDateString(20260910)).toBe(false)
  })
})

describe('time validation', () => {
  it('accepts 24h HH:mm', () => {
    expect(isValidTimeString('09:00')).toBe(true)
    expect(isValidTimeString('23:59')).toBe(true)
    expect(isValidTimeString('00:00')).toBe(true)
  })

  it('rejects out-of-range or malformed times', () => {
    expect(isValidTimeString('24:00')).toBe(false)
    expect(isValidTimeString('9:00')).toBe(false)
    expect(isValidTimeString('09:0')).toBe(false)
    expect(isValidTimeString('09:60')).toBe(false)
    expect(isValidTimeString('')).toBe(false)
  })

  it('accepts only quarter-hours', () => {
    for (const t of ['09:00', '09:15', '09:30', '09:45', '23:45']) {
      expect(isQuarterTimeString(t)).toBe(true)
    }
  })

  it('rejects non-quarter minutes', () => {
    for (const t of ['09:01', '09:10', '09:20', '09:59', '12:07']) {
      expect(isQuarterTimeString(t)).toBe(false)
    }
  })
})

describe('compareTimeStrings', () => {
  it('orders times chronologically', () => {
    expect(compareTimeStrings('09:00', '17:00')).toBeLessThan(0)
    expect(compareTimeStrings('17:00', '09:00')).toBeGreaterThan(0)
    expect(compareTimeStrings('09:15', '09:15')).toBe(0)
  })
})

describe('daysBetweenInclusive', () => {
  it('counts a single day as 1', () => {
    expect(daysBetweenInclusive('2026-09-10', '2026-09-10')).toBe(1)
  })

  it('counts across month and leap-year boundaries', () => {
    expect(daysBetweenInclusive('2026-09-01', '2026-09-30')).toBe(30)
    expect(daysBetweenInclusive('2024-01-01', '2024-12-31')).toBe(366)
    expect(daysBetweenInclusive('2025-01-01', '2025-12-31')).toBe(365)
  })
})

describe('timezone validation', () => {
  it('accepts real IANA names', () => {
    expect(isValidTimeZone('Europe/Oslo')).toBe(true)
    expect(isValidTimeZone('America/New_York')).toBe(true)
    expect(isValidTimeZone('UTC')).toBe(true)
  })

  it('rejects typos and junk', () => {
    expect(isValidTimeZone('Oslo/Europe')).toBe(false)
    expect(isValidTimeZone('Mars/Olympus')).toBe(false)
    expect(isValidTimeZone('')).toBe(false)
    expect(isValidTimeZone(null)).toBe(false)
  })
})
