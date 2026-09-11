<template>
  <button
    type="button"
    class="action-label"
    :class="accent ? 'action-label--accent' : ''"
    :disabled="disabled"
    @click="emit('click')"
  ><!-- With an icon slot, the glyph carries the button on narrow screens and
        the text label takes over on wider ones. Without one, text always. -->
    <span v-if="$slots.icon" class="action-label__icon" aria-hidden="true"><slot name="icon" /></span>
    <span :class="$slots.icon ? 'action-label__text' : undefined"><slot /></span>
  </button>
</template>

<script setup lang="ts">
defineProps<{ accent?: boolean; disabled?: boolean }>()
const emit = defineEmits<{ click: [] }>()
</script>
