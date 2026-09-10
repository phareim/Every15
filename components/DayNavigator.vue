<template>
  <nav class="day-nav" aria-label="Day navigation">
    <ActionLabel @click="emit('change', addDays(day, -1))" aria-label="Previous day">‹ Prev</ActionLabel>
    <input
      type="date"
      class="tufte-input tnum day-pick"
      :value="day"
      :max="today"
      aria-label="Pick a day"
      @change="onPick"
    />
    <ActionLabel @click="emit('change', addDays(day, 1))" :disabled="day >= today" aria-label="Next day">Next ›</ActionLabel>
    <span class="spacer" />
    <ActionLabel v-if="day !== today" @click="emit('change', today)">Today</ActionLabel>
  </nav>
  <h1 class="day-title">{{ longDayLabel(day) }}</h1>
  <p class="tnum day-count">
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
