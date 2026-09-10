<template>
  <div class="tufte-desk">
    <div class="shell">
      <header>
        <div class="masthead">
          <div>
            <MonoLabel dash>Fifteen</MonoLabel>
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
const { effective } = useSettings()
const { sorted } = useEntries()
const { permission, fire } = useBrowserNotify()
const { today, nowTime, start, stop } = useNow(() => effective.value.timezone)
const route = useRoute()

const liveDay = computed(() => {
  const q = route.query.date
  return typeof q === 'string' && q ? q : today.value
})

watch([nowTime, today, sorted, permission], () => {
  if (permission.value !== 'granted') return
  const target = reminderTarget(
    effective.value,
    liveDay.value,
    today.value,
    nowTime.value,
    sorted.value,
  )
  if (!target) return
  const logged = sorted.value.filter((e) => e.date === liveDay.value).map((e) => e.time)
  const missing = backfillQuarters(
    effective.value,
    liveDay.value,
    today.value,
    nowTime.value,
    logged,
  ).length
  fire(user.value?.id ?? 'anon', liveDay.value, target, Math.max(missing, 1))
})

onMounted(start)
onUnmounted(stop)
</script>
