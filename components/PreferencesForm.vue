<template>
  <form class="prefs-form" aria-label="Preferences" @submit.prevent="onSave">
    <div class="field-block">
      <label class="field-label tnum" for="pref-tz">Timezone — dates and reminders follow it</label>
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

    <div class="prefs-row">
      <div class="field-inline">
        <label class="field-label tnum" for="pref-start">Work starts</label>
        <select id="pref-start" v-model="form.startTime" class="tufte-input tnum" :disabled="saving">
          <option v-for="q in allQuarters" :key="q" :value="q">{{ q }}</option>
        </select>
      </div>
      <div class="field-inline">
        <label class="field-label tnum" for="pref-end">Work ends</label>
        <select id="pref-end" v-model="form.endTime" class="tufte-input tnum" :disabled="saving">
          <option v-for="q in endOptions" :key="q" :value="q">{{ q }}</option>
        </select>
      </div>
      <div class="field-inline">
        <span id="pref-cadence-label" class="field-label tnum">Reminder every</span>
        <div class="chip-row chip-tight" role="radiogroup" aria-labelledby="pref-cadence-label">
          <button
            v-for="m in [15, 30, 60]"
            :key="m"
            type="button"
            class="quarter-chip"
            :class="form.reminderMinutes === m ? 'quarter-chip--on' : ''"
            :aria-pressed="form.reminderMinutes === m"
            :disabled="saving"
            @click="form.reminderMinutes = m as 15 | 30 | 60"
          >{{ m }} min</button>
        </div>
      </div>
    </div>

    <fieldset class="field-block">
      <legend class="field-label tnum">Workdays</legend>
      <div class="chip-row chip-tight">
        <button
          v-for="d in dayOptions"
          :key="d.value"
          type="button"
          class="quarter-chip"
          :class="form.workDays.includes(d.value) ? 'quarter-chip--on' : ''"
          :aria-pressed="form.workDays.includes(d.value)"
          :disabled="saving"
          @click="toggleDay(d.value)"
        >{{ d.label }}</button>
      </div>
    </fieldset>

    <div class="prefs-check">
      <input
        id="pref-reminders"
        v-model="form.remindersEnabled"
        type="checkbox"
        :disabled="saving"
      />
      <label for="pref-reminders" class="prefs-check-label">Remind me when quarters go unlogged</label>
    </div>

    <div class="composer-actions">
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
// Quarter-hour HH:mm only, matching the API contract — no 24:00.
const endOptions = allQuarters
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
