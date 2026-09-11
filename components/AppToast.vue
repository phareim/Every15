<template>
  <div
    v-if="toast"
    role="status"
    aria-live="polite"
    class="tufte-sheet toast-card"
  >
    <div class="toast-row">
      <p class="toast-msg" :class="toast.kind === 'error' ? 'toast-msg--error' : ''">
        {{ toast.message }}
      </p>
      <div class="toast-tools">
        <button
          v-if="toast.actionLabel === 'Undo'"
          type="button"
          class="tnum tool-link"
          :disabled="undoing"
          @click="onUndo"
        >Undo</button>
        <button type="button" class="tnum tool-link" aria-label="Dismiss message" @click="dismiss">
          Dismiss
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { toast, dismiss, show } = useToast()
const { undoDelete } = useEntries()
const undoing = ref(false)

async function onUndo() {
  if (undoing.value) return
  undoing.value = true
  try {
    const restored = await undoDelete()
    if (restored) show('Entry restored.')
    else show('Nothing left to undo.')
  } catch {
    // The snapshot is kept, so this same button retries the restore.
    show('Could not restore — try again.', 'error', 'Undo')
  } finally {
    undoing.value = false
  }
}

</script>
