import { toValue, watchEffect, type MaybeRefOrGetter } from 'vue'

/** Atualiza o título da aba (páginas com título dinâmico, como tópico/trilha). */
export function usePageTitle(title: MaybeRefOrGetter<string | null | undefined>) {
  watchEffect(() => {
    const value = toValue(title)
    document.title = value ? `${value} · Trilha Sênior` : 'Trilha Sênior'
  })
}
