import type { RefInfo, RefKind } from '../../../shared/types'

export interface RefLabel {
  key: string
  label: string
  kind: RefKind | 'head'
  /** Es la rama en la que está parado el repo. */
  current: boolean
  /** Remotos donde la misma rama apunta al mismo commit (ej. "origin"). */
  remotes: string[]
}

/** Separa "origin/feature/x" en remoto ("origin") y rama ("feature/x"). */
export function splitRemoteName(name: string): { remote: string; branch: string } {
  const slash = name.indexOf('/')
  return slash === -1 ? { remote: name, branch: '' } : { remote: name.slice(0, slash), branch: name.slice(slash + 1) }
}

/**
 * Etiquetas a mostrar en cada commit del gráfico. Como GitKraken, si una rama local y su
 * remota apuntan al mismo commit se muestran juntas ("main" con "origin" al lado).
 */
export function labelsByCommit(refs: RefInfo[], current: string | null, head: string | null): Map<string, RefLabel[]> {
  const byTarget = new Map<string, RefInfo[]>()
  for (const ref of refs) {
    const list = byTarget.get(ref.target) ?? []
    list.push(ref)
    byTarget.set(ref.target, list)
  }

  const result = new Map<string, RefLabel[]>()
  for (const [target, list] of byTarget) {
    const labels: RefLabel[] = []
    const remotes = list.filter((r) => r.kind === 'remote')
    const usedRemotes = new Set<string>()

    for (const local of list.filter((r) => r.kind === 'local')) {
      const twins = remotes.filter((r) => splitRemoteName(r.name).branch === local.name)
      twins.forEach((r) => usedRemotes.add(r.ref))
      labels.push({
        key: local.ref,
        label: local.name,
        kind: 'local',
        current: local.ref === current,
        remotes: twins.map((r) => splitRemoteName(r.name).remote)
      })
    }
    for (const remote of remotes) {
      if (!usedRemotes.has(remote.ref)) {
        labels.push({ key: remote.ref, label: remote.name, kind: 'remote', current: false, remotes: [] })
      }
    }
    for (const tag of list.filter((r) => r.kind === 'tag')) {
      labels.push({ key: tag.ref, label: tag.name, kind: 'tag', current: false, remotes: [] })
    }
    labels.sort((a, b) => Number(b.current) - Number(a.current))
    result.set(target, labels)
  }

  // HEAD desacoplado: no hay rama actual, pero conviene marcar dónde está parado el repo.
  if (head && !current) {
    const list = result.get(head) ?? []
    list.unshift({ key: 'HEAD', label: 'HEAD', kind: 'head', current: true, remotes: [] })
    result.set(head, list)
  }
  return result
}
