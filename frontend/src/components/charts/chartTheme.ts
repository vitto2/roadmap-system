import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'

/** Cores dos gráficos acompanham o tema (claro/escuro) com contraste adequado. */
export function useChartColors() {
  const ui = useUiStore()
  return computed(() => {
    const dark = ui.theme === 'dark'
    return {
      text: dark ? '#cbd5e1' : '#334155',
      grid: dark ? 'rgba(148, 163, 184, 0.25)' : 'rgba(100, 116, 139, 0.25)',
      primary: dark ? '#818cf8' : '#4f46e5',
      primaryFill: dark ? 'rgba(129, 140, 248, 0.25)' : 'rgba(79, 70, 229, 0.18)',
      accent: dark ? '#fbbf24' : '#d97706',
    }
  })
}
