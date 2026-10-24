// "Rama fantasma", como en GitKraken: al pasar por un commit sin etiquetas se muestra, tenue, la
// rama más cercana que lo contiene. Se busca subiendo por el gráfico desde el commit hacia los
// hijos, siguiendo la línea de primeros padres (la de la misma rama) hasta encontrar una etiqueta.

import type { CommitInfo } from '../../../shared/types'
import type { RefLabel } from './refs'

/** Hijos de cada commit, en el orden del historial (los más nuevos primero). */
export function childrenOf(commits: CommitInfo[]): Map<string, CommitInfo[]> {
  const children = new Map<string, CommitInfo[]>()
  for (const commit of commits) {
    for (const parent of commit.parents) {
      const list = children.get(parent)
      if (list) list.push(commit)
      else children.set(parent, [commit])
    }
  }
  return children
}

/** Cuántos commits se recorren como máximo (en repos enormes, un commit viejo puede estar lejos). */
const MAX_STEPS = 5000

/**
 * Rama más cercana que contiene a `sha`. Entre varios hijos se prefiere el que lo tiene como primer
 * padre (sigue la misma rama) y que está en el mismo carril; si no hay, cualquiera (por ejemplo, el
 * merge que lo integró en otra rama). Devuelve null si solo lo alcanzan tags o nada.
 */
export function nearestBranch(
  sha: string,
  children: Map<string, CommitInfo[]>,
  labels: Map<string, RefLabel[]>,
  columnOf: (sha: string) => number | undefined
): RefLabel | null {
  let current = sha
  for (let step = 0; step < MAX_STEPS; step++) {
    const branch = labels.get(current)?.find((l) => l.kind === 'local' || l.kind === 'remote')
    if (branch) return branch
    const kids = children.get(current)
    if (!kids || kids.length === 0) return null
    const column = columnOf(current)
    const sameLine = kids.filter((k) => k.parents[0] === current)
    const next = sameLine.find((k) => columnOf(k.sha) === column) ?? sameLine[0] ?? kids[0]
    current = next.sha
  }
  return null
}
