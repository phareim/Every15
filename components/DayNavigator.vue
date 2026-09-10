<template>
  <nav class="flex flex-wrap items-center gap-x-3 gap-y-2" aria-label="Day navigation">
    <ActionLabel @click="emit('change', addDays(day, -1))" aria-label="Previous day">&lsaquo; Prev</ActionLabel>
    <input
      type="date"
      class="tufte-input tnum"
      style="max-width: 11em;"
      :value="day"
      :max="today"
      aria-label="Pick a day"
      @change="onPick"
    />
    <ActionLabel @click="emit('change', addDays(day, 1))" :disabled="day >= today" aria-label="Next day">Next &rsaquo;</ActionLabel>
    <span class="flex-1" />
    <ActionLabel v-if="day !== today" @click="emit('change', today)">Today</ActionLabel>
  </nav>
  <h1 class="mt-3 text-2xl leading-tight">{{ longDayLabel(day) }}</h1>
  <p class="tnum mt-1 text-sm text-mute">
    {{ count }} {{ count === 1 ? 'entry' : 'entries' }} &middot; {{ fmtDuration(count) }}
  </p>
</template>

<script setup lang="ts">
import { addDays, fmtDuration, longDayLabel } from '~/composables/quarters'

defineProps<{
  day: string
  today: string
  count: number
}>()

const emit = defineEmits<{ change: [day: string] }>()

function onPick(e: Event) {
  const v = (e.target as HTMLInputElement).value
  if (v) emit('change', v)
}
</script>
