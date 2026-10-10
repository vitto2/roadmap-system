import type { ContentPayload } from '../../src/content/payload'

const checklist = (prefix: string) =>
  [1, 2, 3].map((n) => ({ key: `${prefix}-${n}`, text: `Consigo explicar ${prefix} (${n}).` }))

const topic = (
  track: string,
  slug: string,
  level: string,
  difficulty: number,
  position: number,
  prerequisites: string[] = [],
) => ({
  track,
  slug,
  title: `Tópico ${slug}`,
  description: `Descrição de ${slug}.`,
  level,
  difficulty,
  position,
  prerequisites,
  resources: [
    { name: 'Documentação oficial', url: 'https://example.com/docs' },
    { name: 'Livro X' },
  ],
  checklist: checklist(slug),
})

/** Conteúdo mínimo dos testes: 2 trilhas (1 obrigatória), 5 tópicos e 1 projeto com 3 etapas. */
export function sampleContent(): ContentPayload {
  return {
    tracks: [
      {
        slug: 'core',
        title: 'Core',
        description: 'Trilha obrigatória.',
        required: true,
        position: 0,
      },
      {
        slug: 'extra',
        title: 'Extra',
        description: 'Trilha opcional.',
        required: false,
        position: 1,
      },
    ],
    topics: [
      topic('core', 'a', 'beginner', 1, 0),
      topic('core', 'b', 'junior', 3, 1, ['a']),
      topic('core', 'c', 'mid', 4, 2, ['b']),
      topic('core', 'd', 'senior', 5, 3),
      topic('extra', 'e', 'beginner', 2, 0),
    ],
    projects: [
      {
        slug: 'p1',
        title: 'Projeto 1',
        description: 'Projeto de teste.',
        level: 'junior',
        difficulty: 2,
        position: 0,
        topics: ['b'],
        milestones: [
          { key: 'm1', title: 'Etapa 1', acceptanceCriteria: ['Critério 1'], xp: 20 },
          { key: 'm2', title: 'Etapa 2', acceptanceCriteria: ['Critério 2'], xp: 30 },
          { key: 'm3', title: 'Etapa 3', acceptanceCriteria: ['Critério 3'], xp: 40 },
        ],
      },
    ],
  }
}
