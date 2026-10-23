// Fotos de los autores de los commits, como en GitKraken.
//
// Orden de búsqueda para cada email:
//   1. Emails privados de GitHub (123+usuario@users.noreply.github.com): la URL sale del email.
//   2. Repos de GitHub: la API pública de commits trae el avatar de cada autor (se guarda en caché).
//   3. Gravatar, con el email convertido en hash. Antes se verifica que la foto exista (y se guarda
//      en caché), así la interfaz solo recibe URLs que cargan; sin foto, muestra las iniciales.
//
// No depende de Electron: el archivo de caché se recibe como parámetro, así se puede testear.

import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import type { ProviderInfo } from '../shared/types'

const SIZE = 64

/** Avatar de un email privado de GitHub, sin consultar ninguna API. */
export function avatarFromNoreply(email: string): string | null {
  const match = /^(?:(\d+)\+)?([^@]+)@users\.noreply\.github\.com$/i.exec(email.trim())
  if (!match) return null
  const [, id, login] = match
  return id ? `https://avatars.githubusercontent.com/u/${id}?s=${SIZE}&v=4` : `https://github.com/${encodeURIComponent(login)}.png?size=${SIZE}`
}

/** URL de Gravatar. `d=404` hace que falle si no hay foto, y la interfaz muestra las iniciales. */
export function gravatarUrl(email: string): string {
  const hash = createHash('sha256').update(email.trim().toLowerCase()).digest('hex')
  return `https://www.gravatar.com/avatar/${hash}?s=${SIZE}&d=404`
}

interface CacheEntry {
  savedAt: number
  /** email (en minúsculas) → URL del avatar en GitHub */
  avatars: Record<string, string>
}

interface Cache {
  /** Repo de GitHub ("owner/repo") → avatares de sus autores. */
  repos: Record<string, CacheEntry>
  /** Email → URL de Gravatar, o null si no tiene foto. */
  gravatar: Record<string, { savedAt: number; url: string | null }>
}

/** Una semana: los avatares cambian poco y la API sin token permite 60 pedidos por hora. */
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const PAGES = 3

export type Fetcher = (
  url: string,
  init?: { method?: 'GET' | 'HEAD' }
) => Promise<{ ok: boolean; status?: number; json(): Promise<unknown> }>

interface GitHubCommit {
  commit?: { author?: { email?: string }; committer?: { email?: string } }
  author?: { avatar_url?: string } | null
  committer?: { avatar_url?: string } | null
}

/** Mapa email → avatar a partir de los últimos commits del repo en GitHub. */
export async function githubAvatars(owner: string, repo: string, fetcher: Fetcher): Promise<Record<string, string>> {
  const avatars: Record<string, string> = {}
  for (let page = 1; page <= PAGES; page++) {
    const res = await fetcher(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=100&page=${page}`)
    // Repo privado, inexistente o sin cupo en la API: se usan los otros métodos.
    if (!res.ok) break
    const commits = (await res.json()) as GitHubCommit[]
    if (!Array.isArray(commits)) break
    for (const item of commits) {
      const pairs: [string | undefined, string | undefined][] = [
        [item.commit?.author?.email, item.author?.avatar_url],
        [item.commit?.committer?.email, item.committer?.avatar_url]
      ]
      for (const [email, url] of pairs) {
        if (email && url) avatars[email.toLowerCase()] = `${url}${url.includes('?') ? '&' : '?'}s=${SIZE}`
      }
    }
    if (commits.length < 100) break
  }
  return avatars
}

const defaultFetcher: Fetcher = (url, init) =>
  fetch(url, {
    method: init?.method ?? 'GET',
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'GitOno' },
    signal: AbortSignal.timeout(6000)
  })

/** Pedidos a Gravatar en paralelo, como máximo. */
const GRAVATAR_CONCURRENCY = 6

export class AvatarResolver {
  private cache: Cache | null = null

  constructor(
    private readonly cacheFile: string,
    private readonly fetcher: Fetcher = defaultFetcher,
    private readonly now: () => number = Date.now
  ) {}

  /** URL del avatar de cada email pedido. Los que no tienen foto no aparecen en el resultado. */
  async resolve(emails: string[], provider: ProviderInfo | null): Promise<Record<string, string>> {
    const fromGitHub = provider?.id === 'github' ? await this.githubMap(provider.repoPath) : {}
    const result: Record<string, string> = {}
    const toCheck: string[] = []
    for (const email of new Set(emails.filter(Boolean))) {
      const url = avatarFromNoreply(email) ?? fromGitHub[email.toLowerCase()]
      if (url) result[email] = url
      else toCheck.push(email)
    }
    const queue = [...toCheck]
    const worker = async () => {
      for (let email = queue.shift(); email; email = queue.shift()) {
        const url = await this.gravatar(email)
        if (url) result[email] = url
      }
    }
    await Promise.all(Array.from({ length: Math.min(GRAVATAR_CONCURRENCY, queue.length) }, worker))
    if (toCheck.length > 0) await this.save()
    return result
  }

  /** URL de Gravatar si el email tiene foto; null si no tiene o no se pudo averiguar. */
  private async gravatar(email: string): Promise<string | null> {
    const cache = await this.load()
    const key = email.trim().toLowerCase()
    const cached = cache.gravatar[key]
    if (cached && this.now() - cached.savedAt < CACHE_TTL_MS) return cached.url
    const url = gravatarUrl(email)
    try {
      const res = await this.fetcher(url, { method: 'HEAD' })
      cache.gravatar[key] = { savedAt: this.now(), url: res.ok ? url : null }
      return res.ok ? url : null
    } catch {
      // Sin internet: no se guarda nada, se vuelve a probar la próxima vez.
      return null
    }
  }

  private async save(): Promise<void> {
    if (this.cache) await writeFile(this.cacheFile, JSON.stringify(this.cache)).catch(() => undefined)
  }

  private async githubMap(repoPath: string): Promise<Record<string, string>> {
    const cache = await this.load()
    const cached = cache.repos[repoPath]
    if (cached && this.now() - cached.savedAt < CACHE_TTL_MS) return cached.avatars
    const [owner, repo] = repoPath.split('/')
    if (!owner || !repo) return {}
    try {
      const avatars = await githubAvatars(owner, repo, this.fetcher)
      cache.repos[repoPath] = { savedAt: this.now(), avatars }
      await this.save()
      return avatars
    } catch {
      // Sin internet o la API no respondió: se sigue con lo que haya en caché (aunque esté vencido).
      return cached?.avatars ?? {}
    }
  }

  private async load(): Promise<Cache> {
    if (this.cache) return this.cache
    try {
      const saved = JSON.parse(await readFile(this.cacheFile, 'utf8')) as Partial<Cache>
      this.cache = { repos: saved.repos ?? {}, gravatar: saved.gravatar ?? {} }
    } catch {
      this.cache = { repos: {}, gravatar: {} }
    }
    return this.cache
  }
}
