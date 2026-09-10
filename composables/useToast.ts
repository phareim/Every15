/** One toast at a time; errors stay until dismissed, notes fade. */

export interface Toast {
  id: number
  message: string
  kind: 'error' | 'note'
  actionLabel?: string
}

export function useToast() {
  const toast = useState<Toast | null>('fifteen_toast', () => null)
  let nextId = 1
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
    toast.value = { id: nextId++, message, kind, actionLabel }
    if (kind === 'note') {
      timer = setTimeout(() => {
        toast.value = null
        timer = null
      }, 6000)
    }
  }

  function showError(message: string): void {
    show(message, 'error')
  }

  return { toast, show, showError, dismiss }
}
