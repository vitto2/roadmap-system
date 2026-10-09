import { eq } from 'drizzle-orm'
import type { AppContext } from '../context'
import { settings } from '../db/schema'
import { localDate } from '../domain/scoring'

export interface AppSettings {
  timezone: string
  weeklyGoal: number
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone })
    return true
  } catch {
    return false
  }
}

export function getSettings(ctx: AppContext): AppSettings {
  const rows = ctx.db.select().from(settings).all()
  const map = new Map(rows.map((r) => [r.key, r.value]))
  const weeklyGoal = Number(map.get('weekly_goal'))
  return {
    timezone: map.get('timezone') ?? ctx.config.timezone,
    weeklyGoal: Number.isInteger(weeklyGoal) && weeklyGoal > 0 ? weeklyGoal : ctx.config.weeklyGoal,
  }
}

export function updateSettings(ctx: AppContext, patch: Partial<AppSettings>): AppSettings {
  const entries: [string, string][] = []
  if (patch.timezone !== undefined) entries.push(['timezone', patch.timezone])
  if (patch.weeklyGoal !== undefined) entries.push(['weekly_goal', String(patch.weeklyGoal)])
  for (const [key, value] of entries) {
    ctx.db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } })
      .run()
  }
  return getSettings(ctx)
}

/** Data de hoje (YYYY-MM-DD) no fuso configurado. */
export function todayLocal(ctx: AppContext): string {
  return localDate(ctx.now(), getSettings(ctx).timezone)
}

/** Remove uma chave (usado pelo restore). */
export function clearSetting(ctx: AppContext, key: string): void {
  ctx.db.delete(settings).where(eq(settings.key, key)).run()
}
