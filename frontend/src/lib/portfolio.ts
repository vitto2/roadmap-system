import type { CareerLevel, ProjectDetail } from '@/api/types'

const levelLabels: Record<CareerLevel, string> = {
  beginner: 'Iniciante',
  junior: 'Júnior',
  mid: 'Pleno',
  senior: 'Sênior',
}

function formatDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso))
}

export interface PortfolioInput {
  /** Projetos finalizados (todas as etapas ativas concluídas), em detalhe. */
  projects: ProjectDetail[]
  /** XP total do perfil (valor do servidor). */
  totalXp: number
  timeZone: string
  generatedAt: Date
}

/** Portfólio em markdown com os projetos concluídos (para colar no GitHub ou no currículo). */
export function buildPortfolioMarkdown({
  projects,
  totalXp,
  timeZone,
  generatedAt,
}: PortfolioInput): string {
  const lines: string[] = [
    '# Portfólio de projetos',
    '',
    `> Gerado em ${formatDate(generatedAt.toISOString(), timeZone)} pelo Trilha Sênior · ` +
      `${projects.length} ${projects.length === 1 ? 'projeto concluído' : 'projetos concluídos'} · ` +
      `${totalXp} XP`,
    '',
  ]

  if (projects.length === 0) {
    lines.push(
      'Nenhum projeto concluído ainda. Finalize todas as etapas de um projeto para vê-lo aqui.',
      '',
    )
    return lines.join('\n')
  }

  for (const project of projects) {
    const completedDates = project.milestones
      .map((m) => m.completedAt)
      .filter((d): d is string => d !== null)
      .sort()
    const lastDone = completedDates[completedDates.length - 1]

    lines.push(`## ${project.title}`, '')
    lines.push(
      `**Nível:** ${levelLabels[project.careerLevel]} · **Dificuldade:** ${project.difficulty}/5` +
        (lastDone ? ` · **Concluído em:** ${formatDate(lastDone, timeZone)}` : ''),
      '',
      project.description,
      '',
    )

    const links = [
      project.repositoryUrl ? `- Repositório: <${project.repositoryUrl}>` : null,
      project.deployUrl ? `- Deploy: <${project.deployUrl}>` : null,
    ].filter((l): l is string => l !== null)
    if (links.length > 0) lines.push(...links, '')

    if (project.topics.length > 0) {
      lines.push(`**Tópicos relacionados:** ${project.topics.map((t) => t.title).join(', ')}`, '')
    }

    lines.push('### Etapas', '')
    project.milestones.forEach((m, index) => {
      lines.push(`${index + 1}. **${m.title}** (${m.xp} XP)`)
      for (const criterion of m.acceptanceCriteria) lines.push(`   - ${criterion}`)
    })
    lines.push('')
  }

  return lines.join('\n')
}
