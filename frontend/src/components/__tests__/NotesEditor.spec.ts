import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import NotesEditor from '../topic/NotesEditor.vue'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('NotesEditor', () => {
  it('salva automaticamente depois de parar de digitar', async () => {
    const wrapper = mount(NotesEditor, { props: { notes: '' } })
    const textarea = wrapper.get('textarea')

    await textarea.setValue('# Meu resumo')
    expect(wrapper.get('[data-testid="notes-status"]').text()).toBe('Alterações não salvas')
    expect(wrapper.emitted('save')).toBeUndefined()

    vi.advanceTimersByTime(1000)
    expect(wrapper.emitted('save')).toEqual([['# Meu resumo']])
  })

  it('salva ao sair do campo (blur) sem esperar o atraso', async () => {
    const wrapper = mount(NotesEditor, { props: { notes: '' } })
    const textarea = wrapper.get('textarea')
    await textarea.setValue('rápido')
    await textarea.trigger('blur')
    expect(wrapper.emitted('save')).toEqual([['rápido']])
  })

  it('visualiza o markdown sanitizado', async () => {
    const wrapper = mount(NotesEditor, {
      props: { notes: '**negrito** <script>alert(1)</script>' },
    })
    await wrapper.get('#tab-preview').trigger('click')
    const preview = wrapper.get('[data-testid="notes-preview"]')
    expect(preview.html()).toContain('<strong>negrito</strong>')
    expect(preview.html()).not.toContain('<script')
  })

  it('mostra "Salvo" quando o rascunho é igual ao valor salvo e "Salvando…" durante o envio', async () => {
    const wrapper = mount(NotesEditor, { props: { notes: 'abc' } })
    expect(wrapper.get('[data-testid="notes-status"]').text()).toBe('Salvo')
    await wrapper.setProps({ saving: true })
    expect(wrapper.get('[data-testid="notes-status"]').text()).toBe('Salvando…')
  })
})
