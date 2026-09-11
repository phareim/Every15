/** One toast at a time; errors stay until dismissed, notes fade. */

export interface Toast {
  id: number
  message: string
  kind: 'error' | 'note'
  actionLabel?: string
}

export function useToast() {
  const toast = useState<Toast | null>('fifteen_toast', () => null)
  const nextId = useState<number>('fifteen_toast_seq', () => 0)
  let timer: ReturnType<typeof setTimeout> | null = null

  function dismiss(): void {
    toast.value = null
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  function show(message: string, kind: Toast['kind'] = 'note', actionLabel?: string): void {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    const id = ++nextId.value
    toast.value = { id, message, kind, actionLabel }
    if (kind === 'note') {
      timer = setTimeout(() => {
        if (toast.value?.id === id) toast.value = null
        timer = null
      }, 6000)
    }
  }

  function showError(message: string): void {
    show(message, 'error')
  }

  return { toast, show, showError, dismiss }
}
