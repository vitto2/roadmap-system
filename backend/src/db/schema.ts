import { sql } from 'drizzle-orm'
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
  unique,
  type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core'

// Convenções:
// - Timestamps em UTC, como texto ISO-8601 (portável entre SQLite/MySQL/PostgreSQL).
// - Datas "de calendário" (due_on, studied_on) são 'YYYY-MM-DD' no fuso configurado.
// - Conteúdo (seed) e progresso ficam em tabelas separadas, ligados por id.
// - Itens de conteúdo nunca são apagados: ganham archived_at.

const createdAt = () =>
  text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`)

// ───────────── Conteúdo ─────────────

export const tracks = sqliteTable('tracks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  position: integer('position').notNull().default(0),
  required: integer('required', { mode: 'boolean' }).notNull().default(true),
  archivedAt: text('archived_at'),
  createdAt: createdAt(),
})

export const topics = sqliteTable('topics', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  trackId: integer('track_id')
    .notNull()
    .references(() => tracks.id),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  careerLevel: text('career_level').notNull(),
  difficulty: integer('difficulty').notNull(),
  position: integer('position').notNull().default(0),
  archivedAt: text('archived_at'),
  createdAt: createdAt(),
})

export const topicPrerequisites = sqliteTable(
  'topic_prerequisites',
  {
    topicId: integer('topic_id')
      .notNull()
      .references(() => topics.id),
    prerequisiteId: integer('prerequisite_id')
      .notNull()
      .references(() => topics.id),
  },
  (t) => [primaryKey({ columns: [t.topicId, t.prerequisiteId] })],
)

export const topicResources = sqliteTable('topic_resources', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  topicId: integer('topic_id')
    .notNull()
    .references(() => topics.id),
  name: text('name').notNull(),
  url: text('url'),
  position: integer('position').notNull().default(0),
})

export const checklistItems = sqliteTable(
  'topic_checklist_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    topicId: integer('topic_id')
      .notNull()
      .references(() => topics.id),
    key: text('key').notNull(),
    text: text('text').notNull(),
    position: integer('position').notNull().default(0),
    archivedAt: text('archived_at'),
  },
  (t) => [unique('topic_checklist_items_topic_key').on(t.topicId, t.key)],
)

export const projects = sqliteTable('projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  careerLevel: text('career_level').notNull(),
  difficulty: integer('difficulty').notNull(),
  position: integer('position').notNull().default(0),
  archivedAt: text('archived_at'),
  createdAt: createdAt(),
})

export const projectTopics = sqliteTable(
  'project_topic',
  {
    projectId: integer('project_id')
      .notNull()
      .references(() => projects.id),
    topicId: integer('topic_id')
      .notNull()
      .references(() => topics.id),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.topicId] })],
)

export const milestones = sqliteTable(
  'milestones',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    projectId: integer('project_id')
      .notNull()
      .references(() => projects.id),
    key: text('key').notNull(),
    title: text('title').notNull(),
    /** Lista de critérios de aceite serializada como JSON (texto, portável). */
    acceptanceCriteria: text('acceptance_criteria').notNull().default('[]'),
    xp: integer('xp').notNull(),
    position: integer('position').notNull().default(0),
    archivedAt: text('archived_at'),
  },
  (t) => [unique('milestones_project_key').on(t.projectId, t.key)],
)

// ───────────── Progresso ─────────────

export const topicProgress = sqliteTable('topic_progress', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  topicId: integer('topic_id')
    .notNull()
    .unique()
    .references(() => topics.id),
  status: text('status').notNull().default('not_started'),
  notes: text('notes').notNull().default(''),
  evidenceUrl: text('evidence_url'),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
  masteredDirectly: integer('mastered_directly', { mode: 'boolean' }).notNull().default(false),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
})

export const checklistProgress = sqliteTable('checklist_progress', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  checklistItemId: integer('checklist_item_id')
    .notNull()
    .unique()
    .references(() => checklistItems.id),
  checkedAt: text('checked_at').notNull(),
})

export const projectProgress = sqliteTable('project_progress', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id')
    .notNull()
    .unique()
    .references(() => projects.id),
  repositoryUrl: text('repository_url'),
  deployUrl: text('deploy_url'),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
})

export const milestoneProgress = sqliteTable('milestone_progress', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  milestoneId: integer('milestone_id')
    .notNull()
    .unique()
    .references(() => milestones.id),
  status: text('status').notNull().default('pending'),
  completedAt: text('completed_at'),
})

export const reviews = sqliteTable('reviews', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  topicId: integer('topic_id')
    .notNull()
    .references(() => topics.id),
  intervalDays: integer('interval_days').notNull(),
  dueOn: text('due_on').notNull(),
  completedAt: text('completed_at'),
  createdAt: createdAt(),
})

export const studySessions = sqliteTable('study_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studiedOn: text('studied_on').notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  topicId: integer('topic_id').references((): AnySQLiteColumn => topics.id, {
    onDelete: 'set null',
  }),
  note: text('note').notNull().default(''),
  createdAt: createdAt(),
})

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})
