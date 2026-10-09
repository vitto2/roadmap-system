import { http } from './client'
import type {
  Dashboard,
  ImportSummary,
  Envelope,
  Mutation,
  Paginated,
  Profile,
  ProjectDetail,
  ProjectSummary,
  Review,
  ReviewScope,
  Settings,
  StudySession,
  StudySessionInput,
  TopicDetail,
  TopicGraph,
  TopicFilters,
  TopicSummary,
  TrackDetail,
  TrackSummary,
  MilestoneStatus,
} from './types'

const enc = encodeURIComponent

function query(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
  if (entries.length === 0) return ''
  return `?${entries.map(([k, v]) => `${k}=${enc(String(v))}`).join('&')}`
}

export const api = {
  authStatus: () => http.get<{ required: boolean }>('/auth/status'),
  login: (password: string) =>
    http.post<{ token: string; expiresAt: string }>('/auth/login', { password }),

  profile: () => http.get<Envelope<Profile>>('/profile').then((r) => r.data),
  dashboard: () => http.get<Envelope<Dashboard>>('/dashboard').then((r) => r.data),
  settings: () => http.get<Envelope<Settings>>('/settings').then((r) => r.data),
  updateSettings: (patch: Partial<Settings>) =>
    http.put<Envelope<Settings>>('/settings', patch).then((r) => r.data),

  tracks: () => http.get<Envelope<TrackSummary[]>>('/tracks').then((r) => r.data),
  track: (slug: string) =>
    http.get<Envelope<TrackDetail>>(`/tracks/${enc(slug)}`).then((r) => r.data),
  topics: (filters: TopicFilters = {}) =>
    http.get<Envelope<TopicSummary[]>>(`/topics${query({ ...filters })}`).then((r) => r.data),
  topic: (slug: string) =>
    http.get<Envelope<TopicDetail>>(`/topics/${enc(slug)}`).then((r) => r.data),
  updateTopicProgress: (
    slug: string,
    patch: { status?: 'not_started' | 'studying'; notes?: string; evidenceUrl?: string | null },
  ) => http.patch<Mutation<TopicDetail>>(`/topics/${enc(slug)}/progress`, patch),
  setChecklistItem: (slug: string, key: string, checked: boolean) =>
    http.put<Mutation<TopicDetail>>(`/topics/${enc(slug)}/checklist/${enc(key)}`, { checked }),
  completeTopic: (slug: string) =>
    http.post<Mutation<TopicDetail>>(`/topics/${enc(slug)}/complete`),
  masterTopic: (slug: string) => http.post<Mutation<TopicDetail>>(`/topics/${enc(slug)}/master`),
  reopenTopic: (slug: string) => http.post<Mutation<TopicDetail>>(`/topics/${enc(slug)}/reopen`),

  graph: () => http.get<Envelope<TopicGraph>>('/graph').then((r) => r.data),

  exportPortfolio: () => http.download('/export/portfolio.md'),
  exportBackup: () => http.download('/export/backup'),
  importBackup: (backup: unknown) => http.post<Mutation<ImportSummary>>('/import/backup', backup),

  projects: () => http.get<Envelope<ProjectSummary[]>>('/projects').then((r) => r.data),
  project: (slug: string) =>
    http.get<Envelope<ProjectDetail>>(`/projects/${enc(slug)}`).then((r) => r.data),
  updateProjectLinks: (
    slug: string,
    links: { repositoryUrl?: string | null; deployUrl?: string | null },
  ) => http.patch<Mutation<ProjectDetail>>(`/projects/${enc(slug)}/progress`, links),
  setMilestoneStatus: (slug: string, key: string, status: MilestoneStatus) =>
    http.put<Mutation<ProjectDetail>>(`/projects/${enc(slug)}/milestones/${enc(key)}`, { status }),

  reviews: (scope: ReviewScope = 'today') =>
    http.get<Envelope<Review[]>>(`/reviews${query({ scope })}`).then((r) => r.data),
  completeReview: (id: number) => http.post<Mutation<Review>>(`/reviews/${id}/complete`),
  undoReview: (id: number) => http.post<Mutation<Review>>(`/reviews/${id}/undo`),

  sessions: (page = 1, perPage = 20) =>
    http.get<Paginated<StudySession>>(`/study-sessions${query({ page, perPage })}`),
  createSession: (input: StudySessionInput) =>
    http.post<Mutation<StudySession>>('/study-sessions', input),
  updateSession: (id: number, input: StudySessionInput) =>
    http.put<Mutation<StudySession>>(`/study-sessions/${id}`, input),
  deleteSession: (id: number) => http.delete<{ profile: Profile }>(`/study-sessions/${id}`),
}

export type Api = typeof api
