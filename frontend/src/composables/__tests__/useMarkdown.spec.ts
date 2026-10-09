import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '../useMarkdown'

describe('renderMarkdown', () => {
  it('renderiza markdown básico', () => {
    const html = renderMarkdown('# Título\n\n- item 1\n- item 2\n\n`codigo`')
    expect(html).toContain('<h1>Título</h1>')
    expect(html).toContain('<li>item 1</li>')
    expect(html).toContain('<code>codigo</code>')
  })

  it('não permite HTML cru nem scripts', () => {
    const html = renderMarkdown('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>')
    // o texto aparece escapado (inofensivo); o que não pode existir são elementos/atributos ativos
    const dom = new DOMParser().parseFromString(html, 'text/html')
    expect(dom.querySelector('script, img, [onerror]')).toBeNull()
    expect(html).not.toContain('<script')
    expect(html).not.toContain('<img')
  })

  it('remove protocolos perigosos em links', () => {
    const html = renderMarkdown('[clique](javascript:alert(1)) e [ok](https://example.com)')
    expect(html).not.toContain('href="javascript')
    expect(html).toContain('href="https://example.com"')
  })

  it('links externos abrem em nova aba com rel seguro', () => {
    const html = renderMarkdown('[site](https://example.com)')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer nofollow"')
  })

  it('devolve string vazia para texto vazio', () => {
    expect(renderMarkdown('')).toBe('')
  })
})
