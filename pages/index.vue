<template>
  <div>
    <p v-if="signedOut" class="auth-prompt">
      <a class="link" :href="loginHref">Sign in with Reader</a> to log quarter-hours.
    </p>
    <template v-else>
      <DayNavigator :day="day" :today="today" :count="dayEntries.length" @change="goDay" />

      <p v-if="settingsError" role="alert" class="field-error notice">
        Preferences couldn't load ({{ settingsError }}). Using the usual 09:00–17:00 weekday setup meanwhile.
      </p>
      <p v-if="rangeError" role="alert" class="field-error notice">
        Entries couldn't load ({{ rangeError }}).
        <button type="button" class="link" @click="reload">Try again</button>
      </p>

      <ReminderStrip :due="reminder.due" :missing="reminder.missing" @jump="jumpTo" />

      <EntryComposer
        ref="composer"
        :date="day"
        :quarter="quarter"
        :quarters="allQuarters"
        :entries="dayEntries"
        :current-quarter="isLiveDay ? currentQuarter : null"
        :is-today="isLiveDay"
        @save="onSave"
        @quarter-change="quarter = $event"
      />

      <EntryList
        :entries="dayEntries"
        :loading="loading"
        :missing="backfill"
        :pending-map="pending"
        @edit="onEdit"
        @remove="onRemove"
        @jump="jumpTo"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import {
  backfillQuarters,
  dayInZone,
  floorQuarter,
  isDayString,
  quarterRange,
  timeInZone,
} from '~/composables/quarters'
import { computeReminders, useNow } from '~/composables/useReminders'
import type { Entry } from '~/composables/useEntries'

const route = useRoute()
const router = useRouter()
// Foundation-owned session; the auth middleware keeps it fresh, so the page
// only reads the reactive state — no fetching here.
const auth = useAuth() as unknown as {
  user: { value: { id: string; email: string } | null }
  checked: { value: boolean }
  loginUrl: () => string
}
const { effective, fetchSettings, loadError } = useSettings()
const { entriesForDay, fetchRange, saveEntry, deleteEntry, loading, rangeError, pending } = useEntries()
const { setUserId, hasDraft, clearDraft } = useDrafts()
const { show, showError } = useToast()

const loginHref = computed(() => {
  try {
    return auth.loginUrl()
  } catch {
    return 'https://reader.phareim.no/login'
  }
})
const signedOut = computed(() => auth.checked.value && !auth.user.value)
const settingsError = computed(() => loadError.value)

const allQuarters = quarterRange('00:00', '24:00')

// The clock ticks in the settings zone; before preferences load the
// daytime fallback (Europe/Oslo) answers "today".
const { today, nowTime, start, stop } = useNow(() => effective.value.timezone)

const day = ref<string>(
  typeof route.query.date === 'string' && isDayString(route.query.date)
    ? route.query.date
    : dayInZone(effective.value.timezone),
)
const quarter = ref('09:00')
const composer = ref<{
  noteSaved: () => void
  noteSavedFor: (date: string, time: string) => void
  restore: () => void
  isPristine: () => boolean
  focus: () => void
} | null>(null)

watch(
  () => auth.user.value,
  (u) => setUserId(u?.id ?? 'anon'),
  { immediate: true },
)

const dayEntries = computed<Entry[]>(() => entriesForDay(day.value))
const loggedTimes = computed(() => dayEntries.value.map((e) => e.time))
const isLiveDay = computed(() => day.value === today.value)
const currentQuarter = computed(() => floorQuarter(nowTime.value))
const windowQuarters = computed(() =>
  quarterRange(effective.value.startTime, effective.value.endTime),
)
/** Unlogged work-window quarters: past days list all, today only through now. */
const backfill = computed(() =>
  backfillQuarters(effective.value, day.value, today.value, nowTime.value, loggedTimes.value),
)

const reminder = computed(() =>
  computeReminders(effective.value, day.value, today.value, nowTime.value, dayEntries.value),
)

function defaultQuarter(): string {
  if (isLiveDay.value) return floorQuarter(timeInZone(effective.value.timezone))
  return backfill.value[0] ?? effective.value.startTime
}

function composerPristine(): boolean {
  try {
    if (composer.value) return composer.value.isPristine()
  } catch {
    /* fall through to the draft check */
  }
  return !hasDraft(day.value, quarter.value)
}

function goDay(next: string): void {
  router.replace({ query: { ...route.query, date: next } })
}

async function reload(): Promise<void> {
  try {
    await fetchRange(day.value, day.value)
  } catch {
    showError('Entries still not loading.')
  }
}

watch(
  () => route.query.date,
  (q) => {
    let next = typeof q === 'string' && isDayString(q) ? q : today.value
    if (next > today.value) next = today.value // the journal never runs ahead
    if (next !== day.value) {
      day.value = next
      quarter.value = defaultQuarter()
      reload()
    }
  },
)

// Midnight and the current quarter advance while the page stays open: follow
// the live day when the composer is pristine, never while typing.
watch(today, (t, previousToday) => {
  if (day.value === previousToday) {
    if (!composerPristine()) return
    day.value = t
    quarter.value = defaultQuarter()
    reload()
  }
})
watch(currentQuarter, (cq, previousQuarter) => {
  if (!isLiveDay.value || !composerPristine()) return
  if (quarter.value === previousQuarter && cq !== quarter.value) {
    quarter.value = cq
  }
})

function jumpTo(q: string): void {
  quarter.value = q
  nextTick(() => composer.value?.focus())
  document.querySelector('[aria-label="Entry composer"]')?.scrollIntoView({ block: 'nearest' })
}

function onEdit(entry: Entry): void {
  quarter.value = entry.time
  nextTick(() => {
    composer.value?.restore()
    composer.value?.focus()
  })
}

async function onSave(input: { date: string; time: string; text: string; tags: string[] }): Promise<void> {
  // Capture the slot now: the user may move on while the request flies, and
  // the draft cleared must be that slot's — not whichever is selected after.
  const slot = { date: input.date, time: input.time }
  try {
    await saveEntry(input)
    clearDraft(slot.date, slot.time)
    try {
      composer.value?.noteSavedFor(slot.date, slot.time)
    } catch {
      /* the entry is saved; the draft key below is best-effort */
    }
    show(`Saved ${input.time}.`)
  } catch (err) {
    const why = err instanceof Error ? err.message : 'Could not save this quarter.'
    showError(`Saving failed (${why}) — the draft is kept below.`)
  }
}

async function onRemove(entry: Entry): Promise<void> {
  try {
    await deleteEntry(entry)
    show(`Deleted ${entry.time}.`, 'note', 'Undo')
  } catch (err) {
    showError(err instanceof Error ? err.message : 'Could not delete the entry.')
  }
}

onMounted(async () => {
  try {
    await fetchSettings()
  } catch {
    /* the daytime fallback stands; the banner above says so */
  }
  if (typeof route.query.date !== 'string' || !isDayString(route.query.date)) {
    day.value = today.value
  }
  quarter.value = defaultQuarter()
  await reload()
  start()
})

onUnmounted(stop)
</script>
