<template>
  <div>
    <MonoLabel dash>History</MonoLabel>
    <h1 class="mt-1 text-2xl leading-tight">Past days</h1>

    <form class="mt-3 flex flex-wrap items-end gap-3" @submit.prevent="jump">
      <div>
        <label class="tnum block text-xs text-mute" for="history-pick">Open a day</label>
        <input id="history-pick" v-model="pick" type="date" class="tufte-input tnum" :max="today" />
      </div>
      <ActionLabel @click="jump">Open</ActionLabel>
    </form>

    <p v-if="rangeError" role="alert" class="field-error mt-3">
      History would not load ({{ rangeError }}).
      <button type="button" class="underline" @click="reload">Try again</button>
    </p>
    <p v-else-if="loading && rows.length === 0" class="mt-6 italic text-mute">Loading the fortnight…</p>
    <ul v-else class="mt-4 border-t border-rule" role="list">
      <li v-for="row in rows" :key="row.day" class="entry-row">
        <NuxtLink :to="`/?date=${row.day}`" class="flex items-baseline gap-3 no-underline">
          <span class="tnum shrink-0 text-sm">{{ row.day.slice(5) }}</span>
          <span class="flex-1">
            <span class="block leading-snug">{{ shortDayLabel(row.day) }}</span>
            <span v-if="row.first" class="block truncate text-sm italic text-mute">“{{ row.first }}”</span>
          </span>
          <span class="tnum shrink-0 text-sm text-mute">{{ row.count }} &middot; {{ fmtDuration(row.count) }}</span>
        </NuxtLink>
      </li>
    </ul>
    <p v-if="!loading && rows.length === 0" class="mt-6 italic text-mute">
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
    showError('History still would not load.')
  }
}

onMounted(async () => {
  try {
    await fetchSettings()
    today.value = dayInZone(effective.value.timezone)
  } catch {
    /* contract default stands */
  }
  pick.value = today.value
  await reload()
})
</script>
