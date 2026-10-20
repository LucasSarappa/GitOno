// Núcleo Git: todo lo que funciona igual sin importar la plataforma (GitHub, GitLab, etc.).
// Las ramas se leen directo de la base de datos de Git, sin checkout ni segundo clon.

import { basename } from 'node:path'
import type { CompareResult, FileChange, FileContent, RefList, RepoInfo } from '../../shared/types'
import { detectProvider } from '../providers'
import { looksBinary, parseNameStatus, parseNumstat, parseRefs } from './parse'
import { assertSafeRef, git, GitError, gitText } from './run'

/** Archivos más grandes que esto no se muestran en el visor. */
export const MAX_FILE_BYTES = 5 * 1024 * 1024

export async function openRepo(path: string): Promise<RepoInfo> {
  let root: string
  try {
    root = (await gitText(path, ['rev-parse', '--show-toplevel'])).trim()
  } catch (error) {
    if (error instanceof GitError && /not a git repository/i.test(error.stderr)) {
      throw new GitError('La carpeta elegida no es un repositorio Git.')
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
  const [refsOutput, current] = await Promise.all([
    gitText(root, [
      'for-each-ref',
      '--sort=-committerdate',
      '--format=%(refname)%09%(refname:short)',
      'refs/heads',
      'refs/remotes',
      'refs/tags'
    ]),
    // Sale con error si HEAD está desacoplado (detached); en ese caso no hay rama actual.
    gitText(root, ['symbolic-ref', '-q', 'HEAD']).then(
      (out) => out.trim() || null,
      () => null
    )
  ])
  return { current, refs: parseRefs(refsOutput) }
}

export async function fetchAll(root: string): Promise<void> {
  await git(root, ['fetch', '--all', '--prune'], { timeoutMs: 5 * 60_000 })
}

/** Compara el contenido de A contra B, como si fueran dos carpetas. */
export async function compareRefs(root: string, refA: string, refB: string): Promise<CompareResult> {
  assertSafeRef(refA)
  assertSafeRef(refB)
  const diffArgs = ['-M', '--no-color', '--no-ext-diff', refA, refB, '--']
  const [nameStatus, numstat, counts] = await Promise.all([
    gitText(root, ['diff', '--name-status', '-z', ...diffArgs]),
    gitText(root, ['diff', '--numstat', '-z', ...diffArgs]),
    gitText(root, ['rev-list', '--left-right', '--count', `${refA}...${refB}`, '--'])
  ])

  const lineCounts = parseNumstat(numstat)
  const files: FileChange[] = parseNameStatus(nameStatus).map((entry) => {
    const lines = lineCounts.get(entry.path) ?? { additions: null, deletions: null }
    return { ...entry, ...lines }
  })
  files.sort((a, b) => a.path.localeCompare(b.path))

  const [onlyInA, onlyInB] = counts.trim().split(/\s+/).map(Number)
  return { files, commitsOnlyInA: onlyInA || 0, commitsOnlyInB: onlyInB || 0 }
}

/** Lee un archivo tal como está guardado en `ref`, sin tocar la carpeta de trabajo. */
export async function readFileAtRef(root: string, ref: string, path: string): Promise<FileContent> {
  assertSafeRef(ref)
  const spec = `${ref}:${path}`

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
