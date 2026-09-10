<template>
  <section aria-label="Journal" class="mt-6">
    <div class="flex items-baseline justify-between">
      <MonoLabel dash>Journal</MonoLabel>
      <MonoLabel>{{ entries.length }} {{ entries.length === 1 ? 'quarter' : 'quarters' }}</MonoLabel>
    </div>
    <HairlineRule class="mt-2" />

    <p v-if="loading && entries.length === 0" class="mt-6 italic text-mute">Loading the day…</p>
    <div v-else-if="entries.length === 0" class="mt-6">
      <p class="text-lg">Nothing logged yet.</p>
      <p class="mt-1 italic text-mute">The composer above is waiting. One line per quarter-hour is the whole practice.</p>
    </div>
    <ul v-else role="list">
      <li
        v-for="entry in entries"
        :key="entry.id"
        class="entry-row"
        :class="pendingMap[`${entry.date} ${entry.time}`] ? 'entry-row--pending' : ''"
      >
        <div class="flex items-baseline gap-3">
          <span class="tnum shrink-0 text-sm" aria-label="Quarter starting">{{ entry.time }}</span>
          <p class="flex-1 leading-snug">{{ entry.text }}</p>
          <span class="flex shrink-0 items-center gap-3">
            <button
              type="button"
              class="tnum text-xs text-mute underline hover:text-ink"
              :disabled="!!pendingMap[`${entry.date} ${entry.time}`]"
              @click="emit('edit', entry)"
            >Edit</button>
            <button
              v-if="confirmingId !== entry.id"
              type="button"
              class="tnum text-xs text-mute underline hover:text-ink"
              :disabled="!!pendingMap[`${entry.date} ${entry.time}`]"
              @click="confirmingId = entry.id"
            >Delete</button>
            <span v-else class="flex items-center gap-2" role="group" aria-label="Confirm delete">
              <span class="text-xs italic text-mute">Delete?</span>
              <button
                type="button"
                class="tnum text-xs text-accent-ink underline"
                @click="emit('remove', entry); confirmingId = null"
              >Yes</button>
              <button
                type="button"
                class="tnum text-xs text-mute underline"
                @click="confirmingId = null"
              >Keep</button>
            </span>
          </span>
        </div>
        <p v-if="entry.tags.length > 0" class="tnum mt-1 pl-14 text-xs text-faint">
          {{ entry.tags.join(' · ') }}
        </p>
      </li>
    </ul>

    <div v-if="missing.length > 0" class="mt-5">
      <MonoLabel>Unlogged in the work window</MonoLabel>
      <p class="mt-2 flex flex-wrap gap-2" role="group" aria-label="Unlogged quarters">
        <button
          v-for="q in missing"
          :key="q"
          type="button"
          class="quarter-chip"
          :aria-label="`Log quarter ${q}`"
          @click="emit('jump', q)"
        >{{ q }}</button>
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { Entry } from '~/composables/useEntries'

defineProps<{
  entries: Entry[]
  loading: boolean
  /** Quarters missing from the work window — backfill entry points. */
  missing: string[]
  pendingMap: Record<string, boolean>
}>()

const emit = defineEmits<{
  edit: [entry: Entry]
  remove: [entry: Entry]
  jump: [quarter: string]
}>()

const confirmingId = ref<string | null>(null)
</script>
