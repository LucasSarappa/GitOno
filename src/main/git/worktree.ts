// Cambios locales: estado de la carpeta de trabajo, preparar, quitar, descartar, parches y commit.

import { readFile, stat } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'
import type { FileContent, FileSource, PatchAction, WorkingArea, WorkingTreeStatus } from '../../shared/types'
import { looksBinary, parseStatus } from './parse'
import { MAX_FILE_BYTES, readBlob, readFileAtRef } from './repo'
import { git, GitError, gitText } from './run'

export async function workingStatus(root: string): Promise<WorkingTreeStatus> {
  // --no-optional-locks: status no reescribe el índice. Si lo hiciera, la app vería ese cambio
  // en el disco, volvería a pedir el estado y entraría en un ciclo.
  const output = await gitText(root, [
    '--no-optional-locks',
    'status',
    '--porcelain=v2',
    '--branch',
    '-z',
    '--untracked-files=all'
  ])
  return parseStatus(output)
}

export async function readSource(root: string, source: FileSource, path: string): Promise<FileContent> {
  if (source.kind === 'ref') return readFileAtRef(root, source.ref, path)
  if (source.kind === 'index') return readBlob(root, `:${path}`)
  return readWorktreeFile(root, path)
}

async function readWorktreeFile(root: string, path: string): Promise<FileContent> {
  const fullPath = insideRepo(root, path)
  let size: number
  try {
    const info = await stat(fullPath)
    if (!info.isFile()) return { kind: 'missing' }
    size = info.size
  } catch {
    return { kind: 'missing' }
  }
  if (size > MAX_FILE_BYTES) return { kind: 'too-large', size }
  const content = await readFile(fullPath)
  if (looksBinary(content)) return { kind: 'binary' }
  return { kind: 'text', text: new TextDecoder('utf-8').decode(content) }
}

/** Ruta absoluta de un archivo del repo. Rechaza rutas que intenten salir de la carpeta (ej. "../x"). */
export function insideRepo(root: string, path: string): string {
  const fullPath = resolve(root, path)
  const fromRoot = relative(resolve(root), fullPath)
  if (!fromRoot || fromRoot.startsWith('..') || isAbsolute(fromRoot)) {
    throw new GitError(`La ruta "${path}" está fuera del repositorio.`)
  }
  return fullPath
}

/** Diff unificado de un archivo, en el formato que entiende `git apply`. */
export async function workingDiff(root: string, path: string, area: WorkingArea): Promise<string> {
  const args = ['diff', '--no-color', '--no-ext-diff', '--src-prefix=a/', '--dst-prefix=b/', '-U3']
  if (area === 'staged') args.push('--cached')
  return gitText(root, [...args, '--', path])
}

// Las rutas se pasan por la entrada estándar separadas por NUL: así no hay límite de largo de la
// línea de comandos (en Windows son ~32.000 caracteres) ni problemas con caracteres raros.
const PATHS_FROM_STDIN = ['--pathspec-from-file=-', '--pathspec-file-nul']

const pathsInput = (paths: string[]) => paths.join('\0')

export async function stageFiles(root: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return
  // -A también prepara los archivos borrados.
  await git(root, ['add', '-A', ...PATHS_FROM_STDIN], { input: pathsInput(paths) })
}

export async function unstageFiles(root: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return
  const hasHead = await gitText(root, ['rev-parse', '-q', '--verify', 'HEAD^{commit}']).then(
    () => true,
    () => false
  )
  // Sin commits todavía no hay HEAD contra el cual restaurar: se sacan del índice.
  const args = hasHead ? ['restore', '--staged', ...PATHS_FROM_STDIN] : ['rm', '--cached', '-r', '-q', ...PATHS_FROM_STDIN]
  await git(root, args, { input: pathsInput(paths) })
}

/** Vuelve los archivos a como están en el índice (descarta los cambios sin preparar). */
export async function restoreWorktree(root: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return
  await git(root, ['restore', '--worktree', ...PATHS_FROM_STDIN], { input: pathsInput(paths) })
}

/**
 * Aplica un parche armado con `buildPatch`:
 *   stage    → al índice
 *   unstage  → al índice, al revés
 *   discard  → a la carpeta de trabajo, al revés
 * --recount hace que Git recalcule los números de cada bloque, que cambian al elegir líneas sueltas.
 */
export async function applyPatch(root: string, patch: string, action: PatchAction): Promise<void> {
  const args = ['apply', '--recount', '--whitespace=nowarn']
  if (action !== 'discard') args.push('--cached')
  if (action !== 'stage') args.push('--reverse')
  await git(root, [...args, '-'], { input: patch })
}

export async function commit(root: string, message: string, amend: boolean): Promise<string> {
  if (!message.trim()) throw new GitError('El mensaje del commit no puede estar vacío.')
  // --cleanup=whitespace: se respetan las líneas que empiezan con "#" (ej. "#123 corrige el login").
  const args = ['commit', '--file=-', '--cleanup=whitespace']
  if (amend) args.push('--amend')
  // Los hooks (pre-commit, por ejemplo) pueden tardar: se les da más tiempo.
  await git(root, args, { input: message, timeoutMs: 5 * 60_000 })
  return (await gitText(root, ['rev-parse', 'HEAD'])).trim()
}

export async function lastCommitMessage(root: string): Promise<string> {
  try {
    return (await gitText(root, ['log', '-1', '--no-show-signature', '--format=%B'])).replace(/\r\n/g, '\n').trimEnd()
  } catch {
    return '' // todavía no hay commits
  }
}
