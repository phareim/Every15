<template>
  <form @submit.prevent="onSave" aria-label="Preferences">
    <div class="mt-4">
      <label class="tnum block text-xs text-mute" for="pref-tz">Timezone — dates and reminders follow it</label>
      <input
        id="pref-tz"
        v-model="form.timezone"
        type="text"
        class="tufte-input tnum"
        placeholder="Europe/Oslo"
        list="tz-suggestions"
        :disabled="saving"
        aria-describedby="pref-error"
      />
      <datalist id="tz-suggestions">
        <option value="Europe/Oslo" />
        <option value="Europe/London" />
        <option value="Europe/Berlin" />
        <option value="America/New_York" />
        <option value="Asia/Tokyo" />
      </datalist>
    </div>

    <div class="mt-4 flex flex-wrap gap-x-6 gap-y-3">
      <div>
        <label class="tnum block text-xs text-mute" for="pref-start">Work starts</label>
        <select id="pref-start" v-model="form.startTime" class="tufte-input tnum" :disabled="saving">
          <option v-for="q in allQuarters" :key="q" :value="q">{{ q }}</option>
        </select>
      </div>
      <div>
        <label class="tnum block text-xs text-mute" for="pref-end">Work ends</label>
        <select id="pref-end" v-model="form.endTime" class="tufte-input tnum" :disabled="saving">
          <option v-for="q in endOptions" :key="q" :value="q">{{ q }}</option>
        </select>
      </div>
      <div>
        <span id="pref-cadence-label" class="tnum block text-xs text-mute">Reminder every</span>
        <div class="mt-1 flex gap-2" role="radiogroup" aria-labelledby="pref-cadence-label">
          <button
            v-for="m in [15, 30, 60]"
            :key="m"
            type="button"
            class="quarter-chip"
            :aria-pressed="form.reminderMinutes === m"
            :style="form.reminderMinutes === m ? 'border-color: var(--tufte-accent); color: var(--text-accent);' : ''"
            :disabled="saving"
            @click="form.reminderMinutes = m as 15 | 30 | 60"
          >{{ m }} min</button>
        </div>
      </div>
    </div>

    <fieldset class="mt-4">
      <legend class="tnum text-xs text-mute">Workdays</legend>
      <div class="mt-1 flex flex-wrap gap-2">
        <button
          v-for="d in dayOptions"
          :key="d.value"
          type="button"
          class="quarter-chip"
          :aria-pressed="form.workDays.includes(d.value)"
          :style="form.workDays.includes(d.value) ? 'border-color: var(--tufte-accent); color: var(--text-accent);' : ''"
          :disabled="saving"
          @click="toggleDay(d.value)"
        >{{ d.label }}</button>
      </div>
    </fieldset>

    <div class="mt-4 flex items-center gap-3">
      <input
        id="pref-reminders"
        v-model="form.remindersEnabled"
        type="checkbox"
        :disabled="saving"
      />
      <label for="pref-reminders" class="text-sm">Remind me on this open page when quarters go unlogged</label>
    </div>

    <div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
      <ActionLabel accent :disabled="saving || !dirty" @click="onSave">
        {{ saving ? 'Saving' : 'Save preferences' }}
      </ActionLabel>
      <span v-if="savedAt" class="form-hint">Saved.</span>
      <span v-if="localError" id="pref-error" role="alert" class="field-error">{{ localError }}</span>
      <span v-else-if="saveError" id="pref-error" role="alert" class="field-error">{{ saveError }}</span>
    </div>
  </form>
</template>

<script setup lang="ts">
import { quarterRange, validateSettings } from '~/composables/quarters'
import type { Settings } from '~/composables/useSettings'

const props = defineProps<{ initial: Settings }>()

const { saving, saveError, savedAt, saveSettings } = useSettings()
const emit = defineEmits<{ saved: [settings: Settings] }>()

const form = ref<Settings>({ ...props.initial, workDays: [...props.initial.workDays] })
const localError = ref<string | null>(null)

watch(
  () => props.initial,
  (s) => {
    form.value = { ...s, workDays: [...s.workDays] }
  },
  { deep: true },
)

const allQuarters = quarterRange('00:00', '24:00')
const endOptions = [...allQuarters.slice(1), '24:00']
const dayOptions = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
]

const dirty = computed(() => JSON.stringify(form.value) !== JSON.stringify(props.initial))

function toggleDay(v: number): void {
  const i = form.value.workDays.indexOf(v)
  if (i >= 0) form.value.workDays.splice(i, 1)
  else form.value.workDays.push(v)
}

async function onSave(): Promise<void> {
  localError.value = null
  const problems = validateSettings(form.value)
  if (problems.length > 0) {
    localError.value = problems[0]
    return
  }
  try {
    const saved = await saveSettings(form.value)
    emit('saved', saved)
  } catch {
    /* saveError from the store already names it */
  }
}
</script>
