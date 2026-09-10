<template>
  <div
    v-if="due"
    role="alert"
    class="mt-4 border border-rule px-4 py-3"
    style="background: var(--surface-sunk);"
  >
    <p class="leading-snug">
      <span class="text-accent-ink">Open page:</span>
      {{ missing.length }} {{ missing.length === 1 ? 'quarter is' : 'quarters are' }}
      unlogged — earliest {{ missing[0] }}.
    </p>
    <p class="mt-2">
      <button type="button" class="tnum text-xs underline" @click="emit('jump', missing[0])">
        Log {{ missing[0] }}
      </button>
    </p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  due: boolean
  missing: string[]
}>()

const emit = defineEmits<{ jump: [quarter: string] }>()
</script>
