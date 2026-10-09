import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MilestoneItem from '../projects/MilestoneItem.vue'

const milestone = {
  key: 'api',
  title: 'Criar a API',
  acceptanceCriteria: ['Cria links curtos', 'Redireciona com 301'],
  xp: 30,
  status: 'pending' as const,
  completedAt: null,
}

describe('MilestoneItem', () => {
  it('mostra título, XP e critérios de aceite', () => {
    const wrapper = mount(MilestoneItem, { props: { milestone, index: 0 } })
    expect(wrapper.text()).toContain('Criar a API')
    expect(wrapper.text()).toContain('30 XP')
    expect(wrapper.findAll('ul > li')).toHaveLength(2)
  })

  it('emite set-status ao escolher outro status e ignora o status atual', async () => {
    const wrapper = mount(MilestoneItem, { props: { milestone, index: 0 } })
    const buttons = wrapper.findAll('button')

    await buttons[0]!.trigger('click') // já é "Pendente"
    expect(wrapper.emitted('set-status')).toBeUndefined()

    await buttons[2]!.trigger('click')
    expect(wrapper.emitted('set-status')).toEqual([['completed']])
  })

  it('marca o botão do status atual como pressionado', () => {
    const wrapper = mount(MilestoneItem, {
      props: { milestone: { ...milestone, status: 'in_progress' }, index: 1 },
    })
    const pressed = wrapper.findAll('button').filter((b) => b.attributes('aria-pressed') === 'true')
    expect(pressed).toHaveLength(1)
    expect(pressed[0]!.text()).toBe('Em andamento')
  })
})
