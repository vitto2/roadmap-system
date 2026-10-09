import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ChecklistPanel from '../topic/ChecklistPanel.vue'
import { makeTopicDetail } from '@/test/factories'

describe('ChecklistPanel', () => {
  it('mostra os itens e o contador', () => {
    const items = makeTopicDetail().checklist.map((i, idx) => ({ ...i, checked: idx === 0 }))
    const wrapper = mount(ChecklistPanel, { props: { items } })

    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(3)
    expect(wrapper.get('[data-testid="checklist-count"]').text()).toBe('1 de 3')
    expect(wrapper.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('33')
  })

  it('emite toggle com a chave e o novo valor', async () => {
    const wrapper = mount(ChecklistPanel, { props: { items: makeTopicDetail().checklist } })
    await wrapper.findAll('input')[1]!.setValue(true)
    expect(wrapper.emitted('toggle')).toEqual([['dois', true]])
  })

  it('desabilita os checkboxes quando há mutação em andamento', () => {
    const wrapper = mount(ChecklistPanel, {
      props: { items: makeTopicDetail().checklist, disabled: true },
    })
    expect(wrapper.findAll('input').every((i) => i.attributes('disabled') !== undefined)).toBe(true)
  })
})
