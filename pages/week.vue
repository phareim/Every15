<template>
  <div>
    <MonoLabel dash>Week review</MonoLabel>
    <h1 class="mt-1 text-2xl leading-tight">{{ weekTitle }}</h1>
    <p class="tnum mt-1 text-sm text-mute">
      {{ weekTotal }} {{ weekTotal === 1 ? 'entry' : 'entries' }} &middot; {{ fmtDuration(weekTotal) }}
    </p>

    <nav class="mt-3 flex items-center gap-x-3" aria-label="Week navigation">
      <ActionLabel @click="offset--" aria-label="Previous week">&lsaquo; Prev</ActionLabel>
      <ActionLabel v-if="offset !== 0" @click="offset = 0">This week</ActionLabel>
      <ActionLabel @click="offset++" :disabled="offset >= 0" aria-label="Next week">Next &rsaquo;</ActionLabel>
    </nav>

    <p v-if="rangeError" role="alert" class="field-error mt-3">
      The week would not load ({{ rangeError }}).
      <button type="button" class="underline" @click="reload">Try again</button>
    </p>

    <section aria-label="Days" class="mt-5">
      <ul role="list" class="border-t border-rule">
        <li v-for="d in dayRows" :key="d.day" class="entry-row">
          <NuxtLink :to="`/?date=${d.day}`" class="flex items-baseline gap-3 no-underline">
            <span class="w-24 shrink-0 text-sm">{{ d.label }}</span>
            <span class="bar-track flex-1" aria-hidden="true">
              <span
                class="bar-fill"
                :style="{ width: `${dayMax === 0 ? 0 : (d.count / dayMax) * 100}%` }"
              />
            </span>
            <span class="tnum w-28 shrink-0 text-right text-sm text-mute">{{ d.caption }}</span>
          </NuxtLink>
        </li>
      </ul>
    </section>

    <section aria-label="Time by tag" class="mt-6">
      <WeekBars label="Time by tag" :caption="weekTitle" :rows="tagRows" />
    </section>
  </div>
</template>

<script setup lang="ts">
import {
  addDays,
  dayInZone,
  fmtDuration,
  groupByFirstTag,
  shortDayLabel,
  weekDays,
} from '~/composables/quarters'

const { fetchSettings, effective } = useSettings()
const { fetchRange, rangeError, sorted } = useEntries()
const { showError } = useToast()

const offset = ref(0)
const today = ref(dayInZone(effective.value.timezone))

const monday = computed(() => addDays(weekDays(today.value)[0], offset.value * 7))
const days = computed(() => weekDays(monday.value))
const weekTitle = computed(() => `${shortDayLabel(days.value[0])} – ${shortDayLabel(days.value[6])}`)

const entriesInWeek = computed(() =>
  sorted.value.filter((e) => e.date >= days.value[0] && e.date <= days.value[6]),
)
const weekTotal = computed(() => entriesInWeek.value.length)
const tagRows = computed(() => groupByFirstTag(entriesInWeek.value))

const dayRows = computed(() =>
  days.value.map((day) => {
    const count = entriesInWeek.value.filter((e) => e.date === day).length
    return {
      day,
      label: shortDayLabel(day),
      count,
      caption: count === 0 ? '—' : `${count} · ${fmtDuration(count)}`,
    }
  }),
)
const dayMax = computed(() => dayRows.value.reduce((n, d) => Math.max(n, d.count), 0))

async function reload(): Promise<void> {
  try {
    await fetchRange(days.value[0], days.value[6])
  } catch {
    showError('The week still would not load.')
  }
}

watch(days, reload)

onMounted(async () => {
  try {
    await fetchSettings()
    today.value = dayInZone(effective.value.timezone)
  } catch {
    /* contract default stands */
  }
  await reload()
})
</script>
