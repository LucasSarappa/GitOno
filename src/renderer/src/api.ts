import type { GitOnoApi } from '../../shared/types'

declare global {
  interface Window {
    gitono: GitOnoApi
  }
}

/** Puente hacia el proceso principal (ver src/preload/index.ts). */
export const api: GitOnoApi = window.gitono
