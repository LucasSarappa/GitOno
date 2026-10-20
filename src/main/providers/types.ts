import type { RemoteLocation } from './remote-url'

/**
 * Adaptador de una plataforma (GitHub, GitLab, ...). El resto de la app solo conoce
 * esta interfaz: sumar una plataforma nueva es escribir un adaptador y registrarlo
 * en `providers/index.ts`.
 *
 * Por ahora solo identifica la plataforma de un repo. Las operaciones contra su API
 * (listar ramas remotas, comparar sin clonar, leer archivos, ver PRs/MRs) se agregan
 * acá en la próxima etapa, con la misma firma para todas las plataformas.
 */
export interface GitProvider {
  /** Identificador interno, ej. "github". */
  readonly id: string
  /** Nombre para mostrar en la interfaz. */
  readonly name: string
  /** Indica si un remoto pertenece a esta plataforma. */
  matches(location: RemoteLocation): boolean
}
