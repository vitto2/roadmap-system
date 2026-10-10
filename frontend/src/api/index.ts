import { rpc } from './client'
import type {
  Dashboard,
  ImportSummary,
  MilestoneStatus,
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
  TopicFilters,
  TopicGraph,
  TopicSummary,
  TrackSummary,
} from './types'

// Cada função chama uma função SQL do Supabase (schema public). Nomes de argumentos = parâmetros p_* do SQL.
// O servidor calcula tudo (XP, níveis, streak): o front-end só exibe.

export const api = {
  profile: () => rpc<Profile>('get_profile'),
  dashboard: () => rpc<Dashboard>('get_dashboard'),
  settings: () => rpc<Settings>('get_settings'),
  updateSettings: (patch: Partial<Settings>) =>
    rpc<Settings>('update_settings', { p_patch: patch }),

  tracks: () => rpc<TrackSummary[]>('list_tracks'),
  topics: (filters: TopicFilters = {}) =>
    rpc<TopicSummary[]>('list_topics', {
      p_track: filters.track ?? null,
      p_level: filters.level ?? null,
      p_status: filters.status ?? null,
    }),
  topic: (slug: string) => rpc<TopicDetail>('get_topic', { p_slug: slug }),
  updateTopicProgress: (
    slug: string,
    patch: { status?: 'not_started' | 'studying'; notes?: string; evidenceUrl?: string | null },
  ) => rpc<Mutation<TopicDetail>>('update_topic_progress', { p_slug: slug, p_patch: patch }),
  setChecklistItem: (slug: string, key: string, checked: boolean) =>
    rpc<Mutation<TopicDetail>>('set_checklist_item', {
      p_slug: slug,
      p_key: key,
      p_checked: checked,
    }),
  completeTopic: (slug: string) => rpc<Mutation<TopicDetail>>('complete_topic', { p_slug: slug }),
  masterTopic: (slug: string) => rpc<Mutation<TopicDetail>>('master_topic', { p_slug: slug }),
  reopenTopic: (slug: string) => rpc<Mutation<TopicDetail>>('reopen_topic', { p_slug: slug }),

  projects: () => rpc<ProjectSummary[]>('list_projects'),
  project: (slug: string) => rpc<ProjectDetail>('get_project', { p_slug: slug }),
  updateProjectLinks: (
    slug: string,
    links: { repositoryUrl?: string | null; deployUrl?: string | null },
  ) => rpc<Mutation<ProjectDetail>>('update_project_links', { p_slug: slug, p_patch: links }),
  setMilestoneStatus: (slug: string, key: string, status: MilestoneStatus) =>
    rpc<Mutation<ProjectDetail>>('set_milestone_status', {
      p_slug: slug,
      p_key: key,
      p_status: status,
    }),

  reviews: (scope: ReviewScope = 'today') => rpc<Review[]>('list_reviews', { p_scope: scope }),
  completeReview: (id: number) => rpc<Mutation<Review>>('complete_review', { p_id: id }),
  undoReview: (id: number) => rpc<Mutation<Review>>('undo_review', { p_id: id }),

  sessions: (page = 1, perPage = 20) =>
    rpc<Paginated<StudySession>>('list_study_sessions', { p_page: page, p_per_page: perPage }),
  createSession: (input: StudySessionInput) =>
    rpc<Mutation<StudySession>>('create_study_session', { p_input: input }),
  updateSession: (id: number, input: StudySessionInput) =>
    rpc<Mutation<StudySession>>('update_study_session', { p_id: id, p_input: input }),
  deleteSession: (id: number) => rpc<{ profile: Profile }>('delete_study_session', { p_id: id }),

  graph: () => rpc<TopicGraph>('get_graph'),

  exportBackup: () => rpc<unknown>('export_backup'),
  importBackup: (backup: unknown) =>
    rpc<Mutation<ImportSummary>>('import_backup', { p_backup: backup }),
}

export type Api = typeof api
