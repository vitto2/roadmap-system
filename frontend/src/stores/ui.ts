import { ref } from 'vue'
import { defineStore } from 'pinia'

export type Theme = 'light' | 'dark'
export type ToastKind = 'success' | 'info' | 'error'

export interface Toast {
  id: number
  kind: ToastKind
  message: string
}

const STORAGE_KEY = 'theme'

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // localStorage indisponível
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const useUiStore = defineStore('ui', () => {
  const theme = ref<Theme>(initialTheme())
  const toasts = ref<Toast[]>([])
  let nextToastId = 1

  function applyTheme() {
    document.documentElement.classList.toggle('dark', theme.value === 'dark')
  }

  function setTheme(value: Theme) {
    theme.value = value
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {
      // ignorar
    }
    applyTheme()
  }

  function toggleTheme() {
    setTheme(theme.value === 'dark' ? 'light' : 'dark')
  }

  function pushToast(message: string, kind: ToastKind = 'info', durationMs = 3500) {
    const id = nextToastId++
    toasts.value.push({ id, kind, message })
    if (durationMs > 0) setTimeout(() => dismissToast(id), durationMs)
    return id
  }

  function dismissToast(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  return { theme, toasts, applyTheme, setTheme, toggleTheme, pushToast, dismissToast }
})
