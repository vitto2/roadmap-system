export interface LayoutNode {
  slug: string
}

export interface LayoutEdge {
  source: string
  target: string
}

export interface Position {
  x: number
  y: number
}

export const NODE_WIDTH = 220
export const NODE_HEIGHT = 58
const H_GAP = 90
const V_GAP = 22

/**
 * Layout em camadas (esquerda → direita): a coluna de um tópico é o tamanho do maior
 * caminho de pré-requisitos até ele. Dentro da coluna mantém a ordem original dos nós.
 * Arestas que apontam para nós fora do conjunto são ignoradas.
 */
export function layoutGraph(
  nodes: readonly LayoutNode[],
  edges: readonly LayoutEdge[],
): Map<string, Position> {
  const known = new Set(nodes.map((n) => n.slug))
  const incoming = new Map<string, string[]>()
  for (const edge of edges) {
    if (!known.has(edge.source) || !known.has(edge.target) || edge.source === edge.target) continue
    incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge.source])
  }

  const depth = new Map<string, number>()
  const visiting = new Set<string>()
  const depthOf = (slug: string): number => {
    const cached = depth.get(slug)
    if (cached !== undefined) return cached
    if (visiting.has(slug)) return 0 // proteção contra ciclos
    visiting.add(slug)
    const parents = incoming.get(slug) ?? []
    const value = parents.length === 0 ? 0 : 1 + Math.max(...parents.map(depthOf))
    visiting.delete(slug)
    depth.set(slug, value)
    return value
  }

  const rowInColumn = new Map<number, number>()
  const positions = new Map<string, Position>()
  for (const node of nodes) {
    const column = depthOf(node.slug)
    const row = rowInColumn.get(column) ?? 0
    rowInColumn.set(column, row + 1)
    positions.set(node.slug, {
      x: column * (NODE_WIDTH + H_GAP),
      y: row * (NODE_HEIGHT + V_GAP),
    })
  }
  return positions
}
