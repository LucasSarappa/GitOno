// Parsers de la salida de Git. Se usa siempre `-z` (separador NUL) para que las rutas
// con espacios, tildes o caracteres raros lleguen tal cual, sin comillas ni escapes.

import type { ChangeStatus, CommitDetails, CommitInfo, RefInfo } from '../../shared/types'

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

export const REFS_FORMAT = '%(refname)%09%(refname:short)%09%(objectname)%09%(*objectname)'

/**
 * Parsea `git for-each-ref --format=REFS_FORMAT`. El último campo solo viene en los tags
 * anotados: es el commit al que apunta el tag (el objectname es el del objeto tag).
 */
export function parseRefs(output: string): RefInfo[] {
  const refs: RefInfo[] = []
  for (const line of output.split('\n')) {
    const [ref, name, objectName, peeled] = line.trim().split('\t')
    if (!ref || !name || !objectName) continue
    // origin/HEAD es solo un puntero a la rama por defecto del remoto
    if (ref.startsWith('refs/remotes/') && ref.endsWith('/HEAD')) continue
    const target = peeled || objectName
    if (ref.startsWith('refs/heads/')) refs.push({ ref, name, kind: 'local', target })
    else if (ref.startsWith('refs/remotes/')) refs.push({ ref, name, kind: 'remote', target })
    else if (ref.startsWith('refs/tags/')) refs.push({ ref, name, kind: 'tag', target })
  }
  return refs
}

// Separador de campos para `git log`: un caracter de control que no aparece en nombres ni mensajes.
const FIELD = '\x1f'
export const LOG_FORMAT = ['%H', '%P', '%an', '%ae', '%at', '%s'].join('%x1f')

/** Parsea `git log --format=LOG_FORMAT`: un commit por línea. */
export function parseLog(output: string): CommitInfo[] {
  const commits: CommitInfo[] = []
  for (const line of output.split('\n')) {
    if (!line) continue
    const [sha, parents, authorName, authorEmail, authorDate, ...subject] = line.split(FIELD)
    commits.push({
      sha,
      parents: parents ? parents.split(' ') : [],
      authorName,
      authorEmail,
      authorDate: Number(authorDate),
      subject: subject.join(FIELD).replace(/\r$/, '')
    })
  }
  return commits
}

export const DETAILS_FORMAT = ['%H', '%P', '%an', '%ae', '%at', '%cn', '%ce', '%ct', '%B'].join('%x1f')

/** Parsea `git show -s --format=DETAILS_FORMAT`. El mensaje completo va al final porque puede tener varias líneas. */
export function parseCommitHeader(output: string): Omit<CommitDetails, 'files'> {
  const [sha, parents, authorName, authorEmail, authorDate, committerName, committerEmail, committerDate, ...body] =
    output.split(FIELD)
  const message = body.join(FIELD).replace(/\r\n/g, '\n').trimEnd()
  return {
    sha: sha.trim(),
    parents: parents ? parents.split(' ') : [],
    authorName,
    authorEmail,
    authorDate: Number(authorDate),
    committerName,
    committerEmail,
    committerDate: Number(committerDate),
    message,
    subject: message.split('\n', 1)[0]
  }
}

/** Mismo criterio que usa Git: si hay un byte NUL al principio, es binario. */
export function looksBinary(content: Buffer): boolean {
  return content.subarray(0, 8000).includes(0)
}
