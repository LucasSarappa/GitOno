import type { ProviderInfo } from '../../../shared/types'

/** Direcciones web de un repo en su plataforma: commits, ramas y pull/merge requests. */
export interface WebLinks {
  /** "GitHub" o "GitLab", para los textos del menú ("Abrir en GitHub"). */
  name: string
  /** "pull request" en GitHub, "merge request" en GitLab. */
  requestName: string
  commit(sha: string): string
  branch(name: string): string
  /** Abre el formulario para pedir que `branch` se integre en `target` (sin target, la rama por defecto del repo). */
  newRequest(branch: string, target?: string): string
}

// Cada parte de la ruta va codificada, pero se conservan las "/" de nombres como "feature/login".
const path = (name: string) => name.split('/').map(encodeURIComponent).join('/')

/** Solo para GitHub y GitLab: de otros servidores no se sabe cómo arman sus direcciones. */
export function webLinks(provider: ProviderInfo | null): WebLinks | null {
  if (!provider) return null
  const base = `https://${provider.host}/${provider.repoPath}`
  if (provider.id === 'github') {
    return {
      name: 'GitHub',
      requestName: 'pull request',
      commit: (sha) => `${base}/commit/${sha}`,
      branch: (name) => `${base}/tree/${path(name)}`,
      newRequest: (branch, target) => `${base}/compare/${target ? `${path(target)}...` : ''}${path(branch)}?expand=1`
    }
  }
  if (provider.id === 'gitlab') {
    return {
      name: 'GitLab',
      requestName: 'merge request',
      commit: (sha) => `${base}/-/commit/${sha}`,
      branch: (name) => `${base}/-/tree/${path(name)}`,
      newRequest: (branch, target) =>
        `${base}/-/merge_requests/new?merge_request%5Bsource_branch%5D=${encodeURIComponent(branch)}` +
        (target ? `&merge_request%5Btarget_branch%5D=${encodeURIComponent(target)}` : '')
    }
  }
  return null
}
