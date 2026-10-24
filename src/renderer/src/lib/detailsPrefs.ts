// Qué muestra el panel de detalle de un commit. Se elige desde el menú ⋯ del panel y se recuerda.

import { useSyncExternalStore } from 'react'
import { loadSetting, saveSetting } from './settings'

export interface DetailsPrefs {
  /** Descripción completa del commit; apagado, solo las primeras líneas con "Ver más". */
  fullMessage: boolean
  /** SHA, padres y ramas que contienen el commit. */
  facts: boolean
  /** Archivos en árbol de carpetas o en lista con la ruta completa. */
  files: 'tree' | 'list'
}

export const DEFAULT_DETAILS: DetailsPrefs = { fullMessage: false, facts: true, files: 'tree' }

let prefs: DetailsPrefs = loadSetting('detailsPrefs', DEFAULT_DETAILS)
const listeners = new Set<() => void>()

export function setDetailsPrefs(change: Partial<DetailsPrefs>): void {
  prefs = { ...prefs, ...change }
  saveSetting('detailsPrefs', prefs)
  for (const listener of listeners) listener()
}

export function useDetailsPrefs(): DetailsPrefs {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => prefs
  )
}
