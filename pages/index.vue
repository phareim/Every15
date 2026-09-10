<template>
  <div>
    <p v-if="authBlocked" class="mt-4">
      <a class="underline" :href="loginHref">Sign in with Reader</a> to log quarter-hours.
    </p>
    <template v-else>
      <DayNavigator :day="day" :today="today" :count="dayEntries.length" @change="goDay" />

      <p v-if="settingsError" role="alert" class="field-error mt-3">
        Preferences would not load ({{ settingsError }}). Showing defaults for Europe/Oslo.
      </p>
      <p v-if="rangeError" role="alert" class="field-error mt-3">
        Entries would not load ({{ rangeError }}).
        <button type="button" class="underline" @click="reload">Try again</button>
      </p>

      <ReminderStrip :due="reminder.due" :missing="reminder.missing" @jump="jumpTo" />

      <EntryComposer
        ref="composer"
        :date="day"
        :quarter="quarter"
        :quarters="allQuarters"
        :entries="dayEntries"
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
const { effective, fetchSettings, loadError } = useSettings()
const { entriesForDay, fetchRange, saveEntry, deleteEntry, loading, rangeError, pending } = useEntries()
const { setUserId } = useDrafts()
const { show, showError } = useToast()

const loginHref = ref('https://reader.phareim.no/login')
const authBlocked = ref(false)
const settingsError = computed(() => loadError.value)

const allQuarters = quarterRange('00:00', '24:00')

// The clock ticks in the settings zone; before preferences load the
// contract default (Europe/Oslo) answers "today".
const { today, nowTime, start, stop } = useNow(() => effective.value.timezone)

const day = ref<string>(
  typeof route.query.date === 'string' && isDayString(route.query.date)
    ? route.query.date
    : dayInZone(effective.value.timezone),
)
const quarter = ref('09:00')
const composer = ref<{ noteSaved: () => void; restore: () => void; focus: () => void } | null>(null)

const dayEntries = computed<Entry[]>(() => entriesForDay(day.value))

const loggedSet = computed(() => new Set(dayEntries.value.map((e) => e.time)))
const windowQuarters = computed(() =>
  quarterRange(effective.value.startTime, effective.value.endTime),
)
/** Every unlogged work-window quarter: the backfill entry points. */
const backfill = computed(() => windowQuarters.value.filter((q) => !loggedSet.value.has(q)))

const reminder = computed(() =>
  computeReminders(effective.value, day.value, today.value, nowTime.value, dayEntries.value),
)

function defaultQuarter(): string {
  if (day.value === today.value) {
    const current = floorQuarter(timeInZone(effective.value.timezone))
    if (!loggedSet.value.has(current)) return current
  }
  return backfill.value[0] ?? effective.value.startTime
}

function goDay(next: string): void {
  router.replace({ query: { ...route.query, date: next } })
}

async function reload(): Promise<void> {
  try {
    await fetchRange(day.value, day.value)
  } catch {
    showError('Entries still would not load.')
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
  try {
    await saveEntry(input)
    composer.value?.noteSaved()
    show(`Saved ${input.time}.`)
  } catch {
    // The draft stays in localStorage; the composer's error line names it.
    showError('Saving failed — the draft is kept below.')
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
    const auth = (useAuth as unknown as () => {
      user: { value: { id: string; email: string } | null }
      checked: { value: boolean }
      fetchSession: () => Promise<unknown>
      loginUrl: () => string
    })()
    await auth.fetchSession()
    if (!auth.user.value) {
      authBlocked.value = true
      return
    }
    setUserId(auth.user.value.id)
    try {
      loginHref.value = auth.loginUrl()
    } catch {
      /* keep fallback */
    }
  } catch {
    // Foundation auth not yet merged: keep the page usable against the API;
    // the coordinator wires the real session.
  }
  try {
    await fetchSettings()
  } catch {
    /* effective falls back to contract defaults; banner above says so */
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
