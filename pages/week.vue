<template>
  <div>
    <MonoLabel dash>Week review</MonoLabel>
    <h1 class="page-title">{{ weekTitle }}</h1>
    <p class="tnum week-count">
      {{ weekTotal }} {{ weekTotal === 1 ? 'entry' : 'entries' }} &middot; {{ fmtDuration(weekTotal) }}
    </p>

    <nav class="week-nav" aria-label="Week navigation">
      <ActionLabel @click="offset--" aria-label="Previous week">‹ Prev</ActionLabel>
      <ActionLabel v-if="offset !== 0" @click="offset = 0">This week</ActionLabel>
      <ActionLabel :disabled="offset >= 0" aria-label="Next week" @click="offset++">Next ›</ActionLabel>
    </nav>

    <p v-if="rangeError" role="alert" class="field-error notice">
      Couldn't load this week ({{ rangeError }}).
      <button type="button" class="link" @click="reload">Try again</button>
    </p>

    <section aria-label="Days" class="week-days">
      <ul role="list" class="history-list">
        <li v-for="d in dayRows" :key="d.day" class="entry-row">
          <NuxtLink :to="`/?date=${d.day}`" class="history-link">
            <span class="week-day">{{ d.label }}</span>
            <span class="bar-track week-bar" aria-hidden="true">
              <span
                class="bar-fill"
                :style="{ width: `${dayMax === 0 ? 0 : (d.count / dayMax) * 100}%` }"
              />
            </span>
            <span class="tnum week-caption">{{ d.caption }}</span>
          </NuxtLink>
        </li>
      </ul>
    </section>

    <section aria-label="Time by tag" class="week-tags">
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
    showError('Still not loading.')
  }
}

watch(days, reload)

onMounted(async () => {
  try {
    await fetchSettings()
    today.value = dayInZone(effective.value.timezone)
  } catch {
    /* the daytime fallback stands */
  }
  await reload()
})
</script>
