import type { AppContext } from '../context'
import { studySessions } from '../db/schema'
import {
  addDays,
  computeStreak,
  evaluateCareerLevel,
  levelForXp,
  sessionsInWeek,
  startOfWeek,
} from '../domain/scoring'
import type { DashboardDto, Profile } from '../dto'
import { percentOf, sum } from '../util'
import { getSettings, todayLocal } from './settings'
import { listTracks, loadTopicRows } from './topics'
import { computeXp } from './xp'

const WEEKS_IN_CHART = 12

export function buildProfile(ctx: AppContext): Profile {
  const settings = getSettings(ctx)
  const today = todayLocal(ctx)
  const xp = computeXp(ctx)
  const level = levelForXp(xp.total)

  const rows = loadTopicRows(ctx)
  const career = evaluateCareerLevel(
    rows
      .filter((r) => r.trackRequired)
      .map((r) => ({ careerLevel: r.careerLevel, completed: r.status === 'completed' })),
  )
  const completedTopics = rows.filter((r) => r.status === 'completed').length

  const dates = ctx.db
    .select({ studiedOn: studySessions.studiedOn })
    .from(studySessions)
    .all()
    .map((r) => r.studiedOn)
  const streak = computeStreak(dates, today)

  return {
    xp: {
      total: xp.total,
      ...level,
      breakdown: {
        topics: xp.topics,
        milestones: xp.milestones,
        projects: xp.projects,
        reviews: xp.reviews,
      },
    },
    career: { level: career.level, next: career.next, progress: career.progress },
    overall: {
      completedTopics,
      totalTopics: rows.length,
      percent: percentOf(completedTopics, rows.length),
    },
    streak: {
      current: streak.current,
      longest: streak.longest,
      studiedToday: streak.studiedToday,
      weeklySessions: sessionsInWeek(dates, today),
      weeklyGoal: settings.weeklyGoal,
    },
    timezone: settings.timezone,
  }
}

export function buildDashboard(ctx: AppContext): DashboardDto {
  const today = todayLocal(ctx)
  const sessions = ctx.db.select().from(studySessions).all()

  const thisWeek = startOfWeek(today)
  const weeks = Array.from({ length: WEEKS_IN_CHART }, (_, i) => {
    const weekStart = addDays(thisWeek, -7 * (WEEKS_IN_CHART - 1 - i))
    const weekEnd = addDays(weekStart, 6)
    const inWeek = sessions.filter((s) => s.studiedOn >= weekStart && s.studiedOn <= weekEnd)
    return {
      weekStart,
      sessions: inWeek.length,
      minutes: sum(inWeek.map((s) => s.durationMinutes)),
    }
  })

  return {
    profile: buildProfile(ctx),
    radar: listTracks(ctx).map((t) => ({ trackSlug: t.slug, title: t.title, percent: t.percent })),
    weeks,
    totals: { sessions: sessions.length, minutes: sum(sessions.map((s) => s.durationMinutes)) },
  }
}
