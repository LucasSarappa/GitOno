import { loadSetting, saveSetting } from './settings'

export interface RecentRepo {
  root: string
  name: string
  /** Última vez que se abrió, en milisegundos. */
  openedAt: number
}

const KEY = 'recentRepos'
const MAX = 8

export function loadRecent(): RecentRepo[] {
  const list = loadSetting<RecentRepo[]>(KEY, [])
  return Array.isArray(list) ? list.filter((r) => r && typeof r.root === 'string') : []
}

/** Pone el repo primero en la lista de recientes (sin duplicados). */
export function rememberRecent(root: string, name: string): void {
  const list = [{ root, name, openedAt: Date.now() }, ...loadRecent().filter((r) => r.root !== root)]
  saveSetting(KEY, list.slice(0, MAX))
}

export function forgetRecent(root: string): void {
  saveSetting(
    KEY,
    loadRecent().filter((r) => r.root !== root)
  )
}
