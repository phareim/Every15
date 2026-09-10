<template>
  <div v-if="due" role="alert" class="reminder-strip">
    <p class="reminder-lead">
      <span class="text-accent-ink">{{ missing.length }} {{ missing.length === 1 ? 'quarter is' : 'quarters are' }}</span>
      unlogged — earliest {{ missing[0] }}.
    </p>
    <p class="reminder-row">
      <button type="button" class="tnum link" @click="emit('jump', missing[0])">
        Log {{ missing[0] }}
      </button>
      <button
        v-if="permission === 'default'"
        type="button"
        class="tnum link"
        @click="onEnable"
      >Enable notifications</button>
      <span v-else-if="permission === 'granted'" class="tnum reminder-note">Notifications on</span>
      <span v-else-if="permission === 'denied'" class="tnum reminder-note">Notifications blocked — allow them for this site, then enable again</span>
      <span v-else-if="permission === 'unsupported'" class="tnum reminder-note">This browser can't notify — this banner is the reminder</span>
    </p>
    <p v-if="permission === 'default'" class="form-hint reminder-note">
      Nudges arrive only while the app is open in a tab; a suspended tab may delay them.
    </p>
  </div>
</template>

<script setup lang="ts">
import { useBrowserNotify } from '~/composables/useReminders'

defineProps<{
  due: boolean
  missing: string[]
}>()

const emit = defineEmits<{ jump: [quarter: string] }>()
const { showError } = useToast()

const { permission, refresh, enable } = useBrowserNotify()

async function onEnable(): Promise<void> {
  const ok = await enable()
  if (!ok && permission.value === 'denied') {
    showError('Notifications are blocked for this site. Allow them in the browser, then try again.')
  }
}

onMounted(refresh)
</script>
