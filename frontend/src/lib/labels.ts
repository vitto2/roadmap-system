import type {
  CareerLevel,
  MilestoneStatus,
  ProjectStatus,
  ReviewScope,
  TopicStatus,
} from '@/api/types'

export const CAREER_LEVELS: readonly CareerLevel[] = ['beginner', 'junior', 'mid', 'senior']

export const careerLabels: Record<CareerLevel, string> = {
  beginner: 'Iniciante',
  junior: 'Júnior',
  mid: 'Pleno',
  senior: 'Sênior',
}

export const topicStatusLabels: Record<TopicStatus, string> = {
  not_started: 'Não iniciado',
  studying: 'Estudando',
  completed: 'Concluído',
}

export const TOPIC_STATUSES: readonly TopicStatus[] = ['not_started', 'studying', 'completed']

export const milestoneStatusLabels: Record<MilestoneStatus, string> = {
  pending: 'Pendente',
  in_progress: 'Em andamento',
  completed: 'Concluída',
}

export const projectStatusLabels: Record<ProjectStatus, string> = {
  not_started: 'Não iniciado',
  in_progress: 'Em andamento',
  finished: 'Finalizado',
}

export const reviewScopeLabels: Record<ReviewScope, string> = {
  today: 'Hoje',
  upcoming: 'Próximas',
  pending: 'Pendentes',
  completed: 'Concluídas',
  all: 'Todas',
}

/** Classes Tailwind (fundo + texto) por nível de carreira, com contraste AA nos dois temas. */
export const careerClasses: Record<CareerLevel, string> = {
  beginner: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200',
  junior: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  mid: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  senior: 'bg-fuchsia-100 text-fuchsia-900 dark:bg-fuchsia-950 dark:text-fuchsia-200',
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

/** Formata 'YYYY-MM-DD' (data de calendário) sem deslocar por fuso. */
export function formatCalendarDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  if (!year || !month || !day) return date
  return dateFormatter.format(new Date(year, month - 1, day))
}

/** Formata um instante ISO (UTC) na data local do navegador. */
export function formatInstant(iso: string): string {
  return dateFormatter.format(new Date(iso))
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value)
}
