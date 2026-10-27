// Núcleo Git: todo lo que funciona igual sin importar la plataforma (GitHub, GitLab, etc.).
// Las ramas se leen directo de la base de datos de Git, sin checkout ni segundo clon.

import { basename } from 'node:path'
import type {
  CommitDetails,
  CommitPage,
  CompareResult,
  FileChange,
  FileContent,
  GitProgress,
  GraphFilter,
  RefList,
  RepoInfo
} from '../../shared/types'
import { detectProvider } from '../providers'
import {
  DETAILS_FORMAT,
  LOG_FORMAT,
  looksBinary,
  parseCommitHeader,
  parseLog,
  parseNameStatus,
  parseNumstat,
  parseRefs,
  REFS_FORMAT
} from './parse'
import { progressReader } from './progress'
import { assertSafeRef, git, GitError, gitText } from './run'
import { t } from '../../shared/i18n'

/** Archivos más grandes que esto no se muestran en el visor. */
export const MAX_FILE_BYTES = 5 * 1024 * 1024

export async function openRepo(path: string): Promise<RepoInfo> {
  let root: string
  try {
    root = (await gitText(path, ['rev-parse', '--show-toplevel'])).trim()
  } catch (error) {
    if (error instanceof GitError && /not a git repository/i.test(error.stderr)) {
      throw new GitError(t('La carpeta elegida no es un repositorio Git.'))
    }
    throw error
  }
  const remoteUrl = await defaultRemoteUrl(root)
  return {
    root,
    name: basename(root),
    remoteUrl,
    provider: remoteUrl ? detectProvider(remoteUrl) : null
  }
}

/** URL de "origin", o del primer remoto si no hay "origin". */
async function defaultRemoteUrl(root: string): Promise<string | null> {
  const remotes = (await gitText(root, ['remote'])).split('\n').map((r) => r.trim()).filter(Boolean)
  const remote = remotes.includes('origin') ? 'origin' : remotes[0]
  if (!remote) return null
  return (await gitText(root, ['remote', 'get-url', remote])).trim() || null
}

export async function listRefs(root: string): Promise<RefList> {
  const [refsOutput, current, head] = await Promise.all([
    gitText(root, ['for-each-ref', '--sort=-committerdate', `--format=${REFS_FORMAT}`, 'refs/heads', 'refs/remotes', 'refs/tags']),
    // Sale con error si HEAD está desacoplado (detached); en ese caso no hay rama actual.
    gitText(root, ['symbolic-ref', '-q', 'HEAD']).then(
      (out) => out.trim() || null,
      () => null
    ),
    resolveHead(root)
  ])
  return { current, head, refs: parseRefs(refsOutput) }
}

/** SHA del commit actual, o null si el repo todavía no tiene commits. */
async function resolveHead(root: string): Promise<string | null> {
  return gitText(root, ['rev-parse', '-q', '--verify', 'HEAD^{commit}']).then(
    (out) => out.trim() || null,
    () => null
  )
}

export async function fetchAll(root: string, onProgress?: (progress: GitProgress) => void): Promise<void> {
  await git(root, ['fetch', '--all', '--prune', ...(onProgress ? ['--progress'] : [])], {
    timeoutMs: 5 * 60_000,
    onStderr: onProgress && progressReader(onProgress)
  })
}

/** Cuántos commits devuelve como máximo la búsqueda en el código. */
export const MAX_CODE_MATCHES = 2000

/**
 * Commits que agregan o quitan un texto en el código (git log -S). Busca en ramas,
 * remotas y tags, como el historial.
 */
export async function searchCode(root: string, text: string): Promise<string[]> {
  if (text.trim().length < 2) return []
  const output = await gitText(
    root,
    ['log', '--branches', '--remotes', '--tags', '--format=%H', `--max-count=${MAX_CODE_MATCHES}`, `-S${text}`, '--'],
    { timeoutMs: 2 * 60_000 }
  )
  return output.split('\n').map((l) => l.trim()).filter(Boolean)
}

/** Compara el contenido de A contra B, como si fueran dos carpetas. */
export async function compareRefs(root: string, refA: string, refB: string): Promise<CompareResult> {
  assertSafeRef(refA)
  assertSafeRef(refB)
  const [files, counts] = await Promise.all([
    changedFiles(root, ['diff'], [refA, refB]),
    gitText(root, ['rev-list', '--left-right', '--count', `${refA}...${refB}`, '--'])
  ])
  const [onlyInA, onlyInB] = counts.trim().split(/\s+/).map(Number)
  return { files, commitsOnlyInA: onlyInA || 0, commitsOnlyInB: onlyInB || 0 }
}

