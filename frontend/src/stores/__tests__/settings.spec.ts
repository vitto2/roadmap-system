import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ApiError } from '@/api/client'
import { makeProfile } from '@/test/factories'
import { useProfileStore } from '../profile'
import { useSettingsStore } from '../settings'
import { useUiStore } from '../ui'

vi.mock('@/api')
import { api } from '@/api'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  vi.mocked(api.profile).mockResolvedValue(makeProfile())
  vi.mocked(api.reviews).mockResolvedValue([])
})

describe('settings store', () => {
  it('carrega e salva, recarregando o perfil (streak e meta dependem das configurações)', async () => {
    vi.mocked(api.settings).mockResolvedValue({ timezone: 'America/Sao_Paulo', weeklyGoal: 5 })
    vi.mocked(api.updateSettings).mockResolvedValue({ timezone: 'UTC', weeklyGoal: 3 })
    const store = useSettingsStore()
    await store.load()
    expect(store.settings?.weeklyGoal).toBe(5)

    expect(await store.save({ timezone: 'UTC', weeklyGoal: 3 })).toBe(true)
    expect(store.settings).toEqual({ timezone: 'UTC', weeklyGoal: 3 })
    expect(api.profile).toHaveBeenCalled()
    expect(useProfileStore().profile).not.toBeNull()
    expect(useUiStore().toasts[0]?.message).toBe('Configurações salvas.')
  })

  it('expõe os erros de validação por campo', async () => {
    vi.mocked(api.updateSettings).mockRejectedValue(
      new ApiError(422, 'validation_failed', 'Os dados enviados são inválidos.', {
        timezone: ['Fuso horário inválido'],
      }),
    )
    const store = useSettingsStore()
    expect(await store.save({ timezone: 'Marte/Olympus' })).toBe(false)
    expect(store.fieldErrors.timezone).toEqual(['Fuso horário inválido'])
    expect(store.saving).toBe(false)
  })
})
