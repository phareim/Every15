<template>
  <div class="tufte-desk">
    <div class="mx-auto w-full max-w-2xl px-4 pb-24 pt-6 sm:px-5 sm:pt-8">
      <header>
        <div class="flex items-baseline justify-between gap-3">
          <div>
            <MonoLabel dash>Fifteen</MonoLabel>
            <p class="mt-1 text-2xl leading-tight">What the quarter-hours held</p>
          </div>
          <span class="shrink-0">
            <MonoLabel v-if="authChecked && !user" accent>Not signed in</MonoLabel>
            <a v-if="authChecked && !user" class="tnum ml-2 text-xs underline" :href="loginHref">Sign in</a>
          </span>
        </div>
        <nav class="desk-nav mt-3 flex flex-wrap gap-x-5 gap-y-2" aria-label="Sections">
          <NuxtLink to="/">Day</NuxtLink>
          <NuxtLink to="/history">History</NuxtLink>
          <NuxtLink to="/week">Week</NuxtLink>
          <NuxtLink to="/settings">Preferences</NuxtLink>
        </nav>
        <HairlineRule class="mt-4" desk />
      </header>

      <div class="tufte-sheet page-sheet mt-5 px-5 py-5 sm:px-7 sm:py-6">
        <NuxtPage />
      </div>

      <footer class="mt-4 flex items-baseline justify-between">
        <MonoLabel>Every entry is fifteen minutes</MonoLabel>
        <MonoLabel v-if="user">{{ user.email }}</MonoLabel>
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

// useAuth is foundation-owned (work package 1). It resolves once the
// packages merge; until then the header below degrades to unsigned-in.
const user = ref<{ id: string; email: string; name: string | null } | null>(null)
const authChecked = ref(false)
const loginHref = ref('https://reader.phareim.no/login')

onMounted(async () => {
  // Tactile paper is progressive enhancement: without the class the tokens
  // resolve flat and nothing moves.
  document.documentElement.classList.add('tufte-tactile')
  try {
    const auth = useAuth() as unknown as {
      user: { value: typeof user.value }
      checked: { value: boolean }
      fetchSession: () => Promise<unknown>
      loginUrl: () => string
    }
    await auth.fetchSession()
    user.value = auth.user.value
    authChecked.value = auth.checked.value
    try {
      loginHref.value = auth.loginUrl()
    } catch {
      /* keep the Reader fallback */
    }
  } catch {
    authChecked.value = true
  }
})
</script>
