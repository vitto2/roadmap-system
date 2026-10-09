import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { ProjectDetail } from '@/api/types'
import { ApiError } from '@/api/client'
import { makeProfile } from '@/test/factories'
import { useProfileStore } from '../profile'
import { useProjectsStore } from '../projects'
import { useUiStore } from '../ui'

vi.mock('@/api')
import { api } from '@/api'

function makeProject(overrides: Partial<ProjectDetail> = {}): ProjectDetail {
  return {
    slug: 'encurtador',
    title: 'Encurtador de URL',
    description: 'Projeto',
    careerLevel: 'junior',
    difficulty: 2,
    status: 'not_started',
    milestonesTotal: 2,
    milestonesCompleted: 0,
    totalXp: 260,
    earnedXp: 0,
    repositoryUrl: null,
    deployUrl: null,
    milestones: [
      {
        key: 'api',
        title: 'API',
        acceptanceCriteria: ['Cria links curtos'],
        xp: 30,
        status: 'pending',
        completedAt: null,
      },
    ],
    topics: [],
    bonus: { finished: false, finishXp: 0, repositoryXp: 0, deployXp: 0, total: 0 },
    ...overrides,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('projects store', () => {
  it('carrega a lista e o detalhe', async () => {
    vi.mocked(api.projects).mockResolvedValue([makeProject()])
    vi.mocked(api.project).mockResolvedValue(makeProject())
    const store = useProjectsStore()

    await store.loadList()
    await store.load('encurtador')

    expect(store.projects).toHaveLength(1)
    expect(store.listLoaded).toBe(true)
    expect(store.current?.slug).toBe('encurtador')
  })

  it('marca 404 como não encontrado', async () => {
    vi.mocked(api.project).mockRejectedValue(
      new ApiError(404, 'not_found', 'Projeto não encontrado(a).'),
    )
    const store = useProjectsStore()
    await store.load('nada')
    expect(store.notFound).toBe(true)
  })

  it('concluir etapa aplica o perfil do servidor e invalida a lista', async () => {
    vi.mocked(api.project).mockResolvedValue(makeProject())
    const store = useProjectsStore()
    await store.load('encurtador')
    store.listLoaded = true
    useProfileStore().profile = makeProfile({ total: 0 })

    vi.mocked(api.setMilestoneStatus).mockResolvedValue({
      data: makeProject({ status: 'in_progress', milestonesCompleted: 1, earnedXp: 30 }),
      profile: makeProfile({ total: 30 }),
    })

    expect(await store.setMilestoneStatus('api', 'completed')).toBe(true)
    expect(api.setMilestoneStatus).toHaveBeenCalledWith('encurtador', 'api', 'completed')
    expect(store.current?.earnedXp).toBe(30)
    expect(store.listLoaded).toBe(false)
    expect(useUiStore().toasts.map((t) => t.message)).toContain('+30 XP')
  })

  it('salva links e mostra erro do servidor como toast', async () => {
    vi.mocked(api.project).mockResolvedValue(makeProject())
    const store = useProjectsStore()
    await store.load('encurtador')

    vi.mocked(api.updateProjectLinks).mockRejectedValue(
      new ApiError(422, 'validation_failed', 'Os dados enviados são inválidos.'),
    )
    expect(await store.saveLinks({ repositoryUrl: 'ftp://x' })).toBe(false)
    expect(useUiStore().toasts[0]?.kind).toBe('error')
    expect(store.busy).toBe(false)
  })
})
