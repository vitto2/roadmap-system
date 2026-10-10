import { z } from 'zod'
export const CAREER_LEVELS = ['beginner', 'junior', 'mid', 'senior'] as const

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'use kebab-case sem acentos')

export const trackSeedSchema = z.object({
  slug,
  title: z.string().min(1),
  description: z.string().min(1),
  required: z.boolean().default(true),
})

export const topicSeedSchema = z.object({
  slug,
  title: z.string().min(1),
  description: z.string().min(1),
  level: z.enum(CAREER_LEVELS),
  difficulty: z.number().int().min(1).max(5),
  prerequisites: z.array(slug).default([]),
  resources: z.array(z.object({ name: z.string().min(1), url: z.url().optional() })).default([]),
  checklist: z
    .array(z.object({ key: slug, text: z.string().min(1) }))
    .min(3)
    .max(6),
})

export const projectSeedSchema = z.object({
  slug,
  title: z.string().min(1),
  description: z.string().min(1),
  level: z.enum(CAREER_LEVELS),
  difficulty: z.number().int().min(1).max(5),
  topics: z.array(slug).default([]),
  milestones: z
    .array(
      z.object({
        key: slug,
        title: z.string().min(1),
        acceptanceCriteria: z.array(z.string().min(1)).min(1),
        xp: z.number().int().min(15).max(60),
      }),
    )
    .min(3)
    .max(8),
})

export type TrackSeed = z.infer<typeof trackSeedSchema>
export type TopicSeed = z.infer<typeof topicSeedSchema>
export type ProjectSeed = z.infer<typeof projectSeedSchema>

export const tracksFileSchema = z.array(trackSeedSchema)
export const topicsFileSchema = z.array(topicSeedSchema)
export const projectsFileSchema = z.array(projectSeedSchema)
/** Pré-requisitos extras (entre trilhas): { "slug-do-topico": ["slug-do-prerequisito"] } */
export const crossPrerequisitesSchema = z.record(slug, z.array(slug))
