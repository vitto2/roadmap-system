import { z } from 'zod'
import { CAREER_LEVELS } from './domain/scoring/career'
import { MILESTONE_STATUSES, TOPIC_STATUSES } from './domain/status'

// Contratos (API Resources) da API. O front-end espelha estes tipos em src/api/types.ts.

export const careerLevelSchema = z.enum(CAREER_LEVELS)
export const topicStatusSchema = z.enum(TOPIC_STATUSES)
export const milestoneStatusSchema = z.enum(MILESTONE_STATUSES)

export const errorSchema = z.object({
  message: z.string(),
  code: z.string(),
  errors: z.record(z.string(), z.array(z.string())).optional(),
})

// ── Perfil / gamificação ──

export const xpSchema = z.object({
  total: z.number().int(),
  level: z.number().int(),
  xpIntoLevel: z.number().int(),
  xpForNextLevel: z.number().int(),
  progressPercent: z.number().int(),
  breakdown: z.object({
    topics: z.number().int(),
    milestones: z.number().int(),
    projects: z.number().int(),
    reviews: z.number().int(),
  }),
})

export const careerProgressSchema = z.object({
  level: z.enum(['junior', 'mid', 'senior']),
  requiredPercent: z.number().int(),
  percent: z.number().int(),
  reached: z.boolean(),
})

export const profileSchema = z.object({
  xp: xpSchema,
  career: z.object({
    level: careerLevelSchema,
    next: careerProgressSchema.nullable(),
    progress: z.array(careerProgressSchema),
  }),
  overall: z.object({
    completedTopics: z.number().int(),
    totalTopics: z.number().int(),
    percent: z.number().int(),
  }),
  streak: z.object({
    current: z.number().int(),
    longest: z.number().int(),
    studiedToday: z.boolean(),
    weeklySessions: z.number().int(),
    weeklyGoal: z.number().int(),
  }),
  timezone: z.string(),
})

export const settingsSchema = z.object({
  timezone: z.string(),
  weeklyGoal: z.number().int(),
})

// ── Trilhas e tópicos ──

export const topicRefSchema = z.object({
  slug: z.string(),
  title: z.string(),
  status: topicStatusSchema,
})

export const trackSummarySchema = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  position: z.number().int(),
  required: z.boolean(),
  totalTopics: z.number().int(),
  completedTopics: z.number().int(),
  studyingTopics: z.number().int(),
  percent: z.number().int(),
  totalXp: z.number().int(),
  earnedXp: z.number().int(),
})

export const topicSummarySchema = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  trackSlug: z.string(),
  trackTitle: z.string(),
  careerLevel: careerLevelSchema,
  difficulty: z.number().int(),
  xp: z.number().int(),
  status: topicStatusSchema,
  checklistTotal: z.number().int(),
  checklistChecked: z.number().int(),
  completedAt: z.string().nullable(),
  /** Pré-requisitos ainda não concluídos: "recomendado estudar antes" (não bloqueia). */
  recommendedFirst: z.array(topicRefSchema),
})

export const reviewSchema = z.object({
  id: z.number().int(),
  topic: z.object({ slug: z.string(), title: z.string() }),
  intervalDays: z.number().int(),
  dueOn: z.string(),
  completedAt: z.string().nullable(),
  xp: z.number().int(),
  overdue: z.boolean(),
})

export const topicDetailSchema = topicSummarySchema.extend({
  checklist: z.array(z.object({ key: z.string(), text: z.string(), checked: z.boolean() })),
  resources: z.array(z.object({ name: z.string(), url: z.string().nullable() })),
  prerequisites: z.array(topicRefSchema),
  notes: z.string(),
  evidenceUrl: z.string().nullable(),
  startedAt: z.string().nullable(),
  masteredDirectly: z.boolean(),
  reviews: z.array(
    z.object({
      id: z.number().int(),
      intervalDays: z.number().int(),
      dueOn: z.string(),
      completedAt: z.string().nullable(),
    }),
  ),
  projects: z.array(z.object({ slug: z.string(), title: z.string() })),
})

export const trackDetailSchema = trackSummarySchema.extend({
  topics: z.array(topicSummarySchema),
})

// ── Projetos ──

export const projectStatusSchema = z.enum(['not_started', 'in_progress', 'finished'])

export const projectSummarySchema = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  careerLevel: careerLevelSchema,
  difficulty: z.number().int(),
  status: projectStatusSchema,
  milestonesTotal: z.number().int(),
  milestonesCompleted: z.number().int(),
  totalXp: z.number().int(),
  earnedXp: z.number().int(),
  repositoryUrl: z.string().nullable(),
  deployUrl: z.string().nullable(),
})

export const projectDetailSchema = projectSummarySchema.extend({
  milestones: z.array(
    z.object({
      key: z.string(),
      title: z.string(),
      acceptanceCriteria: z.array(z.string()),
      xp: z.number().int(),
      status: milestoneStatusSchema,
      completedAt: z.string().nullable(),
    }),
  ),
  topics: z.array(topicRefSchema),
  bonus: z.object({
    finished: z.boolean(),
    finishXp: z.number().int(),
    repositoryXp: z.number().int(),
    deployXp: z.number().int(),
    total: z.number().int(),
  }),
})

// ── Diário e dashboard ──

export const studySessionSchema = z.object({
  id: z.number().int(),
  studiedOn: z.string(),
  durationMinutes: z.number().int(),
  topic: z.object({ slug: z.string(), title: z.string() }).nullable(),
  note: z.string(),
})

export const dashboardSchema = z.object({
  profile: profileSchema,
  radar: z.array(
    z.object({
      trackSlug: z.string(),
      title: z.string(),
      percent: z.number().int(),
    }),
  ),
  weeks: z.array(
    z.object({
      weekStart: z.string(),
      sessions: z.number().int(),
      minutes: z.number().int(),
    }),
  ),
  totals: z.object({ sessions: z.number().int(), minutes: z.number().int() }),
})

export type ErrorBody = z.infer<typeof errorSchema>
export type Profile = z.infer<typeof profileSchema>
export type TopicRef = z.infer<typeof topicRefSchema>
export type TrackSummary = z.infer<typeof trackSummarySchema>
export type TopicSummary = z.infer<typeof topicSummarySchema>
export type TopicDetail = z.infer<typeof topicDetailSchema>
export type TrackDetail = z.infer<typeof trackDetailSchema>
export type ProjectSummary = z.infer<typeof projectSummarySchema>
export type ProjectDetail = z.infer<typeof projectDetailSchema>
export type ReviewDto = z.infer<typeof reviewSchema>
export type StudySessionDto = z.infer<typeof studySessionSchema>
export type DashboardDto = z.infer<typeof dashboardSchema>
