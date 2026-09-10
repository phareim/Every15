<template>
  <div
    v-if="toast"
    role="status"
    aria-live="polite"
    class="tufte-sheet fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 px-4 py-3"
  >
    <div class="flex items-center justify-between gap-3">
      <p class="text-sm italic" :class="toast.kind === 'error' ? 'text-accent-ink not-italic' : ''">
        {{ toast.message }}
      </p>
      <div class="flex shrink-0 items-center gap-3">
        <button
          v-if="toast.actionLabel === 'Undo'"
          type="button"
          class="tnum text-xs underline"
          :disabled="undoing"
          @click="onUndo"
        >Undo</button>
        <button type="button" class="tnum text-xs underline" aria-label="Dismiss message" @click="dismiss">
          Dismiss
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { toast, dismiss, show, showError } = useToast()
const { undoDelete } = useEntries()
const undoing = ref(false)

async function onUndo() {
  if (undoing.value) return
  undoing.value = true
  try {
    const restored = await undoDelete()
    if (restored) show('Entry restored.')
    else show('Nothing left to undo.')
  } catch (err) {
    showError(err instanceof Error ? err.message : 'Could not restore the entry.')
  } finally {
    undoing.value = false
  }
}
</script>
