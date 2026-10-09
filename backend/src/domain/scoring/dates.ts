/** Utilitários de data "de calendário" (YYYY-MM-DD) sem dependências. */

const DAY_MS = 86_400_000

/** Data local (YYYY-MM-DD) de um instante, no fuso informado. */
export function localDate(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant)
  return parts
}

function toUtcMs(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y!, m! - 1, d!)
}

export function addDays(date: string, days: number): string {
  return new Date(toUtcMs(date) + days * DAY_MS).toISOString().slice(0, 10)
}

export function diffDays(a: string, b: string): number {
  return Math.round((toUtcMs(a) - toUtcMs(b)) / DAY_MS)
}

/** Segunda-feira da semana que contém a data. */
export function startOfWeek(date: string): string {
  const weekday = new Date(toUtcMs(date)).getUTCDay() // 0 = domingo
  const offset = (weekday + 6) % 7
  return addDays(date, -offset)
}
