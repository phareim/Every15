<template>
  <section aria-label="Journal" class="journal">
    <div class="row-between">
      <MonoLabel dash>Journal</MonoLabel>
      <MonoLabel>{{ entries.length }} {{ entries.length === 1 ? 'quarter' : 'quarters' }}</MonoLabel>
    </div>
    <HairlineRule class="rule-gap" />

    <p v-if="loading && entries.length === 0" class="muted-italic journal-gap">Loading the day…</p>
    <div v-else-if="entries.length === 0" class="journal-gap">
      <p class="journal-empty">Nothing logged yet.</p>
      <p class="muted-italic journal-hint">The composer above is waiting. One line per quarter-hour is the whole practice.</p>
    </div>
    <ul v-else role="list">
      <li
        v-for="entry in entries"
        :key="entry.id"
        class="entry-row"
        :class="pendingMap[`${entry.date} ${entry.time}`] ? 'entry-row--pending' : ''"
      >
        <div class="entry-top">
          <span class="tnum entry-time" aria-label="Quarter starting">{{ entry.time }}</span>
          <p class="entry-text">{{ entry.text }}</p>
          <span class="entry-tools">
            <button
              type="button"
              class="tnum tool-link"
              :disabled="!!pendingMap[`${entry.date} ${entry.time}`]"
              @click="emit('edit', entry)"
            >Edit</button>
            <button
              v-if="confirmingId !== entry.id"
              type="button"
              class="tnum tool-link"
              :disabled="!!pendingMap[`${entry.date} ${entry.time}`]"
              @click="confirmingId = entry.id"
            >Delete</button>
            <span v-else class="confirm-group" role="group" aria-label="Confirm delete">
              <span class="confirm-q">Delete?</span>
              <button
                type="button"
                class="tnum tool-link tool-danger"
                @click="emit('remove', entry); confirmingId = null"
              >Yes</button>
              <button
                type="button"
                class="tnum tool-link"
                @click="confirmingId = null"
              >Keep</button>
            </span>
          </span>
        </div>
        <p v-if="entry.tags.length > 0" class="tnum entry-tags">
          {{ entry.tags.join(' · ') }}
        </p>
      </li>
    </ul>

    <div v-if="missing.length > 0" class="chip-block">
      <MonoLabel>Unlogged in the work window</MonoLabel>
      <p class="chip-row" role="group" aria-label="Unlogged quarters">
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
