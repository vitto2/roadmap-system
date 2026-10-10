// Tipos espelhando o JSON devolvido pelas funções SQL (supabase/migrations): contrato testado em tools/tests/db/contract.test.ts.
// O front-end apenas EXIBE os valores calculados no servidor (funções SQL no Supabase); nunca recalcula XP.

export type CareerLevel = 'beginner' | 'junior' | 'mid' | 'senior'
export type TopicStatus = 'not_started' | 'studying' | 'completed'
export type MilestoneStatus = 'pending' | 'in_progress' | 'completed'
export type ProjectStatus = 'not_started' | 'in_progress' | 'finished'

/** Mutações devolvem o recurso atualizado + o perfil recalculado pelo servidor. */
export interface Mutation<T> {
  data: T
  profile: Profile
}

export interface Xp {
  total: number
  level: number
  xpIntoLevel: number
  xpForNextLevel: number
  progressPercent: number
  breakdown: { topics: number; milestones: number; projects: number; reviews: number }
}

export interface CareerProgress {
  level: 'junior' | 'mid' | 'senior'
  requiredPercent: number
  percent: number
  reached: boolean
}

export interface Profile {
  xp: Xp
  career: { level: CareerLevel; next: CareerProgress | null; progress: CareerProgress[] }
  overall: { completedTopics: number; totalTopics: number; percent: number }
  streak: {
    current: number
    longest: number
    studiedToday: boolean
    weeklySessions: number
    weeklyGoal: number
  }
  timezone: string
}

export interface Settings {
  timezone: string
  weeklyGoal: number
}

export interface TopicRef {
  slug: string
  title: string
  status: TopicStatus
}

export interface TrackSummary {
  slug: string
  title: string
  description: string
  position: number
  required: boolean
  totalTopics: number
  completedTopics: number
  studyingTopics: number
  percent: number
  totalXp: number
  earnedXp: number
}

export interface TopicSummary {
  slug: string
  title: string
  description: string
  trackSlug: string
  trackTitle: string
  careerLevel: CareerLevel
  difficulty: number
  xp: number
  status: TopicStatus
  checklistTotal: number
  checklistChecked: number
  completedAt: string | null
  recommendedFirst: TopicRef[]
}

export interface ChecklistEntry {
  key: string
  text: string
  checked: boolean
}

export interface TopicReview {
  id: number
  intervalDays: number
  dueOn: string
  completedAt: string | null
}

export interface TopicDetail extends TopicSummary {
  checklist: ChecklistEntry[]
  resources: { name: string; url: string | null }[]
  prerequisites: TopicRef[]
  notes: string
  evidenceUrl: string | null
  startedAt: string | null
  masteredDirectly: boolean
  reviews: TopicReview[]
  projects: { slug: string; title: string }[]
}

export interface ProjectSummary {
  slug: string
  title: string
  description: string
  careerLevel: CareerLevel
  difficulty: number
  status: ProjectStatus
  milestonesTotal: number
  milestonesCompleted: number
  totalXp: number
  earnedXp: number
  repositoryUrl: string | null
  deployUrl: string | null
}

export interface MilestoneEntry {
  key: string
  title: string
  acceptanceCriteria: string[]
  xp: number
  status: MilestoneStatus
  completedAt: string | null
}

export interface ProjectDetail extends ProjectSummary {
  milestones: MilestoneEntry[]
  topics: TopicRef[]
  bonus: {
    finished: boolean
    finishXp: number
    repositoryXp: number
    deployXp: number
    total: number
  }
}

export interface Review {
  id: number
  topic: { slug: string; title: string }
  intervalDays: number
  dueOn: string
  completedAt: string | null
  xp: number
  overdue: boolean
}

export type ReviewScope = 'today' | 'upcoming' | 'pending' | 'completed' | 'all'

export interface StudySession {
  id: number
  studiedOn: string
  durationMinutes: number
  topic: { slug: string; title: string } | null
  note: string
}

export interface StudySessionInput {
  studiedOn?: string
  durationMinutes: number
  topicSlug?: string | null
  note?: string
}

export interface Paginated<T> {
  data: T[]
  meta: { page: number; perPage: number; total: number }
}

export interface Dashboard {
  profile: Profile
  radar: { trackSlug: string; title: string; percent: number }[]
  weeks: { weekStart: string; sessions: number; minutes: number }[]
  totals: { sessions: number; minutes: number }
}

export interface TopicFilters {
  track?: string
  level?: CareerLevel
  status?: TopicStatus
}

export interface GraphNode {
  slug: string
  title: string
  trackSlug: string
  trackTitle: string
  careerLevel: CareerLevel
  difficulty: number
  status: TopicStatus
  /** Todos os pré-requisitos concluídos. Bloqueado é só recomendação; nunca impede marcar. */
  unlocked: boolean
  blockedBy: string[]
}

export interface GraphEdge {
  source: string
  target: string
}

export interface TopicGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface ImportSummary {
  imported: {
    topics: number
    checklistItems: number
    reviews: number
    projects: number
    milestones: number
    sessions: number
  }
  skipped: string[]
}
