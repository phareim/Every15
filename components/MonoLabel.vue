<template>
  <span class="mono-label" :class="accent ? 'mono-label--accent' : ''"
    ><template v-if="dash">&mdash;&nbsp;</template><slot /></span>
</template>

<script setup lang="ts">
defineProps<{
  /** Leading em-dash, the Tufte/Almanac section-label convention. */
  dash?: boolean
  /** Promote to the screen's single accent. */
  accent?: boolean
}>()
</script>
