export const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0)

export const isDefined = <T>(value: T | undefined | null): value is T =>
  value !== undefined && value !== null

export const percentOf = (done: number, total: number): number =>
  total === 0 ? 0 : Math.floor((done / total) * 100)

export function groupBy<T, K>(items: readonly T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>()
  for (const item of items) {
    const k = key(item)
    const list = map.get(k)
    if (list) list.push(item)
    else map.set(k, [item])
  }
  return map
}
