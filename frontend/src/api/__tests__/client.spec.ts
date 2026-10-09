import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, errorMessage, http } from '../client'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('http client', () => {
  it('chama /api/v1 e devolve o JSON', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ data: [1, 2] }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(http.get('/tracks')).resolves.toEqual({ data: [1, 2] })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/tracks',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('envia o corpo como JSON', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    await http.put('/topics/a/checklist/x', { checked: true })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('PUT')
    expect(init.body).toBe(JSON.stringify({ checked: true }))
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' })
  })

  it('converte erros padronizados da API em ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse(
          {
            message: 'Dados inválidos.',
            code: 'validation_failed',
            errors: { notes: ['Muito longo'] },
          },
          422,
        ),
      ),
    )

    const error = await http.patch('/topics/a/progress', {}).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 422,
      code: 'validation_failed',
      message: 'Dados inválidos.',
    })
    expect((error as ApiError).fieldError('notes')).toBe('Muito longo')
  })

  it('trata resposta de erro sem JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(new Response('Bad gateway', { status: 502 })),
    )
    await expect(http.get('/profile')).rejects.toMatchObject({
      status: 502,
      code: 'http_error',
      message: 'Erro 502 ao falar com a API.',
    })
  })

  it('trata falha de rede com mensagem amigável', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch')),
    )
    await expect(http.get('/profile')).rejects.toMatchObject({ status: 0, code: 'network_error' })
  })

  it('errorMessage lida com qualquer valor', () => {
    expect(errorMessage(new ApiError(500, 'x', 'Falhou'))).toBe('Falhou')
    expect(errorMessage(new Error('boom'))).toBe('boom')
    expect(errorMessage('???')).toBe('Ocorreu um erro inesperado.')
  })
})
