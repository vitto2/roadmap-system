/** Erro de aplicação com status HTTP e código estável para o front-end. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly errors?: Record<string, string[]>,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const notFound = (what: string): AppError =>
  new AppError(404, 'not_found', `${what} não encontrado(a).`)

export const conflict = (code: string, message: string): AppError =>
  new AppError(409, code, message)

export const unprocessable = (message: string, errors?: Record<string, string[]>): AppError =>
  new AppError(422, 'validation_failed', message, errors)
