import { describe, expect, it } from 'vitest'
import {
  addDays,
  computeStreak,
  evaluateCareerLevel,
  levelForXp,
  localDate,
  projectBonusXp,
  reviewXp,
  scheduleReviews,
  sessionsInWeek,
  startOfWeek,
  topicXp,
  xpToCompleteLevel,
  type TopicLike,
} from '../../src/domain/scoring'

describe('xp', () => {
  it('tópico concluído vale dificuldade x 10', () => {
    expect([1, 2, 3, 4, 5].map(topicXp)).toEqual([10, 20, 30, 40, 50])
  })

  it('revisão vale 25% do XP do tópico', () => {
    expect(reviewXp(4)).toBe(10)
    expect(reviewXp(2)).toBe(5)
  })

  it('bônus de projeto: 100 + 50 repositório + 50 deploy', () => {
    expect(projectBonusXp({ hasRepository: false, hasDeploy: false })).toBe(100)
    expect(projectBonusXp({ hasRepository: true, hasDeploy: false })).toBe(150)
    expect(projectBonusXp({ hasRepository: true, hasDeploy: true })).toBe(200)
  })
})

describe('nível de gamificação', () => {
  it('XP para completar o nível N é 100 x N^1.5', () => {
    expect(xpToCompleteLevel(1)).toBe(100)
    expect(xpToCompleteLevel(4)).toBe(800)
  })

  it('começa no nível 1 com 0 XP', () => {
    expect(levelForXp(0)).toMatchObject({ level: 1, xpIntoLevel: 0, xpForNextLevel: 100 })
  })

  it('sobe de nível ao acumular XP', () => {
    expect(levelForXp(99).level).toBe(1)
    expect(levelForXp(100)).toMatchObject({ level: 2, xpIntoLevel: 0, xpForNextLevel: 283 })
    expect(levelForXp(100 + 283).level).toBe(3)
    expect(levelForXp(150)).toMatchObject({ level: 2, xpIntoLevel: 50 })
  })
})

describe('nível de carreira', () => {
  const t = (careerLevel: TopicLike['careerLevel'], completed: boolean): TopicLike => ({
    careerLevel,
    completed,
  })

  it('é iniciante sem progresso suficiente', () => {
    const result = evaluateCareerLevel([t('beginner', true), t('junior', false), t('junior', false)])
    expect(result.level).toBe('beginner')
    expect(result.next?.level).toBe('junior')
  })

  it('atinge júnior com 40% dos tópicos até júnior', () => {
    const topics = [t('beginner', true), t('beginner', true), t('junior', false), t('junior', false), t('mid', false)]
    expect(evaluateCareerLevel(topics).level).toBe('junior')
  })

  it('exige os níveis anteriores (sequencial)', () => {
    // tudo de pleno e sênior concluído, mas nada de júnior
    const topics = [t('junior', false), t('junior', false), t('mid', true), t('mid', true), t('senior', true)]
    expect(evaluateCareerLevel(topics).level).toBe('beginner')
  })

  it('atinge sênior com 80% de tudo', () => {
    const topics = Array.from({ length: 10 }, (_, i) =>
      t(i < 3 ? 'junior' : i < 6 ? 'mid' : 'senior', i < 8),
    )
    const result = evaluateCareerLevel(topics)
    expect(result.level).toBe('senior')
    expect(result.next).toBeNull()
  })
})

describe('revisão espaçada', () => {
  it('agenda 7, 30 e 90 dias', () => {
    expect(scheduleReviews('2026-01-01', false)).toEqual([
      { intervalDays: 7, dueOn: '2026-01-08' },
      { intervalDays: 30, dueOn: '2026-01-31' },
      { intervalDays: 90, dueOn: '2026-04-01' },
    ])
  })

  it('"Já domino" agenda apenas 90 dias', () => {
    expect(scheduleReviews('2026-01-01', true)).toEqual([{ intervalDays: 90, dueOn: '2026-04-01' }])
  })
})

describe('datas e fuso', () => {
  it('converte instante UTC para a data local', () => {
    const instant = new Date('2026-03-10T02:30:00Z')
    expect(localDate(instant, 'UTC')).toBe('2026-03-10')
    expect(localDate(instant, 'America/Sao_Paulo')).toBe('2026-03-09')
  })

  it('calcula início da semana (segunda)', () => {
    expect(startOfWeek('2026-03-11')).toBe('2026-03-09') // quarta
    expect(startOfWeek('2026-03-15')).toBe('2026-03-09') // domingo
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('streak e meta semanal', () => {
  it('conta dias consecutivos terminando hoje', () => {
    const info = computeStreak(['2026-03-09', '2026-03-10', '2026-03-11'], '2026-03-11')
    expect(info).toEqual({ current: 3, longest: 3, studiedToday: true })
  })

  it('não quebra se ainda não estudou hoje, mas estudou ontem', () => {
    expect(computeStreak(['2026-03-09', '2026-03-10'], '2026-03-11').current).toBe(2)
  })

  it('quebra após um dia sem estudar e mantém o maior streak', () => {
    const info = computeStreak(['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-10'], '2026-03-11')
    expect(info.current).toBe(1)
    expect(info.longest).toBe(3)
  })

  it('sem sessões o streak é zero', () => {
    expect(computeStreak([], '2026-03-11')).toEqual({ current: 0, longest: 0, studiedToday: false })
  })

  it('conta sessões da semana corrente', () => {
    const dates = ['2026-03-08', '2026-03-09', '2026-03-09', '2026-03-11', '2026-03-16']
    expect(sessionsInWeek(dates, '2026-03-11')).toBe(3)
  })
})
