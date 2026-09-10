<template>
  <hr class="hairline" :class="desk ? 'hairline--desk' : ''" />
</template>

<script setup lang="ts">
defineProps<{
  /** The rule sits on the desk, not on a sheet — embossed instead of debossed under the tactile layer. */
  desk?: boolean
}>()
</script>
