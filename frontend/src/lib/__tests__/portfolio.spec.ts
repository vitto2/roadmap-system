import { describe, expect, it } from 'vitest'
import type { ProjectDetail } from '@/api/types'
import { buildPortfolioMarkdown } from '../portfolio'

const project: ProjectDetail = {
  slug: 'p1',
  title: 'Projeto 1',
  description: 'Projeto de teste.',
  careerLevel: 'junior',
  difficulty: 2,
  status: 'finished',
  milestonesTotal: 2,
  milestonesCompleted: 2,
  totalXp: 250,
  earnedXp: 250,
  repositoryUrl: 'https://github.com/vitto2/p1',
  deployUrl: null,
  milestones: [
    {
      key: 'm1',
      title: 'Etapa 1',
      acceptanceCriteria: ['Critério 1', 'Critério 2'],
      xp: 20,
      status: 'completed',
      completedAt: '2026-03-05T12:00:00Z',
    },
    {
      key: 'm2',
      title: 'Etapa 2',
      acceptanceCriteria: ['Critério 3'],
      xp: 30,
      status: 'completed',
      completedAt: '2026-03-09T12:00:00Z',
    },
  ],
  topics: [{ slug: 'a', title: 'Tópico A', status: 'completed' }],
  bonus: { finished: true, finishXp: 100, repositoryXp: 50, deployXp: 0, total: 150 },
}

const base = {
  totalXp: 400,
  timeZone: 'America/Sao_Paulo',
  generatedAt: new Date('2026-03-10T15:00:00Z'),
}

describe('buildPortfolioMarkdown', () => {
  it('lista os projetos concluídos com links, tópicos e etapas', () => {
    const md = buildPortfolioMarkdown({ ...base, projects: [project] })
    expect(md).toContain('# Portfólio de projetos')
    expect(md).toContain('1 projeto concluído')
    expect(md).toContain('400 XP')
    expect(md).toContain('## Projeto 1')
    expect(md).toContain('**Nível:** Júnior · **Dificuldade:** 2/5 · **Concluído em:** 09/03/2026')
    expect(md).toContain('- Repositório: <https://github.com/vitto2/p1>')
    expect(md).not.toContain('Deploy:')
    expect(md).toContain('**Tópicos relacionados:** Tópico A')
    expect(md).toContain('1. **Etapa 1** (20 XP)')
    expect(md).toContain('   - Critério 2')
    expect(md).toContain('2. **Etapa 2** (30 XP)')
  })

  it('avisa quando ainda não há projetos concluídos', () => {
    const md = buildPortfolioMarkdown({ ...base, projects: [] })
    expect(md).toContain('0 projetos concluídos')
    expect(md).toContain('Nenhum projeto concluído ainda')
  })

  it('usa o fuso informado nas datas', () => {
    const md = buildPortfolioMarkdown({
      ...base,
      timeZone: 'UTC',
      generatedAt: new Date('2026-03-10T02:30:00Z'),
      projects: [],
    })
    expect(md).toContain('Gerado em 10/03/2026')
    expect(
      buildPortfolioMarkdown({
        ...base,
        generatedAt: new Date('2026-03-10T02:30:00Z'),
        projects: [],
      }),
    ).toContain('Gerado em 09/03/2026')
  })
})
