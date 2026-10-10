import { describe, expect, it } from 'vitest'
import { ApiError, errorMessage, toApiError } from '../client'

describe('toApiError', () => {
  it('converte erros das funções SQL (SQLSTATE PTnnn) com código de máquina e erros por campo', () => {
    const error = toApiError({
      code: 'PT422',
      message: 'Os dados enviados são inválidos.',
      hint: 'validation_failed',
      details: JSON.stringify({ notes: ['Muito longo'], evidenceUrl: ['Link inválido'] }),
    })
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 422,
      code: 'validation_failed',
      message: 'Os dados enviados são inválidos.',
    })
    expect(error.fieldError('notes')).toBe('Muito longo')
    expect(error.fieldError('evidenceUrl')).toBe('Link inválido')
    expect(error.fieldError('outro')).toBeUndefined()
  })

  it('mantém 404 e 409 das regras de negócio', () => {
    expect(
      toApiError({ code: 'PT404', message: 'Tópico não encontrado(a).', hint: 'not_found' }),
    ).toMatchObject({ status: 404, code: 'not_found' })
    expect(
      toApiError({
        code: 'PT409',
        message: 'Marque todos os itens.',
        hint: 'checklist_incomplete',
      }),
    ).toMatchObject({ status: 409, code: 'checklist_incomplete' })
  })

  it('ignora detalhes que não são JSON de erros por campo', () => {
    expect(
      toApiError({ code: 'PT422', message: 'x', hint: 'validation_failed', details: 'texto' })
        .errors,
    ).toBe(undefined)
    expect(toApiError({ code: 'PT422', message: 'x', hint: 'y', details: '[1,2]' }).errors).toBe(
      undefined,
    )
  })

  it('trata sessão expirada, permissão negada e banco não preparado', () => {
    expect(toApiError({ code: 'PGRST301', message: 'JWT expired', status: 401 })).toMatchObject({
      status: 401,
      code: 'unauthenticated',
    })
    expect(toApiError({ code: '42501', message: 'permission denied', status: 403 })).toMatchObject({
      status: 403,
      code: 'forbidden',
    })
    const notReady = toApiError({
      code: 'PGRST202',
      message: 'Could not find the function public.get_profile',
      status: 404,
    })
    expect(notReady).toMatchObject({ status: 404, code: 'database_not_ready' })
    expect(notReady.message).toContain('migrations')
  })

  it('trata falha de rede com mensagem amigável', () => {
    expect(toApiError({ message: 'TypeError: Failed to fetch', status: 0 })).toMatchObject({
      status: 0,
      code: 'network_error',
    })
  })

  it('erros desconhecidos viram erro de servidor', () => {
    expect(toApiError({ message: 'algo quebrou', status: 500 })).toMatchObject({
      status: 500,
      code: 'server_error',
      message: 'algo quebrou',
    })
  })

  it('errorMessage lida com qualquer valor', () => {
    expect(errorMessage(new ApiError(500, 'x', 'Falhou'))).toBe('Falhou')
    expect(errorMessage(new Error('boom'))).toBe('boom')
    expect(errorMessage('???')).toBe('Ocorreu um erro inesperado.')
  })
})
