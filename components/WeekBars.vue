<template>
  <div>
    <div class="row-between">
      <MonoLabel dash>{{ label }}</MonoLabel>
      <MonoLabel>{{ caption }}</MonoLabel>
    </div>
    <HairlineRule class="rule-gap" />
    <p v-if="rows.length === 0" class="muted-italic bar-empty">No entries in this range.</p>
    <!-- Zero-based bars, values printed on the row: the bar is the measure,
         the label names it, no legend round-trip. First tag only, so no
         entry is counted twice; the rest is explicit 'Untagged'. -->
    <ul v-else class="bar-gap" role="list" aria-label="Time by tag">
      <li v-for="row in rows" :key="row.label" class="bar-row">
        <span class="bar-label">{{ row.label }}</span>
        <span class="bar-track" aria-hidden="true">
          <span
            class="bar-fill"
            :style="{ width: `${max === 0 ? 0 : (row.count / max) * 100}%` }"
          />
        </span>
        <span class="tnum bar-value">{{ fmtDuration(row.count) }}</span>
      </li>
    </ul>
    <p class="form-hint bar-note">Each entry counts once, under its first tag. Fifteen minutes each.</p>
  </div>
</template>

<script setup lang="ts">
import { fmtDuration } from '~/composables/quarters'

const props = defineProps<{
  label: string
  caption: string
  rows: Array<{ label: string; count: number }>
}>()

const max = computed(() => props.rows.reduce((n, r) => Math.max(n, r.count), 0))
</script>
