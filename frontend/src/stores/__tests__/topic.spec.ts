import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ApiError } from '@/api/client'
import { makeProfile, makeTopicDetail } from '@/test/factories'
import { useProfileStore } from '../profile'
import { useRoadmapStore } from '../roadmap'
import { useTopicStore } from '../topic'
import { useUiStore } from '../ui'

vi.mock('@/api')
import { api } from '@/api'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

async function loadedStore() {
  vi.mocked(api.topic).mockResolvedValue(makeTopicDetail())
  const store = useTopicStore()
  await store.load('topico-a')
  return store
}

describe('topic store', () => {
  it('carrega o detalhe do tópico', async () => {
    const store = await loadedStore()
    expect(store.current?.slug).toBe('topico-a')
    expect(store.error).toBeNull()
  })

  it('marca 404 como "não encontrado"', async () => {
    vi.mocked(api.topic).mockRejectedValue(
      new ApiError(404, 'not_found', 'Tópico não encontrado(a).'),
    )
    const store = useTopicStore()
    await store.load('nada')
    expect(store.notFound).toBe(true)
    expect(store.current).toBeNull()
  })

  it('toggleItem é otimista e aplica o perfil devolvido pelo servidor', async () => {
    const store = await loadedStore()
    const profile = useProfileStore()
    profile.profile = makeProfile({ total: 0 })
    const roadmap = useRoadmapStore()

    let resolveRequest!: (value: unknown) => void
    vi.mocked(api.setChecklistItem).mockReturnValue(
      new Promise((resolve) => (resolveRequest = resolve)) as never,
    )

    const pending = store.toggleItem('um', true)
    // antes da resposta: já aparece marcado
    expect(store.current?.checklist[0]?.checked).toBe(true)
    expect(store.current?.checklistChecked).toBe(1)

    resolveRequest({
      data: makeTopicDetail({
        status: 'studying',
        checklistChecked: 1,
        checklist: makeTopicDetail().checklist.map((i) => ({ ...i, checked: i.key === 'um' })),
      }),
      profile: makeProfile({ total: 0 }),
    })
    await pending

    expect(store.current?.status).toBe('studying')
    expect(roadmap.stale).toBe(true)
  })

  it('toggleItem faz rollback e mostra erro quando o servidor recusa', async () => {
    const store = await loadedStore()
    const ui = useUiStore()
    vi.mocked(api.setChecklistItem).mockRejectedValue(
      new ApiError(404, 'not_found', 'Item não encontrado'),
    )

    await store.toggleItem('um', true)

    expect(store.current?.checklist[0]?.checked).toBe(false)
    expect(store.current?.checklistChecked).toBe(0)
    expect(ui.toasts.some((t) => t.kind === 'error' && t.message === 'Item não encontrado')).toBe(
      true,
    )
  })

  it('complete aplica XP do servidor (sem recalcular no front)', async () => {
    const store = await loadedStore()
    const profile = useProfileStore()
    profile.profile = makeProfile({ total: 0 })
    vi.mocked(api.completeTopic).mockResolvedValue({
      data: makeTopicDetail({ status: 'completed' }),
      profile: makeProfile({ total: 30 }),
    })

    const ok = await store.complete()

    expect(ok).toBe(true)
    expect(store.current?.status).toBe('completed')
    expect(profile.profile?.xp.total).toBe(30)
    expect(useUiStore().toasts.map((t) => t.message)).toContain('+30 XP')
  })

  it('exibe o erro do servidor quando o checklist está incompleto', async () => {
    const store = await loadedStore()
    vi.mocked(api.completeTopic).mockRejectedValue(
      new ApiError(
        409,
        'checklist_incomplete',
        'Marque todos os itens do checklist antes de concluir o tópico.',
      ),
    )
    expect(await store.complete()).toBe(false)
    expect(store.busy).toBe(false)
    expect(useUiStore().toasts[0]?.message).toContain('Marque todos os itens')
  })

  it('master, reopen, status, notas e evidência chamam os endpoints certos', async () => {
    const store = await loadedStore()
    const result = { data: makeTopicDetail(), profile: makeProfile() }
    for (const fn of [api.masterTopic, api.reopenTopic, api.updateTopicProgress]) {
      vi.mocked(fn).mockResolvedValue(result)
    }

    await store.master()
    await store.reopen()
    await store.setStatus('studying')
    await store.saveNotes('# oi')
    await store.saveEvidence(null)

    expect(api.masterTopic).toHaveBeenCalledWith('topico-a')
    expect(api.reopenTopic).toHaveBeenCalledWith('topico-a')
    expect(api.updateTopicProgress).toHaveBeenCalledWith('topico-a', { status: 'studying' })
    expect(api.updateTopicProgress).toHaveBeenCalledWith('topico-a', { notes: '# oi' })
    expect(api.updateTopicProgress).toHaveBeenCalledWith('topico-a', { evidenceUrl: null })
  })
})
