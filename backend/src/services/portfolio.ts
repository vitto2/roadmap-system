import type { AppContext } from '../context'
import { getProjectDetail, loadProjectStates } from './projects'
import { getSettings } from './settings'
import { computeXp } from './xp'

const levelLabels = {
  beginner: 'Iniciante',
  junior: 'Júnior',
  mid: 'Pleno',
  senior: 'Sênior',
} as const

function formatDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso))
}

/** Portfólio em markdown com os projetos concluídos (todas as etapas ativas finalizadas). */
export function renderPortfolio(ctx: AppContext): string {
  const { timezone } = getSettings(ctx)
  const finished = loadProjectStates(ctx).filter((p) => p.finished)
  const lines: string[] = [
    '# Portfólio de projetos',
    '',
    `> Gerado em ${formatDate(ctx.now().toISOString(), timezone)} pelo Trilha Sênior · ` +
      `${finished.length} ${finished.length === 1 ? 'projeto concluído' : 'projetos concluídos'} · ` +
      `${computeXp(ctx).total} XP`,
    '',
  ]

  if (finished.length === 0) {
    lines.push(
      'Nenhum projeto concluído ainda. Finalize todas as etapas de um projeto para vê-lo aqui.',
      '',
    )
    return lines.join('\n')
  }

  for (const state of finished) {
    const detail = getProjectDetail(ctx, state.slug)
    const completedDates = detail.milestones
      .map((m) => m.completedAt)
      .filter((d): d is string => d !== null)
    const lastDone = completedDates.sort().at(-1)

    lines.push(`## ${detail.title}`, '')
    lines.push(
      `**Nível:** ${levelLabels[detail.careerLevel]} · **Dificuldade:** ${detail.difficulty}/5` +
        (lastDone ? ` · **Concluído em:** ${formatDate(lastDone, timezone)}` : ''),
      '',
      detail.description,
      '',
    )

    const links = [
      detail.repositoryUrl ? `- Repositório: <${detail.repositoryUrl}>` : null,
      detail.deployUrl ? `- Deploy: <${detail.deployUrl}>` : null,
    ].filter((l): l is string => l !== null)
    if (links.length > 0) lines.push(...links, '')

    if (detail.topics.length > 0) {
      lines.push(`**Tópicos relacionados:** ${detail.topics.map((t) => t.title).join(', ')}`, '')
    }

    lines.push('### Etapas', '')
    detail.milestones.forEach((m, index) => {
      lines.push(`${index + 1}. **${m.title}** (${m.xp} XP)`)
      for (const criterion of m.acceptanceCriteria) lines.push(`   - ${criterion}`)
    })
    lines.push('')
  }

  return lines.join('\n')
}
