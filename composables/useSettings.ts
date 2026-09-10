/**
 * Settings store: GET /api/settings and PUT /api/settings -> {settings}.
 * PUT accepts the full Settings object. Client mirrors the contract
 * validation (server re-validates); nothing saves while invalid.
 */
import { defaultSettings, validateSettings } from './quarters'

export interface Settings {
  timezone: string
  startTime: string
  endTime: string
  workDays: number[]
  reminderMinutes: 15 | 30 | 60
  remindersEnabled: boolean
}

export function useSettings() {
  const settings = useState<Settings | null>('fifteen_settings', () => null)
  const loading = useState<boolean>('fifteen_settings_loading', () => false)
  const saving = useState<boolean>('fifteen_settings_saving', () => false)
  const loadError = useState<string | null>('fifteen_settings_load_error', () => null)
  const saveError = useState<string | null>('fifteen_settings_save_error', () => null)
  const savedAt = useState<string | null>('fifteen_settings_saved_at', () => null)

  let loadSeq = 0

  async function fetchSettings(): Promise<Settings> {
    const seq = ++loadSeq
    loading.value = true
    loadError.value = null
    try {
      const data = await $fetch<{ settings: Settings }>('/api/settings')
      if (seq !== loadSeq) return data.settings
      settings.value = data.settings
      return data.settings
    } catch (err) {
      if (seq === loadSeq) {
        // Honest fallback: the daytime fallback keeps the journal usable and
        // the banner on the page reports the failure.
        if (!settings.value) settings.value = defaultSettings() as Settings
        loadError.value = err instanceof Error ? err.message : 'Could not load preferences.'
      }
      throw err
    } finally {
      if (seq === loadSeq) loading.value = false
    }
  }

  async function saveSettings(next: Settings): Promise<Settings> {
    const problems = validateSettings(next)
    if (problems.length > 0) {
      saveError.value = problems[0]
      throw new Error(problems[0])
    }
    saving.value = true
    saveError.value = null
    try {
      const data = await $fetch<{ settings: Settings }>('/api/settings', {
        method: 'PUT',
        body: next,
      })
      settings.value = data.settings
      savedAt.value = new Date().toISOString()
      return data.settings
    } catch (err) {
      saveError.value = err instanceof Error ? err.message : 'Could not save preferences.'
      throw err
    } finally {
      saving.value = false
    }
  }

  /** Settings for wall-clock math: loaded settings, else the daytime fallback. */
  const effective = computed<Settings>(() => settings.value ?? (defaultSettings() as Settings))

  return { settings, effective, loading, saving, loadError, saveError, savedAt, fetchSettings, saveSettings }
}
