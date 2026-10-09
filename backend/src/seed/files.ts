import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import {
  crossPrerequisitesSchema,
  projectsFileSchema,
  topicsFileSchema,
  tracksFileSchema,
  type ProjectSeed,
  type TopicSeed,
  type TrackSeed,
} from './schema'

export const defaultSeedDir = join(process.cwd(), 'database', 'seed-data')

export interface SeedContent {
  tracks: TrackSeed[]
  /** Tópicos por slug de trilha, na ordem do arquivo. */
  topics: Map<string, TopicSeed[]>
  projects: ProjectSeed[]
  /** Pré-requisitos entre trilhas (arquivo cross-prerequisites.json). */
  crossPrerequisites: Record<string, string[]>
}

function readJson<T extends z.ZodType>(file: string, schema: T): z.infer<T> {
  const parsed = schema.safeParse(JSON.parse(readFileSync(file, 'utf8')))
  if (!parsed.success) {
    throw new Error(`Seed inválido em ${file}:\n${z.prettifyError(parsed.error)}`)
  }
  return parsed.data
}

/** Lê e valida (formato) os arquivos JSON de conteúdo. */
export function readSeedContent(dir: string = defaultSeedDir): SeedContent {
  const tracks = readJson(join(dir, 'tracks.json'), tracksFileSchema)

  const topics = new Map<string, TopicSeed[]>()
  for (const track of tracks) {
    const file = join(dir, 'topics', `${track.slug}.json`)
    topics.set(track.slug, existsSync(file) ? readJson(file, topicsFileSchema) : [])
  }

  const projectsDir = join(dir, 'projects')
  const projects = existsSync(projectsDir)
    ? readdirSync(projectsDir)
        .filter((f) => f.endsWith('.json'))
        .sort()
        .flatMap((f) => readJson(join(projectsDir, f), projectsFileSchema))
    : []

  const crossFile = join(dir, 'cross-prerequisites.json')
  const crossPrerequisites = existsSync(crossFile)
    ? readJson(crossFile, crossPrerequisitesSchema)
    : {}

  return { tracks, topics, projects, crossPrerequisites }
}

export function allPrerequisites(content: SeedContent, topic: TopicSeed): string[] {
  return [...new Set([...topic.prerequisites, ...(content.crossPrerequisites[topic.slug] ?? [])])]
}

/** Verificações de integridade entre arquivos. Retorna a lista de problemas. */
export function checkSeedIntegrity(content: SeedContent): string[] {
  const problems: string[] = []
  const bySlug = new Map<string, TopicSeed>()

  for (const topics of content.topics.values()) {
    for (const topic of topics) {
      if (bySlug.has(topic.slug)) problems.push(`Slug de tópico duplicado: ${topic.slug}`)
      bySlug.set(topic.slug, topic)
      const keys = new Set<string>()
      for (const item of topic.checklist) {
        if (keys.has(item.key))
          problems.push(`Checklist com key repetida em ${topic.slug}: ${item.key}`)
        keys.add(item.key)
      }
    }
  }

  const prerequisitesOf = new Map<string, string[]>()
  for (const topic of bySlug.values())
    prerequisitesOf.set(topic.slug, allPrerequisites(content, topic))
  for (const slug of Object.keys(content.crossPrerequisites)) {
    if (!bySlug.has(slug)) problems.push(`cross-prerequisites: tópico desconhecido "${slug}"`)
  }
  for (const [slug, prereqs] of prerequisitesOf) {
    for (const p of prereqs) {
      if (!bySlug.has(p)) problems.push(`${slug}: pré-requisito desconhecido "${p}"`)
      if (p === slug) problems.push(`${slug}: pré-requisito de si mesmo`)
    }
  }

  // ciclos (DFS)
  const state = new Map<string, 1 | 2>()
  const visit = (slug: string, path: string[]): void => {
    if (state.get(slug) === 2) return
    if (state.get(slug) === 1) {
      problems.push(`Ciclo de pré-requisitos: ${[...path, slug].join(' -> ')}`)
      return
    }
    state.set(slug, 1)
    for (const p of prerequisitesOf.get(slug) ?? []) if (bySlug.has(p)) visit(p, [...path, slug])
    state.set(slug, 2)
  }
  for (const slug of prerequisitesOf.keys()) visit(slug, [])

  const projectSlugs = new Set<string>()
  for (const project of content.projects) {
    if (projectSlugs.has(project.slug)) problems.push(`Slug de projeto duplicado: ${project.slug}`)
    projectSlugs.add(project.slug)
    for (const t of project.topics) {
      if (!bySlug.has(t)) problems.push(`Projeto ${project.slug}: tópico desconhecido "${t}"`)
    }
  }

  return problems
}

/** Regra editorial do roadmap: de 12 a 20 tópicos por trilha. */
export function checkTrackSizes(content: SeedContent, min = 12, max = 20): string[] {
  return [...content.topics.entries()]
    .filter(([, topics]) => topics.length < min || topics.length > max)
    .map(
      ([slug, topics]) =>
        `Trilha "${slug}" tem ${topics.length} tópicos (esperado ${min} a ${max})`,
    )
}
