// Parsers de la salida de Git. Se usa siempre `-z` (separador NUL) para que las rutas
// con espacios, tildes o caracteres raros lleguen tal cual, sin comillas ni escapes.

import type { ChangeStatus, RefInfo } from '../../shared/types'

export interface NameStatusEntry {
  status: ChangeStatus
  path: string
  oldPath?: string
}

const STATUS_BY_LETTER: Record<string, ChangeStatus> = {
  A: 'added',
  D: 'deleted',
  M: 'modified',
  R: 'renamed',
  C: 'copied',
  T: 'type-changed'
}

/** Parsea `git diff --name-status -z`. Renombres y copias traen dos rutas: origen y destino. */
export function parseNameStatus(output: string): NameStatusEntry[] {
  const tokens = output.split('\0')
  const entries: NameStatusEntry[] = []
  let i = 0
  while (i < tokens.length) {
    const code = tokens[i++]
    if (!code) continue
    const letter = code[0]
    const status = STATUS_BY_LETTER[letter] ?? 'unknown'
    if (letter === 'R' || letter === 'C') {
      const oldPath = tokens[i++]
      const path = tokens[i++]
      entries.push({ status, path, oldPath })
    } else {
      entries.push({ status, path: tokens[i++] })
    }
  }
  return entries
}

export interface LineCounts {
  additions: number | null
  deletions: number | null
}

/**
 * Parsea `git diff --numstat -z`. Formato por archivo: "agregadas\tborradas\truta\0",
 * o "agregadas\tborradas\t\0origen\0destino\0" si hubo renombre. Los binarios traen "-".
 */
export function parseNumstat(output: string): Map<string, LineCounts> {
  const tokens = output.split('\0')
  const counts = new Map<string, LineCounts>()
  let i = 0
  while (i < tokens.length) {
    const entry = tokens[i++]
    if (!entry) continue
    const firstTab = entry.indexOf('\t')
    const secondTab = entry.indexOf('\t', firstTab + 1)
    if (firstTab < 0 || secondTab < 0) continue
    const added = entry.slice(0, firstTab)
    const deleted = entry.slice(firstTab + 1, secondTab)
    let path = entry.slice(secondTab + 1)
    if (path === '') {
      i++ // ruta de origen del renombre; nos quedamos con la de destino
      path = tokens[i++]
    }
    counts.set(
      path,
      added === '-' ? { additions: null, deletions: null } : { additions: Number(added), deletions: Number(deleted) }
    )
  }
  return counts
}

/** Parsea `git for-each-ref --format=%(refname)%09%(refname:short)`. */
export function parseRefs(output: string): RefInfo[] {
  const refs: RefInfo[] = []
  for (const line of output.split('\n')) {
    const [ref, name] = line.trim().split('\t')
    if (!ref || !name) continue
    // origin/HEAD es solo un puntero a la rama por defecto del remoto
    if (ref.startsWith('refs/remotes/') && ref.endsWith('/HEAD')) continue
    if (ref.startsWith('refs/heads/')) refs.push({ ref, name, kind: 'local' })
    else if (ref.startsWith('refs/remotes/')) refs.push({ ref, name, kind: 'remote' })
    else if (ref.startsWith('refs/tags/')) refs.push({ ref, name, kind: 'tag' })
  }
  return refs
}

/** Mismo criterio que usa Git: si hay un byte NUL al principio, es binario. */
export function looksBinary(content: Buffer): boolean {
  return content.subarray(0, 8000).includes(0)
}
