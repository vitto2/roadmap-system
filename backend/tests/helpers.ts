/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FastifyInstance } from 'fastify'
import { config } from '../src/config'
import type { AppContext } from '../src/context'
import { createDb, runMigrations } from '../src/db/client'
import { buildApp } from '../src/http/app'
import type { SeedContent } from '../src/seed/files'
import { seedDatabase } from '../src/seed/loader'
import type { TopicSeed } from '../src/seed/schema'

export type Json = any

const checklist = (prefix: string): TopicSeed['checklist'] => [
  { key: `${prefix}-1`, text: `Consigo explicar ${prefix} (1).` },
  { key: `${prefix}-2`, text: `Consigo explicar ${prefix} (2).` },
  { key: `${prefix}-3`, text: `Consigo explicar ${prefix} (3).` },
]

const topic = (
  slug: string,
  level: TopicSeed['level'],
  difficulty: number,
  prerequisites: string[] = [],
): TopicSeed => ({
  slug,
  title: `Tópico ${slug}`,
  description: `Descrição de ${slug}.`,
  level,
  difficulty,
  prerequisites,
  resources: [
    { name: 'Documentação oficial', url: 'https://example.com/docs' },
    { name: 'Livro X' },
  ],
  checklist: checklist(slug),
})

/** Conteúdo mínimo para os testes: 2 trilhas (1 obrigatória), 5 tópicos e 1 projeto. */
export function sampleContent(): SeedContent {
  return {
    tracks: [
      { slug: 'core', title: 'Core', description: 'Trilha obrigatória.', required: true },
      { slug: 'extra', title: 'Extra', description: 'Trilha opcional.', required: false },
    ],
    topics: new Map([
      [
        'core',
        [
          topic('a', 'beginner', 1),
          topic('b', 'junior', 3, ['a']),
          topic('c', 'mid', 4, ['b']),
          topic('d', 'senior', 5),
        ],
      ],
      ['extra', [topic('e', 'beginner', 2)]],
    ]),
    projects: [
      {
        slug: 'p1',
        title: 'Projeto 1',
        description: 'Projeto de teste.',
        level: 'junior',
        difficulty: 2,
        topics: ['b'],
        milestones: [
          { key: 'm1', title: 'Etapa 1', acceptanceCriteria: ['Critério 1'], xp: 20 },
          { key: 'm2', title: 'Etapa 2', acceptanceCriteria: ['Critério 2'], xp: 30 },
          { key: 'm3', title: 'Etapa 3', acceptanceCriteria: ['Critério 3'], xp: 40 },
        ],
      },
    ],
    crossPrerequisites: {},
  }
}

export interface TestEnv {
  app: FastifyInstance
  ctx: AppContext
  /** Move o "relógio" da aplicação. */
  setNow: (iso: string) => void
  call: (
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    payload?: unknown,
  ) => Promise<{ status: number; body: Json }>
  close: () => Promise<void>
}

export function createTestEnv(
  options: { now?: string; content?: SeedContent; seed?: boolean; timezone?: string } = {},
): TestEnv {
  const handle = createDb(':memory:')
  runMigrations(handle.db)
  let current = new Date(options.now ?? '2026-03-10T15:00:00Z')
  const ctx: AppContext = {
    db: handle.db,
    config: { ...config, timezone: options.timezone ?? 'America/Sao_Paulo', weeklyGoal: 5 },
    now: () => current,
  }
  if (options.seed !== false) seedDatabase(handle.db, options.content ?? sampleContent(), current)
  const app = buildApp(ctx)

  return {
    app,
    ctx,
    setNow: (iso) => {
      current = new Date(iso)
    },
    call: async (method, url, payload) => {
      const res = await app.inject({ method, url: `/api/v1${url}`, payload: payload as object })
      return { status: res.statusCode, body: res.body ? res.json() : null }
    },
    close: async () => {
      await app.close()
      handle.close()
    },
  }
}
