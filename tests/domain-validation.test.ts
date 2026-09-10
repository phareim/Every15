import {
  ApiError,
  MAX_RANGE_DAYS,
  validateDateRange,
  validateEntryInput,
  validateSettings,
  validateTags,
} from '../shared/validation'

function expectBadRequest(fn: () => unknown, pattern?: RegExp) {
  try {
    fn()
  } catch (err) {
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).statusCode).toBe(400)
    if (pattern) expect((err as Error).message).toMatch(pattern)
    return
  }
  throw new Error('Expected a 400 ApiError but nothing was thrown')
}

describe('entry input', () => {
  const valid = { date: '2026-09-10', time: '09:15', text: 'Standup', tags: ['meetings'] }

  it('accepts a complete valid body', () => {
    expect(validateEntryInput(valid)).toEqual(valid)
  })

  it('defaults missing tags to []', () => {
    const { tags, ...rest } = valid
    expect(validateEntryInput(rest)).toEqual({ ...rest, tags: [] })
  })

  it('allows empty text (a quarter can be honestly blank)', () => {
    expect(validateEntryInput({ ...valid, text: '' }).text).toBe('')
  })

  it('rejects bad dates, times, and oversized text', () => {
    expectBadRequest(() => validateEntryInput({ ...valid, date: '2026-02-30' }), /date/)
    expectBadRequest(() => validateEntryInput({ ...valid, time: '09:10' }), /quarter/)
    expectBadRequest(() => validateEntryInput({ ...valid, time: '25:00' }), /time/)
    expectBadRequest(() => validateEntryInput({ ...valid, text: 'x'.repeat(2000) + 'y' }), /2000/)
    expectBadRequest(() => validateEntryInput({ ...valid, text: 42 }), /text/)
    expectBadRequest(() => validateEntryInput('nope'), /object/)
  })

  it('accepts exactly the text limit', () => {
    expect(validateEntryInput({ ...valid, text: 'x'.repeat(2000) }).text).toHaveLength(2000)
  })
})

describe('tags', () => {
  it('trims surrounding whitespace', () => {
    expect(validateTags(['  deep work  '])).toEqual(['deep work'])
  })

  it('accepts the documented maxima', () => {
    const eight = Array.from({ length: 8 }, (_, i) => `tag${i}`)
    expect(validateTags(eight)).toHaveLength(8)
    expect(validateTags(['x'.repeat(40)])).toHaveLength(1)
  })

  it('rejects over-limit and empty tags', () => {
    expectBadRequest(() => validateTags(new Array(9).fill('ok')), /At most 8/)
    expectBadRequest(() => validateTags(['x'.repeat(41)]), /40/)
    expectBadRequest(() => validateTags(['   ']), /non-empty/)
    expectBadRequest(() => validateTags(['ok', 7]), /non-empty/)
    expectBadRequest(() => validateTags('solo'), /array/)
  })
})

describe('settings', () => {
  const valid = {
    timezone: 'Europe/Oslo',
    startTime: '09:00',
    endTime: '17:00',
    workDays: [1, 2, 3, 4, 5],
    reminderMinutes: 15,
    remindersEnabled: false,
  }

  it('accepts a full valid object and sorts workDays', () => {
    expect(validateSettings({ ...valid, workDays: [5, 1, 3] }).workDays).toEqual([1, 3, 5])
  })

  it('fills missing fields from defaults', () => {
    expect(validateSettings({})).toEqual({
      timezone: 'Europe/Oslo',
      startTime: '09:00',
      endTime: '17:00',
      workDays: [1, 2, 3, 4, 5],
      reminderMinutes: 15,
      remindersEnabled: false,
    })
  })

  it('rejects bad timezone, times, workdays, and reminder options', () => {
    expectBadRequest(() => validateSettings({ ...valid, timezone: 'Oslo' }), /IANA/)
    expectBadRequest(() => validateSettings({ ...valid, startTime: '09:10' }), /quarter/)
    expectBadRequest(() => validateSettings({ ...valid, startTime: '17:00', endTime: '09:00' }), /earlier/)
    expectBadRequest(() => validateSettings({ ...valid, startTime: '09:00', endTime: '09:00' }), /earlier/)
    expectBadRequest(() => validateSettings({ ...valid, workDays: [1, 1] }), /duplicates/)
    expectBadRequest(() => validateSettings({ ...valid, workDays: [7] }), /0–6/)
    expectBadRequest(() => validateSettings({ ...valid, workDays: 'mtwtf' }), /array/)
    expectBadRequest(() => validateSettings({ ...valid, reminderMinutes: 45 }), /15, 30 or 60/)
    expectBadRequest(() => validateSettings({ ...valid, remindersEnabled: 'yes' }), /true or false/)
  })
})

describe('date range', () => {
  it('accepts a normal range', () => {
    expect(validateDateRange({ from: '2026-09-01', to: '2026-09-07' })).toEqual({
      from: '2026-09-01',
      to: '2026-09-07',
    })
  })

  it(`accepts exactly ${MAX_RANGE_DAYS} days and rejects one more`, () => {
    // 2024 is a leap year: Jan 1 → Dec 31 is 366 days inclusive.
    expect(validateDateRange({ from: '2024-01-01', to: '2024-12-31' })).toBeTruthy()
    expectBadRequest(
      () => validateDateRange({ from: '2024-01-01', to: '2025-01-01' }),
      /at most 366/
    )
  })

  it('rejects missing, malformed, or inverted ranges', () => {
    expectBadRequest(() => validateDateRange({}), /required/)
    expectBadRequest(() => validateDateRange({ from: '2026-09-10' }), /required/)
    expectBadRequest(() => validateDateRange({ from: 'not-a-date', to: '2026-09-10' }), /required/)
    expectBadRequest(() => validateDateRange({ from: '2026-09-11', to: '2026-09-10' }), /later than to/)
  })
})
