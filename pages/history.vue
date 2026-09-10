<template>
  <div>
    <MonoLabel dash>History</MonoLabel>
    <h1 class="page-title">Past days</h1>

    <form class="history-pick" @submit.prevent="jump">
      <div class="field-inline">
        <label class="field-label tnum" for="history-pick">Open a day</label>
        <input id="history-pick" v-model="pick" type="date" class="tufte-input tnum" :max="today" />
      </div>
      <ActionLabel @click="jump">Open</ActionLabel>
    </form>

    <p v-if="rangeError" role="alert" class="field-error notice">
      Couldn't load those days ({{ rangeError }}).
      <button type="button" class="link" @click="reload">Try again</button>
    </p>
    <p v-else-if="loading && rows.length === 0" class="muted-italic journal-gap">Loading the fortnight…</p>
    <ul v-else class="history-list" role="list">
      <li v-for="row in rows" :key="row.day" class="entry-row">
        <NuxtLink :to="`/?date=${row.day}`" class="history-link">
          <span class="tnum history-date">{{ row.day.slice(5) }}</span>
          <span class="history-main">
            <span class="history-day">{{ shortDayLabel(row.day) }}</span>
            <span v-if="row.first" class="history-first">“{{ row.first }}”</span>
          </span>
          <span class="tnum history-count">{{ row.count }} &middot; {{ fmtDuration(row.count) }}</span>
        </NuxtLink>
      </li>
    </ul>
    <p v-if="!loading && rows.length === 0" class="muted-italic journal-gap">
      No entries in the last fourteen days. A calm, empty fortnight.
    </p>
  </div>
</template>

<script setup lang="ts">
import { addDays, dayInZone, fmtDuration, shortDayLabel } from '~/composables/quarters'

const { fetchSettings, effective } = useSettings()
const { fetchRange, loading, rangeError, sorted } = useEntries()
const { showError } = useToast()
const router = useRouter()

const today = ref(dayInZone('Europe/Oslo'))
const pick = ref('')

const rows = computed(() => {
  const byDay = new Map<string, { count: number; first: string }>()
  for (const e of sorted.value) {
    const row = byDay.get(e.date) ?? { count: 0, first: '' }
    row.count += 1
    if (!row.first) row.first = e.text
    byDay.set(e.date, row)
  }
  return [...byDay.entries()]
    .map(([day, v]) => ({ day, ...v }))
    .sort((a, b) => (a.day < b.day ? 1 : -1))
})

function jump(): void {
  if (pick.value) router.push({ path: '/', query: { date: pick.value } })
}

async function reload(): Promise<void> {
  const to = today.value
  try {
    await fetchRange(addDays(to, -13), to)
  } catch {
    showError('Still not loading.')
  }
}

onMounted(async () => {
  try {
    await fetchSettings()
    today.value = dayInZone(effective.value.timezone)
  } catch {
    /* the daytime fallback stands */
  }
  pick.value = today.value
  await reload()
})
</script>
