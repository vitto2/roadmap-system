import { ref } from 'vue'
import { api } from '@/api'
import { errorMessage } from '@/api/client'
import type { ImportSummary } from '@/api/types'
import { saveBlob } from '@/lib/download'
import { useProfileStore } from '@/stores/profile'
import { useProjectsStore } from '@/stores/projects'
import { useReviewsStore } from '@/stores/reviews'
import { useRoadmapStore } from '@/stores/roadmap'
import { useSettingsStore } from '@/stores/settings'
import { useUiStore } from '@/stores/ui'

export type TransferAction = 'portfolio' | 'backup' | 'restore'

/** Exportação do portfólio (markdown), backup e restauração (JSON) do progresso. */
export function useDataTransfer() {
  const busy = ref<TransferAction | null>(null)
  const summary = ref<ImportSummary | null>(null)
  const ui = useUiStore()

  async function run(action: TransferAction, fn: () => Promise<void>) {
    busy.value = action
    try {
      await fn()
    } catch (e) {
      ui.pushToast(errorMessage(e), 'error', 6000)
    } finally {
      busy.value = null
    }
  }

  const exportPortfolio = () =>
    run('portfolio', async () => {
      const { blob, filename } = await api.exportPortfolio()
      saveBlob(blob, filename)
    })

  const exportBackup = () =>
    run('backup', async () => {
      const { blob, filename } = await api.exportBackup()
      saveBlob(blob, filename)
      ui.pushToast('Backup baixado.', 'success')
    })

  /** Substitui o progresso atual pelo conteúdo do arquivo de backup. */
  const restoreBackup = (file: File) =>
    run('restore', async () => {
      let parsed: unknown
      try {
        parsed = JSON.parse(await file.text())
      } catch {
        throw new Error('O arquivo não é um JSON válido.')
      }
      const result = await api.importBackup(parsed)
      summary.value = result.data
      useProfileStore().apply(result.profile)
      // todo o progresso mudou: invalida os caches das telas
      useRoadmapStore().invalidate()
      useProjectsStore().listLoaded = false
      await Promise.all([useReviewsStore().refreshDueCount(), useSettingsStore().load()])
      ui.pushToast('Backup restaurado.', 'success')
    })

  return { busy, summary, exportPortfolio, exportBackup, restoreBackup }
}
