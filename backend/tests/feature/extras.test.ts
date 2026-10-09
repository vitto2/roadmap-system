import { afterEach, describe, expect, it } from 'vitest'
import { Auth } from '../../src/auth'
import { createTestEnv, sampleContent, type TestEnv } from '../helpers'

let env: TestEnv
afterEach(async () => env.close())

describe('grafo de pré-requisitos', () => {
  it('lista nós e arestas e marca bloqueados/desbloqueados', async () => {
    env = createTestEnv()
    const { body } = await env.call('GET', '/graph')
    const nodes = new Map<string, { unlocked: boolean; blockedBy: string[] }>(
      body.data.nodes.map((n: { slug: string; unlocked: boolean; blockedBy: string[] }) => [
        n.slug,
        n,
      ]),
    )
    expect(body.data.edges).toEqual(
      expect.arrayContaining([
        { source: 'a', target: 'b' },
        { source: 'b', target: 'c' },
      ]),
    )
    expect(nodes.get('a')?.unlocked).toBe(true) // sem pré-requisitos
    expect(nodes.get('b')).toMatchObject({ unlocked: false, blockedBy: ['a'] })
  })

  it('desbloqueia o tópico quando o pré-requisito é concluído (sem nunca impedir marcação)', async () => {
    env = createTestEnv()
    await env.call('POST', '/topics/a/master')
    const { body } = await env.call('GET', '/graph')
    const b = body.data.nodes.find((n: { slug: string }) => n.slug === 'b')
    expect(b).toMatchObject({ unlocked: true, blockedBy: [] })

    // tópico "c" continua bloqueado visualmente, mas pode ser marcado
    const c = body.data.nodes.find((n: { slug: string }) => n.slug === 'c')
    expect(c.unlocked).toBe(false)
    expect((await env.call('POST', '/topics/c/master')).status).toBe(200)
  })
})

describe('exportação de portfólio', () => {
  it('lista só projetos concluídos, em markdown', async () => {
    env = createTestEnv()
    const empty = await env.call('GET', '/export/portfolio.md')
    expect(empty.status).toBe(200)
    expect(empty.body).toContain('Nenhum projeto concluído ainda')

    for (const key of ['m1', 'm2', 'm3']) {
      await env.call('PUT', `/projects/p1/milestones/${key}`, { status: 'completed' })
    }
    await env.call('PATCH', '/projects/p1/progress', {
      repositoryUrl: 'https://github.com/vitto2/p1',
    })

    const res = await env.app.inject({ method: 'GET', url: '/api/v1/export/portfolio.md' })
    expect(res.headers['content-type']).toContain('text/markdown')
    expect(res.headers['content-disposition']).toContain('portfolio.md')
    expect(res.body).toContain('## Projeto 1')
    expect(res.body).toContain('Repositório: <https://github.com/vitto2/p1>')
    expect(res.body).toContain('1. **Etapa 1** (20 XP)')
    expect(res.body).toContain('Critério 1')
    expect(res.body).toContain('1 projeto concluído')
  })

  it('não inclui projetos incompletos', async () => {
    env = createTestEnv()
    await env.call('PUT', '/projects/p1/milestones/m1', { status: 'completed' })
    const res = await env.app.inject({ method: 'GET', url: '/api/v1/export/portfolio.md' })
    expect(res.body).not.toContain('## Projeto 1')
  })
})

