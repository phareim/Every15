<template>
  <div>
    <MonoLabel dash>Preferences</MonoLabel>
    <h1 class="page-title">How the journal keeps time</h1>

    <p v-if="loadError" role="alert" class="field-error notice">
      Preferences couldn't load ({{ loadError }}). The form shows the usual setup;
      saving still tries the server.
    </p>
    <p v-else-if="loading && !ready" class="muted-italic journal-gap">Loading preferences…</p>
    <PreferencesForm v-if="ready" :key="formKey" :initial="formInitial" @saved="onSaved" />

    <HairlineRule class="export-gap" />
    <ExportPanel :today="today" />
  </div>
</template>

<script setup lang="ts">
import { dayInZone } from '~/composables/quarters'
import type { Settings } from '~/composables/useSettings'
import { defaultSettings } from '~/composables/quarters'

const { settings, effective, loading, loadError, fetchSettings } = useSettings()
const { show } = useToast()

const ready = computed(() => settings.value !== null || loadError.value !== null)
const formKey = ref(0)
const formInitial = computed<Settings>(
  () => settings.value ?? (defaultSettings() as Settings),
)
const today = ref(dayInZone(effective.value.timezone))

function onSaved(saved: Settings): void {
  formKey.value += 1
  today.value = dayInZone(saved.timezone)
  show('Preferences saved.')
}

onMounted(async () => {
  try {
    await fetchSettings()
    today.value = dayInZone(effective.value.timezone)
  } catch {
    /* the banner above names the failure; the usual setup stands */
  }
})
</script>
