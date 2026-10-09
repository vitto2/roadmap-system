import { z } from 'zod'
import { buildProfile } from '../services/profile'
import type { AppContext } from '../context'
import { profileSchema } from '../dto'

export const slugParams = z.object({ slug: z.string().min(1).max(120) })
export const idParams = z.object({ id: z.coerce.number().int().positive() })

/** URL http(s) opcional; string vazia e null viram null. */
export const optionalUrl = z
  .union([z.url({ protocol: /^https?$/ }).max(500), z.literal(''), z.null()])
  .transform((value) => (value === '' ? null : value))

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD.')

/** Envelope `{ data }` das respostas de leitura. */
export const dataOf = <T extends z.ZodType>(schema: T) => z.object({ data: schema })

/** Envelope das mutações: o recurso atualizado + o perfil recalculado pelo servidor (XP, nível...). */
export const mutationOf = <T extends z.ZodType>(schema: T) =>
  z.object({ data: schema, profile: profileSchema })

export function withProfile<T>(ctx: AppContext, data: T) {
  return { data, profile: buildProfile(ctx) }
}
