<template>
  <section aria-label="Entry composer" class="composer">
    <MonoLabel dash accent>Now logging</MonoLabel>
    <form class="composer-form" @submit.prevent="onSave" @keydown.ctrl.enter="onSave" @keydown.meta.enter="onSave">
      <div class="composer-top">
        <div class="field-inline">
          <label class="field-label tnum" for="composer-quarter">Quarter</label>
          <select
            id="composer-quarter"
            v-model="quarter"
            class="tufte-input tnum"
            :disabled="saving"
          >
            <option v-for="q in quarters" :key="q" :value="q">
              {{ q }}{{ loggedQuarters.has(q) ? ' · logged' : '' }}
            </option>
          </select>
        </div>
        <div class="composer-steps" role="group" aria-label="Move between quarters">
          <ActionLabel :disabled="saving || stepIndex <= 0" aria-label="Previous quarter" @click="stepQuarter(-1)">‹ Prev</ActionLabel>
          <ActionLabel
            v-if="isToday && currentQuarter && quarters.includes(currentQuarter)"
            :disabled="saving || quarter === currentQuarter"
            aria-label="Jump to the current quarter"
            @click="jumpNow"
          >Now</ActionLabel>
          <ActionLabel :disabled="saving || stepIndex >= quarters.length - 1" aria-label="Next quarter" @click="stepQuarter(1)">Next ›</ActionLabel>
        </div>
        <span class="spacer" />
        <ActionLabel
          v-if="continueTarget"
          :aria-label="continueExact ? 'Continue previous entry' : 'Reuse last entry'"
          @click="continuePrevious"
        >{{ continueExact ? 'Continue previous' : 'Reuse last entry' }}</ActionLabel>
      </div>
      <p v-if="editingExisting" class="form-hint composer-note">Saving overwrites the {{ quarter }} entry.</p>

      <label class="field-label mt-field" for="composer-text">What did the quarter hold</label>
      <textarea
        id="composer-text"
        ref="textArea"
        v-model="text"
        class="tufte-input"
        rows="3"
        maxlength="2000"
        placeholder="One honest line about the fifteen minutes."
        :disabled="saving"
        aria-describedby="composer-count composer-error"
      />

      <label class="field-label mt-field" for="composer-tags">Tags, comma separated, optional</label>
      <input
        id="composer-tags"
        v-model="tagsRaw"
        type="text"
        class="tufte-input"
        placeholder="writing, calls"
        :disabled="saving"
        aria-describedby="composer-error"
      />

      <div class="composer-actions">
        <ActionLabel accent :disabled="saving || !canSave" @click="onSave">
          {{ saving ? 'Saving' : editingExisting ? 'Overwrite' : 'Save quarter' }}
        </ActionLabel>
        <span id="composer-count" class="tnum count-note">{{ text.trim().length }} / 2000</span>
        <span v-if="saveError" id="composer-error" role="alert" class="field-error">{{ saveError }}</span>
      </div>
      <p class="form-hint composer-note">Ctrl+Enter (or Cmd+Enter) saves.</p>
      <ul v-if="validation.length > 0" class="error-list" aria-label="What to fix">
        <li v-for="e in validation" :key="e" class="field-error">{{ e }}</li>
      </ul>
    </form>
  </section>
</template>

<script setup lang="ts">
import { isQuarterTime, parseTags, previousQuarterSlot, validateEntryInput } from '~/composables/quarters'
import type { Entry } from '~/composables/useEntries'

const props = defineProps<{
  date: string
  quarter: string
  quarters: string[]
  entries: Entry[]
  /** Current quarter in the settings zone; null when viewing another day. */
  currentQuarter?: string | null
  /** True when the viewed day is today in the settings zone. */
  isToday?: boolean
}>()

const emit = defineEmits<{
  save: [input: { date: string; time: string; text: string; tags: string[] }]
  quarterChange: [quarter: string]
}>()

const { loadDraft, saveDraft, clearDraft, hasDraft } = useDrafts()
const { pending, saveErrors } = useEntries()

const quarter = ref(props.quarter)
const text = ref('')
const tagsRaw = ref('')
const validation = ref<string[]>([])
const textArea = ref<HTMLTextAreaElement | null>(null)
// While restoring we must not persist: the watcher below only writes
// user-originated edits, so switching slots never bleeds text across keys.
let restoring = false
const dirty = ref(false)

