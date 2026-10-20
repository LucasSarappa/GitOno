export interface RemoteLocation {
  /** Host en minúsculas, ej. "github.com" o "gitlab.miempresa.com". */
  host: string
  /** Ruta del repo sin ".git", ej. "owner/repo" o "grupo/subgrupo/repo". */
  path: string
}

/**
 * Entiende los formatos de URL que usa Git para los remotos:
 *   https://github.com/owner/repo.git
 *   ssh://git@gitlab.com:2222/grupo/sub/repo.git
 *   git@github.com:owner/repo.git   (formato "scp")
 * Devuelve null para remotos locales (carpetas o file://).
 */
export function parseRemoteUrl(url: string): RemoteLocation | null {
  const trimmed = url.trim()
  let host: string
  let path: string

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    let parsed: URL
    try {
      parsed = new URL(trimmed)
    } catch {
      return null
    }
    if (parsed.protocol === 'file:' || !parsed.hostname) return null
    host = parsed.hostname
    path = decodeURIComponent(parsed.pathname)
  } else {
    const scp = /^(?:[^@/]+@)?([^:/]+):(.+)$/.exec(trimmed)
    // "C:/repos/x" también encaja en el patrón, pero es una ruta de Windows
    if (!scp || /^[a-z]$/i.test(scp[1])) return null
    host = scp[1]
    path = scp[2]
  }

  path = path.replace(/^\/+|\/+$/g, '').replace(/\.git$/i, '')
  if (!path) return null
  return { host: host.toLowerCase(), path }
}