/** Archivos cambiados entre dos versiones, con las líneas agregadas y borradas de cada uno. */
async function changedFiles(root: string, command: string[], revs: string[]): Promise<FileChange[]> {
  const options = ['-z', '-M', '--no-color', '--no-ext-diff', ...revs, '--']
  const [nameStatus, numstat] = await Promise.all([
    gitText(root, [...command, '--name-status', ...options]),
    gitText(root, [...command, '--numstat', ...options])
  ])
  const lineCounts = parseNumstat(numstat)
  const files: FileChange[] = parseNameStatus(nameStatus).map((entry) => {
    const lines = lineCounts.get(entry.path) ?? { additions: null, deletions: null }
    return { ...entry, ...lines }
  })
  return files.sort((a, b) => a.path.localeCompare(b.path))
}

/** Límite de commits que se pueden pedir de una vez al cargar el historial. */
export const MAX_COMMITS = 50_000

/**
 * Historial de todas las ramas, remotas y tags, ordenado por fecha (los hijos siempre antes que los
 * padres). Con un filtro, se dejan afuera las ramas ocultas o se muestran solo las elegidas.
 */
export async function listCommits(root: string, limit: number, filter?: GraphFilter): Promise<CommitPage> {
  const count = Math.max(1, Math.min(Math.floor(limit), MAX_COMMITS))
  const head = await resolveHead(root)
  let revs: string[]
  let input: string | undefined
  if (filter && (filter.hidden.length > 0 || filter.solo.length > 0)) {
    // Las referencias a mostrar van por la entrada estándar: así no hay que escapar nombres raros.
    const refs = await visibleRefs(root, filter)
    if (refs.length === 0) return { commits: [], hasMore: false }
    revs = ['--stdin']
    input = refs.join('\n') + '\n'
  } else {
    // Se listan ramas, remotas y tags en vez de usar --all, para que los stashes no aparezcan como commits sueltos.
    revs = ['--branches', '--remotes', '--tags', ...(head ? ['HEAD'] : [])]
  }
  let output: string
  try {
    output = await gitText(
      root,
      ['log', ...revs, '--date-order', '--no-show-signature', `--max-count=${count + 1}`, `--format=${LOG_FORMAT}`, '--'],
      { input }
    )
  } catch (error) {
    if (!head) return { commits: [], hasMore: false } // repo recién creado, sin commits
    throw error
  }
  const commits = parseLog(output)
  return { commits: commits.slice(0, count), hasMore: commits.length > count }
}

/** Referencias que quedan a la vista con un filtro. HEAD se suma si no es una rama oculta. */
async function visibleRefs(root: string, filter: GraphFilter): Promise<string[]> {
  const { refs, current, head } = await listRefs(root)
  const all = refs.map((r) => r.ref)
  const solo = new Set(filter.solo)
  const hidden = new Set(filter.hidden)
  const shown = solo.size > 0 ? all.filter((r) => solo.has(r)) : all.filter((r) => !hidden.has(r))
  const headVisible = head && (current ? shown.includes(current) || (solo.size === 0 && !hidden.has(current)) : solo.size === 0)
  return headVisible ? [...shown, 'HEAD'] : shown
}

export async function commitDetails(root: string, sha: string): Promise<CommitDetails> {
  assertSafeRef(sha)
  // ^{commit} resuelve tags anotados al commit al que apuntan.
  const header = parseCommitHeader(
    await gitText(root, ['show', '-s', '--no-show-signature', `--format=${DETAILS_FORMAT}`, `${sha}^{commit}`, '--'])
  )
  // Se compara contra el primer padre. El primer commit del repo se compara contra un árbol vacío (--root).
  const revs = header.parents.length > 0 ? [header.parents[0], header.sha] : ['--root', header.sha]
  const files = await changedFiles(root, ['diff-tree', '-r', '--no-commit-id'], revs)
  return { ...header, files }
}

/** Lee un archivo tal como está guardado en `ref`, sin tocar la carpeta de trabajo. */
export async function readFileAtRef(root: string, ref: string, path: string): Promise<FileContent> {
  assertSafeRef(ref)
  return readBlob(root, `${ref}:${path}`)
}

/** Lee un objeto de Git a partir de su especificación (ej. "main:src/app.ts" o ":src/app.ts" para el índice). */
export async function readBlob(root: string, spec: string): Promise<FileContent> {
  let size: number
  try {
    size = Number((await gitText(root, ['cat-file', '-s', spec])).trim())
  } catch {
    return { kind: 'missing' }
  }
  if (size > MAX_FILE_BYTES) return { kind: 'too-large', size }

  const content = await git(root, ['cat-file', 'blob', spec])
  if (looksBinary(content)) return { kind: 'binary' }
  return { kind: 'text', text: new TextDecoder('utf-8').decode(content) }
}
