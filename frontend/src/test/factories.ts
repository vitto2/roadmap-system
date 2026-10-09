import type { Profile, TopicDetail, TopicSummary, TrackSummary } from '@/api/types'

export function makeProfile(overrides: Partial<Profile['xp']> = {}): Profile {
  return {
    xp: {
      total: 0,
      level: 1,
      xpIntoLevel: 0,
      xpForNextLevel: 100,
      progressPercent: 0,
      breakdown: { topics: 0, milestones: 0, projects: 0, reviews: 0 },
      ...overrides,
    },
    career: { level: 'beginner', next: null, progress: [] },
    overall: { completedTopics: 0, totalTopics: 10, percent: 0 },
    streak: { current: 0, longest: 0, studiedToday: false, weeklySessions: 0, weeklyGoal: 5 },
    timezone: 'America/Sao_Paulo',
  }
}

export function makeTopicSummary(overrides: Partial<TopicSummary> = {}): TopicSummary {
  return {
    slug: 'topico-a',
    title: 'Tópico A',
    description: 'Descrição',
    trackSlug: 'trilha-a',
    trackTitle: 'Trilha A',
    careerLevel: 'junior',
    difficulty: 3,
    xp: 30,
    status: 'not_started',
    checklistTotal: 3,
    checklistChecked: 0,
    completedAt: null,
    recommendedFirst: [],
    ...overrides,
  }
}

export function makeTopicDetail(overrides: Partial<TopicDetail> = {}): TopicDetail {
  return {
    ...makeTopicSummary(),
    checklist: [
      { key: 'um', text: 'Consigo explicar o primeiro conceito.', checked: false },
      { key: 'dois', text: 'Consigo explicar o segundo conceito.', checked: false },
      { key: 'tres', text: 'Consigo explicar o terceiro conceito.', checked: false },
    ],
    resources: [
      { name: 'Documentação', url: 'https://example.com/docs' },
      { name: 'Livro X', url: null },
    ],
    prerequisites: [],
    notes: '',
    evidenceUrl: null,
    startedAt: null,
    masteredDirectly: false,
    reviews: [],
    projects: [],
    ...overrides,
  }
}

export function makeTrack(overrides: Partial<TrackSummary> = {}): TrackSummary {
  return {
    slug: 'trilha-a',
    title: 'Trilha A',
    description: 'Descrição da trilha',
    position: 0,
    required: true,
    totalTopics: 2,
    completedTopics: 0,
    studyingTopics: 0,
    percent: 0,
    totalXp: 60,
    earnedXp: 0,
    ...overrides,
  }
}
