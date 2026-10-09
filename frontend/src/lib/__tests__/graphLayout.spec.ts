import { describe, expect, it } from 'vitest'
import { NODE_HEIGHT, NODE_WIDTH, layoutGraph } from '../graphLayout'

describe('layoutGraph', () => {
  it('coloca pré-requisitos em colunas anteriores (maior caminho)', () => {
    const positions = layoutGraph(
      [{ slug: 'a' }, { slug: 'b' }, { slug: 'c' }, { slug: 'd' }],
      [
        { source: 'a', target: 'b' },
        { source: 'b', target: 'c' },
        { source: 'a', target: 'c' }, // atalho: c continua depois de b
        { source: 'a', target: 'd' },
      ],
    )
    const column = (slug: string) => positions.get(slug)!.x
    expect(column('a')).toBe(0)
    expect(column('b')).toBeGreaterThan(column('a'))
    expect(column('c')).toBeGreaterThan(column('b'))
    expect(column('d')).toBe(column('b'))
  })

  it('empilha nós da mesma coluna sem sobreposição', () => {
    const positions = layoutGraph([{ slug: 'a' }, { slug: 'b' }, { slug: 'c' }], [])
    const ys = ['a', 'b', 'c'].map((s) => positions.get(s)!.y)
    expect(new Set(ys).size).toBe(3)
    expect(ys[1]! - ys[0]!).toBeGreaterThanOrEqual(NODE_HEIGHT)
    expect(positions.get('a')!.x).toBe(positions.get('b')!.x)
  })

  it('ignora arestas para nós fora do conjunto e ciclos', () => {
    const positions = layoutGraph(
      [{ slug: 'a' }, { slug: 'b' }],
      [
        { source: 'x', target: 'a' },
        { source: 'a', target: 'b' },
        { source: 'b', target: 'a' },
      ],
    )
    expect(positions.size).toBe(2)
    expect(positions.get('a')!.x).toBeGreaterThanOrEqual(0)
  })

  it('usa a largura do nó no espaçamento horizontal', () => {
    const positions = layoutGraph([{ slug: 'a' }, { slug: 'b' }], [{ source: 'a', target: 'b' }])
    expect(positions.get('b')!.x - positions.get('a')!.x).toBeGreaterThan(NODE_WIDTH)
  })
})
