import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000
const MAX_FAILURES = 5
const FAILURE_WINDOW_MS = 60_000

const b64url = (input: Buffer | string) => Buffer.from(input).toString('base64url')

/**
 * Autenticação OPCIONAL de usuário único: só é exigida se `AUTH_PASSWORD` estiver definido.
 * Token assinado (HMAC-SHA256) com expiração, sem estado no servidor.
 */
export class Auth {
  private readonly secret: Buffer
  private readonly failures = new Map<string, number[]>()

  constructor(
    private readonly password: string | null,
    secret?: string | null,
  ) {
    // sem AUTH_SECRET, o segredo é derivado da senha (trocar a senha invalida os tokens)
    this.secret = createHash('sha256')
      .update(secret || `trilha-senior:${password ?? ''}`)
      .digest()
  }

  get enabled(): boolean {
    return this.password !== null
  }

  checkPassword(input: string): boolean {
    if (this.password === null) return true
    const a = createHash('sha256').update(input).digest()
    const b = createHash('sha256').update(this.password).digest()
    return timingSafeEqual(a, b)
  }

  issueToken(now: Date): { token: string; expiresAt: string } {
    const exp = now.getTime() + TOKEN_TTL_MS
    const payload = b64url(JSON.stringify({ exp }))
    return { token: `${payload}.${this.sign(payload)}`, expiresAt: new Date(exp).toISOString() }
  }

  verifyToken(token: string | undefined, now: Date): boolean {
    if (!token) return false
    const [payload, signature, ...rest] = token.split('.')
    if (!payload || !signature || rest.length > 0) return false
    const expected = Buffer.from(this.sign(payload))
    const given = Buffer.from(signature)
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false
    try {
      const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
        exp?: number
      }
      return typeof exp === 'number' && exp > now.getTime()
    } catch {
      return false
    }
  }

  /** Limita tentativas de login por origem (5 falhas por minuto). */
  isThrottled(key: string, now: Date): boolean {
    const recent = (this.failures.get(key) ?? []).filter(
      (t) => now.getTime() - t < FAILURE_WINDOW_MS,
    )
    this.failures.set(key, recent)
    return recent.length >= MAX_FAILURES
  }

  recordFailure(key: string, now: Date): void {
    this.failures.set(key, [...(this.failures.get(key) ?? []), now.getTime()])
  }

  clearFailures(key: string): void {
    this.failures.delete(key)
  }

  private sign(payload: string): string {
    return b64url(createHmac('sha256', this.secret).update(payload).digest())
  }
}
