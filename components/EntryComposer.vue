<template>
  <section aria-label="Entry composer" class="mt-5">
    <MonoLabel dash accent>Now logging</MonoLabel>
    <form class="mt-2" @submit.prevent="onSave">
      <div class="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div>
          <label class="tnum block text-xs text-mute" for="composer-quarter">Quarter</label>
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
        <p v-if="editingExisting" class="form-hint">Saving overwrites the {{ quarter }} entry.</p>
        <span class="flex-1" />
        <ActionLabel
          v-if="previousText && !text"
          @click="continuePrevious"
          aria-label="Continue previous entry"
        >Continue previous</ActionLabel>
      </div>

      <label class="mt-3 block text-xs text-mute" for="composer-text">What did the quarter hold</label>
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

      <label class="mt-3 block text-xs text-mute" for="composer-tags">Tags, comma separated, optional</label>
      <input
        id="composer-tags"
        v-model="tagsRaw"
        type="text"
        class="tufte-input"
        placeholder="writing, calls"
        :disabled="saving"
        aria-describedby="composer-error"
      />

      <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        <ActionLabel accent :disabled="saving || !canSave" @click="onSave">
          {{ saving ? 'Saving' : editingExisting ? 'Overwrite' : 'Save quarter' }}
        </ActionLabel>
        <span id="composer-count" class="tnum text-xs text-faint">{{ text.trim().length }} / 2000</span>
        <span v-if="saveError" id="composer-error" role="alert" class="field-error">{{ saveError }}</span>
      </div>
      <ul v-if="validation.length > 0" class="mt-2" aria-label="What to fix">
        <li v-for="e in validation" :key="e" class="field-error">{{ e }}</li>
      </ul>
    </form>
  </section>
</template>

<script setup lang="ts">
import { isQuarterTime, parseTags, validateEntryInput } from '~/composables/quarters'
import type { Entry } from '~/composables/useEntries'

const props = defineProps<{
  date: string
  quarter: string
  quarters: string[]
  entries: Entry[]
}>()

const emit = defineEmits<{
  save: [input: { date: string; time: string; text: string; tags: string[] }]
  quarterChange: [quarter: string]
}>()

const { loadDraft, saveDraft, clearDraft } = useDrafts()
const { pending, saveErrors } = useEntries()

const quarter = ref(props.quarter)
const text = ref('')
const tagsRaw = ref('')
const validation = ref<string[]>([])
const textArea = ref<HTMLTextAreaElement | null>(null)

const loggedQuarters = computed(() => new Set(props.entries.map((e) => e.time)))
const editingExisting = computed(() => loggedQuarters.value.has(quarter.value))
const saving = computed(() => !!pending.value[`${props.date} ${quarter.value}`])
const saveError = computed(() => saveErrors.value[`${props.date} ${quarter.value}`] ?? null)

const previousEntry = computed<Entry | null>(() => {
  const earlier = props.entries.filter((e) => e.time < quarter.value)
  return earlier.length > 0 ? earlier[earlier.length - 1] : null
})
const previousText = computed(() => previousEntry.value?.text ?? '')
const parsedTags = computed(() => parseTags(tagsRaw.value))
const canSave = computed(() => text.value.trim().length > 0 && isQuarterTime(quarter.value))

function savedEntryFor(q: string): Entry | undefined {
  return props.entries.find((e) => e.time === q)
}

function restore(): void {
  const existing = savedEntryFor(quarter.value)
  if (existing) {
    // A saved entry is the source of truth; a leftover draft only matters
    // when the last save failed and the entry is absent — then loadDraft below.
    text.value = existing.text
    tagsRaw.value = existing.tags.join(', ')
    return
  }
  const draft = loadDraft(props.date, quarter.value)
  text.value = draft.text
  tagsRaw.value = draft.tags
}

function persistDraft(): void {
  saveDraft(props.date, quarter.value, text.value, tagsRaw.value)
}

/** Prefill from the previous entry on this page (continue previous). */
function continuePrevious(): void {
  const prev = previousEntry.value
  if (!prev) return
  text.value = prev.text
  tagsRaw.value = prev.tags.join(', ')
  persistDraft()
  nextTick(() => textArea.value?.focus())
}

watch(
  () => props.quarter,
  (q) => {
    if (q && q !== quarter.value) {
      quarter.value = q
      restore()
      nextTick(() => textArea.value?.focus())
    }
  },
)
watch(() => props.date, restore)
// Entries arriving late (range fetch) refresh the form when it is pristine;
// a form with user text is never overwritten from under the user.
watch(
  () => props.entries,
  () => {
    if (!text.value && !tagsRaw.value) restore()
  },
  { deep: true },
)
watch([text, tagsRaw, quarter], persistDraft)
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
  clearDraft(props.date, quarter.value)
  validation.value = []
}

defineExpose({ noteSaved, restore, focus: () => textArea.value?.focus() })

onMounted(restore)
</script>
