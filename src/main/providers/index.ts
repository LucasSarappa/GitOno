import type { ProviderInfo } from '../../shared/types'
import { github } from './github'
import { gitlab } from './gitlab'
import { parseRemoteUrl } from './remote-url'
import type { GitProvider } from './types'

/** Plataformas soportadas. Para sumar una nueva (Gitea, Bitbucket, ...) se agrega acá. */
export const providers: GitProvider[] = [github, gitlab]

/**
 * Detecta la plataforma de un remoto. Si es un servidor sin adaptador devuelve
 * "generic": todas las funciones locales (comparar ramas, diff) andan igual.
 */
export function detectProvider(remoteUrl: string): ProviderInfo | null {
  const location = parseRemoteUrl(remoteUrl)
  if (!location) return null
  const provider = providers.find((p) => p.matches(location))
  return {
    id: provider?.id ?? 'generic',
    name: provider?.name ?? location.host,
    host: location.host,
    repoPath: location.path
  }
}
