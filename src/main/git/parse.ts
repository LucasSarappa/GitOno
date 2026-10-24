// Parsers de la salida de Git. Se usa siempre `-z` (separador NUL) para que las rutas
// con espacios, tildes o caracteres raros lleguen tal cual, sin comillas ni escapes.

import type { ChangeStatus, CommitDetails, CommitInfo, RefInfo, WorkingFile, WorkingTreeStatus } from '../../shared/types'

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

export const REFS_FORMAT = '%(refname)%09%(refname:short)%09%(objectname)%09%(*objectname)%09%(upstream)%09%(upstream:track,nobracket)'

/**
 * Parsea `git for-each-ref --format=REFS_FORMAT`. El cuarto campo solo viene en los tags
 * anotados: es el commit al que apunta el tag (el objectname es el del objeto tag). Los dos
 * últimos, solo en ramas locales que siguen una remota: cuál es y "ahead 1, behind 2" o "gone".
 */
export function parseRefs(output: string): RefInfo[] {
  const refs: RefInfo[] = []
  for (const line of output.split('\n')) {
    const [ref, name, objectName, peeled, upstream, track] = line.trim().split('\t')
    if (!ref || !name || !objectName) continue
    // origin/HEAD es solo un puntero a la rama por defecto del remoto
    if (ref.startsWith('refs/remotes/') && ref.endsWith('/HEAD')) continue
    const target = peeled || objectName
    if (ref.startsWith('refs/heads/')) refs.push({ ref, name, kind: 'local', target, ...parseTracking(upstream, track) })
    else if (ref.startsWith('refs/remotes/')) refs.push({ ref, name, kind: 'remote', target })
    else if (ref.startsWith('refs/tags/')) refs.push({ ref, name, kind: 'tag', target })
  }
  return refs
}

function parseTracking(upstream: string | undefined, track: string | undefined): Partial<RefInfo> {
  if (!upstream) return {}
  if (track === 'gone') return { upstream, upstreamGone: true }
  return {
    upstream,
    ahead: Number(/ahead (\d+)/.exec(track ?? '')?.[1] ?? 0),
    behind: Number(/behind (\d+)/.exec(track ?? '')?.[1] ?? 0)
  }
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

/**
 * Parsea `git status --porcelain=v2 --branch -z`. Cada entrada empieza con su tipo:
 *   "1 XY ... ruta"            cambio común
 *   "2 XY ... ruta\0origen"    renombre o copia (preparado)
 *   "u XY ... ruta"            conflicto de merge
 *   "? ruta"                   archivo nuevo sin seguimiento
 * X es el estado en el índice (preparado) e Y en la carpeta de trabajo; "." significa sin cambios.
 */
export function parseStatus(output: string): WorkingTreeStatus {
  const status: WorkingTreeStatus = {
    head: null,
    branch: null,
    staged: [],
    unstaged: [],
    conflicted: [],
    upstream: null,
    ahead: 0,
    behind: 0,
    operation: null
  }
  const tokens = output.split('\0')
  for (let i = 0; i < tokens.length; i++) {
    const entry = tokens[i]
    if (!entry) continue
    if (entry.startsWith('# branch.oid ')) {
      const oid = entry.slice('# branch.oid '.length)
      status.head = oid === '(initial)' ? null : oid
    } else if (entry.startsWith('# branch.head ')) {
      const name = entry.slice('# branch.head '.length)
      status.branch = name === '(detached)' ? null : name
    } else if (entry.startsWith('# branch.upstream ')) {
      status.upstream = entry.slice('# branch.upstream '.length)
    } else if (entry.startsWith('# branch.ab ')) {
      // "# branch.ab +2 -1": 2 commits para subir y 1 para bajar.
      const [ahead, behind] = entry.slice('# branch.ab '.length).split(' ')
      status.ahead = Math.abs(Number(ahead)) || 0
      status.behind = Math.abs(Number(behind)) || 0
    } else if (entry.startsWith('1 ')) {
      const fields = entry.split(' ')
      addChange(status, fields[1], fields.slice(8).join(' '))
    } else if (entry.startsWith('2 ')) {
      const fields = entry.split(' ')
      addChange(status, fields[1], fields.slice(9).join(' '), tokens[++i])
    } else if (entry.startsWith('u ')) {
      status.conflicted.push({ path: entry.split(' ').slice(10).join(' '), status: 'modified' })
    } else if (entry.startsWith('? ')) {
      status.unstaged.push({ path: entry.slice(2), status: 'added', untracked: true })
    }
  }
  return status
}

function addChange(status: WorkingTreeStatus, xy: string, path: string, oldPath?: string): void {
  const [inIndex, inWorktree] = xy
  if (inIndex !== '.') {
    const staged: WorkingFile = { path, status: STATUS_BY_LETTER[inIndex] ?? 'unknown' }
    if (oldPath && (inIndex === 'R' || inIndex === 'C')) staged.oldPath = oldPath
    status.staged.push(staged)
  }
  if (inWorktree !== '.') status.unstaged.push({ path, status: STATUS_BY_LETTER[inWorktree] ?? 'unknown' })
}
