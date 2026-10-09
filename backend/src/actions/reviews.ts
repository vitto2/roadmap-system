import { eq } from 'drizzle-orm'
import type { AppContext } from '../context'
import { reviews } from '../db/schema'
import { notFound } from '../errors'

function findReview(ctx: AppContext, id: number) {
  const review = ctx.db.select().from(reviews).where(eq(reviews.id, id)).get()
  if (!review) throw notFound('Revisão')
  return review
}

/** Conclui uma revisão (idempotente): rende 25% do XP do tópico. */
export function completeReview(ctx: AppContext, id: number): void {
  const review = findReview(ctx, id)
  if (review.completedAt !== null) return
  ctx.db
    .update(reviews)
    .set({ completedAt: ctx.now().toISOString() })
    .where(eq(reviews.id, id))
    .run()
}

/** Desfaz a conclusão da revisão (o XP correspondente deixa de contar). */
export function undoReview(ctx: AppContext, id: number): void {
  findReview(ctx, id)
  ctx.db.update(reviews).set({ completedAt: null }).where(eq(reviews.id, id)).run()
}
