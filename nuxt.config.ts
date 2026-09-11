// https://nuxt.com/docs/api/configuration/nuxt-config
//
// Foundation config. Deliberately names NO css files: app.vue (UI package)
// imports the stylesheet. Framework config stays out of the UI's way.
export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: false },

  app: {
    head: {
      title: 'Every15',
      htmlAttrs: { lang: 'en', class: 'tufte-tactile' },
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'manifest', href: '/manifest.webmanifest' },
      ],
      meta: [
        { name: 'description', content: 'Write what you actually spent each quarter-hour doing' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#f4f1ea', media: '(prefers-color-scheme: light)' },
        { name: 'theme-color', content: '#2a2622', media: '(prefers-color-scheme: dark)' },
      ],
    },
  },

  nitro: {
    preset: 'cloudflare-module',
  },

  runtimeConfig: {
    allowedUserEmails: '', // NUXT_ALLOWED_USER_EMAILS (wrangler [vars], comma-separated)
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },
})
