<template>
  <div class="tufte-desk">
    <div class="shell">
      <header>
        <div class="masthead">
          <div>
            <MonoLabel dash>Every15</MonoLabel>
            <p class="masthead-title">What the quarter-hours held</p>
          </div>
          <span class="auth-zone">
            <MonoLabel v-if="authChecked && !user" accent>Not signed in</MonoLabel>
            <a v-if="authChecked && !user" class="tnum signin-link" :href="loginHref">Sign in</a>
          </span>
        </div>
        <nav class="desk-nav nav-gap" aria-label="Sections">
          <NuxtLink to="/">Day</NuxtLink>
          <NuxtLink to="/history">History</NuxtLink>
          <NuxtLink to="/week">Week</NuxtLink>
          <NuxtLink to="/settings">Preferences</NuxtLink>
        </nav>
        <HairlineRule class="nav-rule" desk />
      </header>

      <div class="tufte-sheet page-sheet sheet-gap">
        <NuxtPage />
      </div>

      <footer class="site-footer">
        <MonoLabel>Every entry is fifteen minutes</MonoLabel>
        <MonoLabel v-if="user" class="user-email">{{ user.email }}</MonoLabel>
      </footer>
    </div>
    <AppToast />
  </div>
</template>

<script setup lang="ts">
// The UI owns its CSS: the framework config names no stylesheets, so the
// shell imports the Tufte base layer first, then the app layer.
import '~/assets/css/tufte.css'
import '~/assets/css/fifteen.css'
import { backfillQuarters } from '~/composables/quarters'
import { reminderTarget, useBrowserNotify, useNow } from '~/composables/useReminders'

// Progressive enhancement without a paint flash: the class lands in <head>
// during SSR instead of after mount.
useHead({ htmlAttrs: { class: 'tufte-tactile' } })

// Foundation-owned session, read reactively — the middleware loads it.
const auth = useAuth() as unknown as {
  user: { value: { id: string; email: string; name: string | null } | null }
  checked: { value: boolean }
  loginUrl: () => string
}
const user = computed(() => auth.user.value)
const authChecked = computed(() => auth.checked.value)
const loginHref = computed(() => {
  try {
    return auth.loginUrl()
  } catch {
    return 'https://reader.phareim.no/login'
  }
})

// Timed nudges live at shell level, so they fire on any route while the app
// is open. The watcher below only computes; permission was granted by an
// explicit click, and each boundary fires once.
const { effective, fetchSettings } = useSettings()
const { permission, refresh, alreadyFired, fire } = useBrowserNotify()
const { today, nowTime, start, stop } = useNow(() => effective.value.timezone)
// Check today's entries before nudging, including when another date or route
// is open. This read doesn't replace the journal's selected range.
let checkingReminder = false
watch([nowTime, today, permission, effective], async () => {
  if (!user.value || permission.value !== 'granted' || checkingReminder) return
  const target = reminderTarget(effective.value, today.value, today.value, nowTime.value, [])
  if (!target || alreadyFired(user.value.id, today.value, target)) return
  checkingReminder = true
  const date = today.value
  try {
    const { entries } = await $fetch<{ entries: import('~/composables/useEntries').Entry[] }>('/api/entries', { params: { from: date, to: date } })
    if (!entries.some(entry => entry.time === target)) {
      const missing = backfillQuarters(effective.value, date, date, nowTime.value, entries.map(entry => entry.time)).length
      fire(user.value.id, date, target, Math.max(missing, 1))
    }
  } catch {
    // A failed read isn't evidence of unlogged time; retry at the next tick.
  } finally {
    checkingReminder = false
  }
})

onMounted(async () => {
  refresh()
  start()
  try { await fetchSettings() } catch { /* Pages show the loading error. */ }
})
onUnmounted(stop)
</script>