describe('backup e restauração', () => {
  async function seedProgress() {
    await env.call('PUT', '/topics/a/checklist/a-1', { checked: true })
    await env.call('POST', '/topics/b/master')
    await env.call('PATCH', '/topics/a/progress', {
      notes: '# Minhas notas',
      evidenceUrl: 'https://example.com/e',
    })
    await env.call('PUT', '/projects/p1/milestones/m1', { status: 'completed' })
    await env.call('PATCH', '/projects/p1/progress', { deployUrl: 'https://p1.example.com' })
    await env.call('POST', '/study-sessions', {
      durationMinutes: 40,
      topicSlug: 'a',
      note: 'Estudo',
    })
    await env.call('PUT', '/settings', { weeklyGoal: 4 })
  }

  it('exporta o progresso por slug e restaura em um banco novo, preservando o XP', async () => {
    env = createTestEnv()
    await seedProgress()
    const before = (await env.call('GET', '/profile')).body.data
    const backup = (await env.call('GET', '/export/backup')).body

    expect(backup.version).toBe(1)
    expect(backup.topics.find((t: { slug: string }) => t.slug === 'a')).toMatchObject({
      notes: '# Minhas notas',
      checked: ['a-1'],
    })
    await env.close()

    // banco novo (mesmo conteúdo, sem progresso) recebe o backup
    env = createTestEnv()
    expect((await env.call('GET', '/profile')).body.data.xp.total).toBe(0)
    const restored = await env.call('POST', '/import/backup', backup)
    expect(restored.status).toBe(200)
    expect(restored.body.data.skipped).toEqual([])
    expect(restored.body.data.imported).toMatchObject({ topics: 2, projects: 1, sessions: 1 })

    const after = (await env.call('GET', '/profile')).body.data
    expect(after.xp.total).toBe(before.xp.total)
    expect(after.streak.weeklyGoal).toBe(4)
    expect((await env.call('GET', '/topics/a')).body.data).toMatchObject({
      notes: '# Minhas notas',
      checklistChecked: 1,
    })
    expect((await env.call('GET', '/projects/p1')).body.data.deployUrl).toBe(
      'https://p1.example.com',
    )
    expect((await env.call('GET', '/study-sessions')).body.data[0]).toMatchObject({
      note: 'Estudo',
    })
  })

  it('restaurar substitui o progresso atual e ignora itens que não existem mais', async () => {
    env = createTestEnv()
    await env.call('POST', '/topics/d/master') // será substituído
    const backup = {
      version: 1,
      exportedAt: '2026-03-01T00:00:00.000Z',
      topics: [
        {
          slug: 'a',
          status: 'studying',
          notes: '',
          evidenceUrl: null,
          startedAt: '2026-03-01T00:00:00.000Z',
          completedAt: null,
          masteredDirectly: false,
          checked: ['a-1', 'item-que-sumiu'],
          reviews: [],
        },
        {
          slug: 'topico-removido',
          status: 'completed',
          notes: '',
          evidenceUrl: null,
          startedAt: null,
          completedAt: null,
          masteredDirectly: false,
          checked: [],
          reviews: [],
        },
      ],
      projects: [],
      sessions: [],
    }
    const { status, body } = await env.call('POST', '/import/backup', backup)
    expect(status).toBe(200)
    expect(body.data.skipped).toEqual([
      'item "item-que-sumiu" do tópico "a"',
      'tópico "topico-removido"',
    ])
    expect(body.profile.xp.total).toBe(0) // "d" deixou de estar concluído
    expect((await env.call('GET', '/topics/a')).body.data.checklistChecked).toBe(1)
  })

  it('rejeita backup inválido sem alterar nada (422)', async () => {
    env = createTestEnv()
    await env.call('POST', '/topics/a/master')
    const res = await env.call('POST', '/import/backup', { version: 2 })
    expect(res.status).toBe(422)
    expect((await env.call('GET', '/profile')).body.data.xp.total).toBe(10)
  })
})

describe('autenticação opcional', () => {
  it('sem AUTH_PASSWORD a API é aberta', async () => {
    env = createTestEnv()
    expect((await env.call('GET', '/auth/status')).body).toEqual({ required: false })
    expect((await env.call('GET', '/profile')).status).toBe(200)
  })

  it('com AUTH_PASSWORD exige token, aceita login e rejeita senha errada', async () => {
    env = createTestEnv({ authPassword: 'segredo-123' })
    expect((await env.call('GET', '/auth/status')).body).toEqual({ required: true })

    const blocked = await env.call('GET', '/profile')
    expect(blocked.status).toBe(401)
    expect(blocked.body.code).toBe('unauthenticated')

    const wrong = await env.call('POST', '/auth/login', { password: 'errada' })
    expect(wrong.status).toBe(401)
    expect(wrong.body.code).toBe('invalid_credentials')

    const login = await env.call('POST', '/auth/login', { password: 'segredo-123' })
    expect(login.status).toBe(200)
    const headers = { authorization: `Bearer ${login.body.token}` }
    expect((await env.call('GET', '/profile', undefined, headers)).status).toBe(200)
    expect(
      (await env.call('GET', '/profile', undefined, { authorization: 'Bearer lixo' })).status,
    ).toBe(401)
  })

  it('bloqueia depois de muitas tentativas erradas', async () => {
    env = createTestEnv({ authPassword: 'segredo-123' })
    for (let i = 0; i < 5; i++) await env.call('POST', '/auth/login', { password: 'x' })
    const res = await env.call('POST', '/auth/login', { password: 'segredo-123' })
    expect(res.status).toBe(429)
  })

  it('tokens expiram e são ligados à senha', () => {
    const auth = new Auth('abc')
    const { token } = auth.issueToken(new Date('2026-01-01T00:00:00Z'))
    expect(auth.verifyToken(token, new Date('2026-01-15T00:00:00Z'))).toBe(true)
    expect(auth.verifyToken(token, new Date('2026-03-01T00:00:00Z'))).toBe(false) // > 30 dias
    expect(new Auth('outra').verifyToken(token, new Date('2026-01-02T00:00:00Z'))).toBe(false)
    expect(auth.verifyToken(`${token}x`, new Date('2026-01-02T00:00:00Z'))).toBe(false)
  })
})

describe('documentação OpenAPI', () => {
  it('expõe o documento OpenAPI com as rotas da API', async () => {
    env = createTestEnv({ content: sampleContent() })
    await env.app.ready()
    const spec = env.app.swagger() as { paths: Record<string, unknown>; info: { title: string } }
    expect(spec.info.title).toBe('Trilha Sênior API')
    expect(Object.keys(spec.paths)).toEqual(
      expect.arrayContaining(['/api/v1/profile', '/api/v1/topics/{slug}', '/api/v1/graph']),
    )
  })
})
