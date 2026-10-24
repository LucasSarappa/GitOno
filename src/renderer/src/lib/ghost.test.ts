import { describe, expect, it } from 'vitest'
import type { CommitInfo } from '../../../shared/types'
import { childrenOf, nearestBranch } from './ghost'
import type { RefLabel } from './refs'

const c = (sha: string, ...parents: string[]): CommitInfo => ({ sha, parents, authorName: '', authorEmail: '', authorDate: 0, subject: sha })
const label = (name: string, kind: RefLabel['kind'] = 'local'): RefLabel => ({ key: `refs/heads/${name}`, label: name, kind, current: false, remotes: [] })

// main: m1 ← m2 ← m3 (merge de feature) ← m4
// feature: m1 ← f1 ← f2, mergeada en m3; trabajo: m2 ← t1 (sin etiqueta en t1, etiqueta en t2)
const commits = [c('m4', 'm3'), c('t2', 't1'), c('m3', 'm2', 'f2'), c('t1', 'm2'), c('f2', 'f1'), c('m2', 'm1'), c('f1', 'm1'), c('m1')]
const labels = new Map<string, RefLabel[]>([
  ['m4', [label('main')]],
  ['t2', [label('trabajo')]],
  ['f2', [label('v1', 'tag')]]
])
const columns: Record<string, number> = { m4: 0, m3: 0, m2: 0, m1: 0, t2: 1, t1: 1, f2: 2, f1: 2 }
const columnOf = (sha: string) => columns[sha]

describe('nearestBranch', () => {
  const children = childrenOf(commits)

  it('un commit de la principal muestra la principal', () => {
    expect(nearestBranch('m2', children, labels, columnOf)?.label).toBe('main')
  })

  it('sigue la línea de su propia rama antes que otras', () => {
    expect(nearestBranch('t1', children, labels, columnOf)?.label).toBe('trabajo')
  })

  it('un commit de una rama ya mergeada y sin etiqueta muestra la rama donde se mergeó', () => {
    // f2 solo tiene un tag: no cuenta como rama.
    expect(nearestBranch('f1', children, labels, columnOf)?.label).toBe('main')
  })

  it('un commit con etiqueta de rama se devuelve a sí mismo', () => {
    expect(nearestBranch('m4', children, labels, columnOf)?.label).toBe('main')
  })

  it('sin ramas arriba no hay fantasma', () => {
    expect(nearestBranch('x', childrenOf([c('x')]), new Map(), () => 0)).toBeNull()
  })
})