const loggedQuarters = computed(() => new Set(props.entries.map((e) => e.time)))
const editingExisting = computed(() => loggedQuarters.value.has(quarter.value))
const saving = computed(() => !!pending.value[`${props.date} ${quarter.value}`])
const saveError = computed(() => saveErrors.value[`${props.date} ${quarter.value}`] ?? null)
const stepIndex = computed(() => props.quarters.indexOf(quarter.value))

function savedEntryFor(q: string): Entry | undefined {
  return props.entries.find((e) => e.time === q)
}

/**
 * The slot to continue from: exactly the preceding quarter (rolling over
 * midnight), falling back to the latest earlier entry on this day.
 */
const continueExact = computed<Entry | null>(() => {
  const prev = previousQuarterSlot(props.date, quarter.value)
  if (prev.date !== props.date) return null // previous day is out of view
  return savedEntryFor(prev.time) ?? null
})
const continueFallback = computed<Entry | null>(() => {
  if (continueExact.value) return null
  const earlier = props.entries.filter((e) => e.time < quarter.value)
  return earlier.length > 0 ? earlier[earlier.length - 1] : null
})
const continueTarget = computed(() => continueExact.value ?? continueFallback.value)
const parsedTags = computed(() => parseTags(tagsRaw.value))
const canSave = computed(() => text.value.trim().length > 0 && isQuarterTime(quarter.value))

function restore(): void {
  restoring = true
  try {
    // A stored draft always wins — even a deliberately emptied one. Only a
    // slot never touched falls back to the saved entry.
    const draft = loadDraft(props.date, quarter.value)
    if (draft !== null) {
      text.value = draft.text
      tagsRaw.value = draft.tags
    } else {
      const existing = savedEntryFor(quarter.value)
      text.value = existing ? existing.text : ''
      tagsRaw.value = existing ? existing.tags.join(', ') : ''
    }
    dirty.value = false
  } finally {
    restoring = false
  }
}

function persistDraft(): void {
  if (restoring) return
  dirty.value = true
  saveDraft(props.date, quarter.value, text.value, tagsRaw.value)
}

/** Prefill from the exact previous quarter, or the last earlier entry. */
function continuePrevious(): void {
  const prev = continueTarget.value
  if (!prev) return
  text.value = prev.text
  tagsRaw.value = prev.tags.join(', ')
  persistDraft()
  nextTick(() => textArea.value?.focus())
}

function stepQuarter(dir: -1 | 1): void {
  const i = props.quarters.indexOf(quarter.value)
  const next = props.quarters[i + dir]
  if (next) {
    quarter.value = next
    restore()
    nextTick(() => textArea.value?.focus())
  }
}

function jumpNow(): void {
  if (props.currentQuarter && props.quarters.includes(props.currentQuarter)) {
    quarter.value = props.currentQuarter
    restore()
    nextTick(() => textArea.value?.focus())
  }
}

watch(() => props.quarter, (q) => {
  if (q && q !== quarter.value) {
    quarter.value = q
    restore()
  }
})
watch(() => props.date, restore)
// Entries arriving late (range fetch) fill a pristine form only: a form with
// user text — or a stored draft, even an emptied one — is never overwritten.
watch(
  () => props.entries,
  () => {
    if (hasDraft(props.date, quarter.value)) return
    if (text.value || tagsRaw.value || dirty.value) return
    restore()
  },
  { deep: true },
)
watch([text, tagsRaw], persistDraft)
watch(quarter, (q) => emit('quarterChange', q))

function onSave(): void {
  const input = {
    date: props.date,
    time: quarter.value,
    text: text.value.trim(),
    tags: parsedTags.value,
  }
  const problems = validateEntryInput(input)
  validation.value = problems
  if (problems.length > 0) return
  emit('save', input)
}

/** The page calls this after the server confirms the save. */
function noteSaved(): void {
  noteSavedFor(props.date, quarter.value)
}

/**
 * Clear the draft for the saved slot — which may no longer be the selected
 * one if the user moved on while the request flew.
 */
function noteSavedFor(date: string, time: string): void {
  clearDraft(date, time)
  if (date === props.date && time === quarter.value) {
    dirty.value = false
    validation.value = []
  }
}

/** Pristine while the user has not typed and no draft waits for this slot. */
function isPristine(): boolean {
  if (dirty.value) return false
  if (text.value || tagsRaw.value) return false
  return !hasDraft(props.date, quarter.value)
}

defineExpose({ noteSaved, noteSavedFor, restore, isPristine, focus: () => textArea.value?.focus() })

onMounted(restore)
</script>
