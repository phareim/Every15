<template>
  <section aria-label="Export" class="mt-8">
    <MonoLabel dash>Export</MonoLabel>
    <form class="mt-2 flex flex-wrap items-end gap-x-4 gap-y-3" @submit.prevent="onDownload">
      <div>
        <label class="tnum block text-xs text-mute" for="export-from">From</label>
        <input id="export-from" v-model="from" type="date" class="tufte-input tnum" :max="to" />
      </div>
      <div>
        <label class="tnum block text-xs text-mute" for="export-to">To</label>
        <input id="export-to" v-model="to" type="date" class="tufte-input tnum" :min="from" :max="today" />
      </div>
      <div>
        <label class="tnum block text-xs text-mute" for="export-format">Format</label>
        <select id="export-format" v-model="format" class="tufte-input tnum">
          <option value="csv">CSV</option>
          <option value="json">JSON</option>
        </select>
      </div>
      <ActionLabel accent :disabled="downloading || !valid" @click="onDownload">
        {{ downloading ? 'Preparing' : 'Download' }}
      </ActionLabel>
    </form>
    <p v-if="error" role="alert" class="field-error mt-2">{{ error }}</p>
    <p class="form-hint mt-2">Up to 366 days. CSV cells are quoted and formula-safe.</p>
  </section>
</template>

<script setup lang="ts">
import { addDays, compareDays, isDayString } from '~/composables/quarters'

const props = defineProps<{ today: string }>()

const to = ref(props.today)
const from = ref(addDays(props.today, -6))
const format = ref<'csv' | 'json'>('csv')
const downloading = ref(false)
const error = ref<string | null>(null)

const valid = computed(
  () =>
    isDayString(from.value) &&
    isDayString(to.value) &&
    compareDays(from.value, to.value) <= 0 &&
    compareDays(to.value, props.today) <= 0,
)

async function onDownload(): Promise<void> {
  if (!valid.value || downloading.value) return
  downloading.value = true
  error.value = null
  try {
    // Blob via $fetch (not a plain link) so failures surface as words,
    // not a silent navigation.
    const blob = await $fetch<Blob>('/api/export', {
      params: { from: from.value, to: to.value, format: format.value },
      responseType: 'blob',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fifteen-${from.value}-${to.value}.${format.value}`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not prepare the export.'
  } finally {
    downloading.value = false
  }
}
</script>
