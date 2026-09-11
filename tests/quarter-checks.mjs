import { readFileSync } from 'node:fs'
const source = readFileSync(new URL('../composables/quarters.ts', import.meta.url), 'utf8')
const q = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))

let pass = 0
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log(`ok - ${name}`) }
  else { console.log(`FAIL - ${name} ${extra}`); process.exitCode = 1 }
}

const S = (o) => ({ timezone: 'Europe/Oslo', startTime: '09:00', endTime: '17:00', workDays: [1, 2, 3, 4, 5], reminderMinutes: 15, remindersEnabled: true, ...o })

// UTC labels stable regardless of browser zone (run under exotic TZ)
ok('long label', q.longDayLabel('2026-09-10') === 'Thursday 10 September 2026', q.longDayLabel('2026-09-10'))
ok('short label', q.shortDayLabel('2026-09-10') === 'Thu 10 Sep', q.shortDayLabel('2026-09-10'))
ok('short label year edge', q.shortDayLabel('2026-01-01') === 'Thu 1 Jan', q.shortDayLabel('2026-01-01'))

// settings: 24:00 rejected, quarter HH:mm required
ok('24:00 end rejected', q.validateSettings(S({ endTime: '24:00' })).some(e => e.includes('quarter-hour')))
ok('17:00 end accepted', q.validateSettings(S({ endTime: '17:00' })).length === 0)
ok('start>=end rejected', q.validateSettings(S({ startTime: '17:00', endTime: '09:00' })).length > 0)

// previous slot incl midnight rollover
ok('prev same day', JSON.stringify(q.previousQuarterSlot('2026-09-10', '09:15')) === JSON.stringify({ date: '2026-09-10', time: '09:00' }))
ok('prev midnight rolls back', JSON.stringify(q.previousQuarterSlot('2026-09-10', '00:00')) === JSON.stringify({ date: '2026-09-09', time: '23:45' }))

// backfill
const logged = ['09:00', '09:15']
ok('past day lists all unlogged', q.backfillQuarters(S(), '2026-09-09', '2026-09-10', '10:00', logged).length === 32 - 2)
ok('today only through current', JSON.stringify(q.backfillQuarters(S(), '2026-09-10', '2026-09-10', '10:07', logged)) === JSON.stringify(['09:30', '09:45', '10:00']))
ok('future day none', q.backfillQuarters(S(), '2026-09-11', '2026-09-10', '10:00', []).length === 0)
ok('non-workday none', q.backfillQuarters(S(), '2026-09-12', '2026-09-12', '10:00', []).length === 0) // Saturday
ok('workdayOf thu', q.workdayOf('2026-09-10') === 4)
ok('workdayOf sun', q.workdayOf('2026-09-13') === 0)

// cadence nudges
ok('15min fires on quarter', q.notificationTarget(S({ reminderMinutes: 15 }), '2026-09-10', '2026-09-10', '10:07', []) === '10:00')
ok('30min skips :15', q.notificationTarget(S({ reminderMinutes: 30 }), '2026-09-10', '2026-09-10', '10:20', []) === null)
ok('30min fires on :30', q.notificationTarget(S({ reminderMinutes: 30 }), '2026-09-10', '2026-09-10', '10:35', []) === '10:30')
ok('60min fires on :00', q.notificationTarget(S({ reminderMinutes: 60 }), '2026-09-10', '2026-09-10', '10:05', []) === '10:00')
ok('logged quarter never nudges', q.notificationTarget(S(), '2026-09-10', '2026-09-10', '10:05', ['10:00']) === null)
ok('disabled never nudges', q.notificationTarget(S({ remindersEnabled: false }), '2026-09-10', '2026-09-10', '10:05', []) === null)
ok('other day never nudges', q.notificationTarget(S(), '2026-09-09', '2026-09-10', '10:05', []) === null)
ok('outside window never nudges', q.notificationTarget(S(), '2026-09-10', '2026-09-10', '19:05', []) === null)
ok('non-workday never nudges', q.notificationTarget(S(), '2026-09-12', '2026-09-12', '10:05', []) === null)

// misc pure
ok('draftKey', q.draftKey('u1', '2026-09-10', '09:00') === 'fifteen:draft:u1:2026-09-10:09:00')
ok('notifiedKey', q.notifiedKey('u1', '2026-09-10', '09:00') === 'fifteen:notified:u1:2026-09-10:09:00')
ok('first-tag grouping', JSON.stringify(q.groupByFirstTag([{ tags: ['a', 'b'] }, { tags: ['a'] }, {}])) === JSON.stringify([{ label: 'a', count: 2 }, { label: 'Untagged', count: 1 }]))
ok('csv injection guard', q.escapeCsvCell('=1+1') === "'=1+1")
ok('quarterRange end exclusive', q.quarterRange('09:00', '10:00').join(',') === '09:00,09:15,09:30,09:45')
ok('floorQuarter', q.floorQuarter('10:07') === '10:00')
ok('addDays month edge', q.addDays('2026-09-30', 1) === '2026-10-01')
ok('blank text invalid', q.validateEntryInput({ date: '2026-09-10', time: '09:00', text: '   ', tags: [] }).length > 0)

console.log(`\n${pass} checks passed${process.exitCode ? ' (WITH FAILURES)' : ''}`)
