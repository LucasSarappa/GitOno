// Operaciones que cambian el repo: checkout, ramas, merge, rebase, cherry-pick, revert, reset,
// tags, stash, pull y push. Las ramas y tags llegan con el nombre completo (refs/heads/...).

import type { GitProgress, MergeMode, Outcome, PullMode, ResetMode, StashInfo } from '../../shared/types'
import { progressReader } from './progress'
import { assertSafeRef, git, GitError, gitText } from './run'
import { currentOperation } from './worktree'
import { t } from '../../shared/i18n'

/** Las operaciones con el servidor y los hooks pueden tardar bastante más que una lectura. */
const SLOW = { timeoutMs: 10 * 60_000 }

const LOCAL = 'refs/heads/'
const REMOTE = 'refs/remotes/'
const TAG = 'refs/tags/'

function localName(ref: string): string {
  if (!ref.startsWith(LOCAL)) throw new GitError(t('"{ref}" no es una rama local.', { ref }))
  const name = ref.slice(LOCAL.length)
  assertSafeRef(name)
  return name
}

function tagName(ref: string): string {
  if (!ref.startsWith(TAG)) throw new GitError(t('"{ref}" no es una etiqueta.', { ref }))
  const name = ref.slice(TAG.length)
  assertSafeRef(name)
  return name
}

async function refExists(root: string, ref: string): Promise<boolean> {
  return git(root, ['show-ref', '--verify', '--quiet', ref]).then(
    () => true,
    () => false
  )
}

async function resolveCommit(root: string, rev: string): Promise<string> {
  assertSafeRef(rev)
  return (await gitText(root, ['rev-parse', '--verify', `${rev}^{commit}`])).trim()
}

/** Valida un nombre de rama nuevo con las mismas reglas que Git (sin espacios, sin "..", etc.). */
async function checkBranchName(root: string, name: string): Promise<string> {
  const clean = name.trim()
  assertSafeRef(clean)
  try {
    return (await gitText(root, ['check-ref-format', '--branch', clean])).trim()
  } catch {
    throw new GitError(t('"{name}" no sirve como nombre de rama: no puede tener espacios, "..", "~", "^", ":", "?", "*" ni "[".', { name: clean }))
  }
}

async function checkTagName(root: string, name: string): Promise<string> {
  const clean = name.trim()
  assertSafeRef(clean)
  try {
    await git(root, ['check-ref-format', `${TAG}${clean}`])
  } catch {
    throw new GitError(t('"{name}" no sirve como nombre de etiqueta.', { name: clean }))
  }
  return clean
}

export async function listRemotes(root: string): Promise<string[]> {
  return (await gitText(root, ['remote'])).split('\n').map((r) => r.trim()).filter(Boolean)
}

/** Separa "refs/remotes/origin/feature/x" en remoto y rama. Los remotos pueden tener "/" en el nombre. */
async function splitRemoteRef(root: string, ref: string): Promise<{ remote: string; branch: string }> {
  if (!ref.startsWith(REMOTE)) throw new GitError(t('"{ref}" no es una rama remota.', { ref }))
  const rest = ref.slice(REMOTE.length)
  const remote = (await listRemotes(root)).filter((r) => rest.startsWith(`${r}/`)).sort((a, b) => b.length - a.length)[0]
  if (!remote) throw new GitError(t('No se encontró el remoto de "{name}".', { name: rest }))
  return { remote, branch: rest.slice(remote.length + 1) }
}

/**
 * Checkout de:
 * - una rama local;
 * - una remota: si ya hay una local con el mismo nombre se usa esa; si no, se crea una que la siga;
 * - un tag o un SHA: el repo queda en HEAD desacoplado.
 * Devuelve la rama local en la que quedó el repo, o null si quedó desacoplado.
 */
export async function checkout(root: string, target: string): Promise<string | null> {
  assertSafeRef(target)
  if (target.startsWith(LOCAL)) {
    await git(root, ['switch', '--no-guess', localName(target)])
    return target
  }
  if (target.startsWith(REMOTE)) {
    const { branch } = await splitRemoteRef(root, target)
    const local = `${LOCAL}${branch}`
    if (await refExists(root, local)) {
      await git(root, ['switch', '--no-guess', branch])
    } else {
      await git(root, ['switch', '--create', await checkBranchName(root, branch), '--track', target])
    }
    return local
  }
  await git(root, ['switch', '--detach', await resolveCommit(root, target)])
  return null
}

export async function createBranch(root: string, name: string, startPoint: string, switchTo: boolean): Promise<string> {
  const branch = await checkBranchName(root, name)
  if (await refExists(root, `${LOCAL}${branch}`)) throw new GitError(t('Ya existe una rama "{name}".', { name: branch }))
  const start = await resolveCommit(root, startPoint)
  await git(root, switchTo ? ['switch', '--create', branch, start] : ['branch', branch, start])
  return `${LOCAL}${branch}`
}

export async function renameBranch(root: string, ref: string, newName: string): Promise<string> {
  const branch = await checkBranchName(root, newName)
  if (await refExists(root, `${LOCAL}${branch}`)) throw new GitError(t('Ya existe una rama "{name}".', { name: branch }))
  await git(root, ['branch', '--move', localName(ref), branch])
  return `${LOCAL}${branch}`
}

/** Borra una rama local. Sin force, Git se niega si tiene commits que no están en otra rama. */
export async function deleteBranch(root: string, ref: string, force: boolean): Promise<string> {
  const sha = await resolveCommit(root, ref)
  try {
    await git(root, ['branch', force ? '-D' : '-d', localName(ref)])
  } catch (error) {
    // La interfaz reconoce este mensaje para ofrecer borrarla igual (NOT_MERGED en lib/actions.ts).
    if (error instanceof GitError && /not fully merged/i.test(error.stderr)) {
      throw new GitError(t('La rama "{name}" tiene commits que no están en otra rama.', { name: localName(ref) }))
    }
    throw error
  }
  return sha
}

export async function deleteRemoteBranch(root: string, ref: string): Promise<string> {
  const sha = await resolveCommit(root, ref)
  const { remote, branch } = await splitRemoteRef(root, ref)
  await git(root, ['push', remote, '--delete', `${LOCAL}${branch}`], SLOW)
  return sha
}

/** Hace que una rama local siga una remota, o deje de seguir (upstream null). */
export async function setUpstream(root: string, ref: string, upstream: string | null): Promise<void> {
  const branch = localName(ref)
  if (upstream === null) {
    await git(root, ['branch', '--unset-upstream', branch])
    return
  }
  assertSafeRef(upstream)
  if (!upstream.startsWith(REMOTE)) throw new GitError(t('"{ref}" no es una rama remota.', { ref: upstream }))
  await git(root, ['branch', `--set-upstream-to=${upstream}`, branch])
}

/** Rama actual (refs/heads/...), o null con HEAD desacoplado. */
async function currentBranch(root: string): Promise<string | null> {
  return gitText(root, ['symbolic-ref', '-q', 'HEAD']).then(
    (out) => out.trim() || null,
    () => null
  )
}

/**
 * Avanza `ref` hasta `to` solo si es avance rápido. Si la rama es la actual se usa merge --ff-only
 * (actualiza la carpeta de trabajo); si no, se mueve la rama sin cambiar de rama.
 */
export async function fastForward(root: string, ref: string, to: string): Promise<void> {
  localName(ref)
  const [from, target] = await Promise.all([resolveCommit(root, ref), resolveCommit(root, to)])
  const isFastForward = await git(root, ['merge-base', '--is-ancestor', from, target]).then(
    () => true,
    () => false
  )
  if (!isFastForward) throw new GitError(t('No se puede avanzar la rama: tiene commits propios (no es un avance rápido).'))
  if ((await currentBranch(root)) === ref) {
    await git(root, ['merge', '--ff-only', target])
    return
  }
  // Con el valor viejo, update-ref falla si la rama cambió en el medio.
  await git(root, ['update-ref', '-m', `GitOno: avance rápido a ${to}`, ref, target, from])
}

/**
 * Corre una operación que puede frenarse por conflictos. Si Git falla pero dejó la operación a
 * medio hacer o archivos en conflicto, no es un error: el usuario los resuelve y continúa.
 */
async function withConflicts(root: string, run: () => Promise<unknown>): Promise<Outcome> {
  try {
    await run()
    return 'done'
  } catch (error) {
    if (await hasConflicts(root)) return 'conflicts'
    throw error
  }
}

async function hasConflicts(root: string): Promise<boolean> {
  const unmerged = await gitText(root, ['diff', '--name-only', '--diff-filter=U']).catch(() => '')
  return unmerged.trim() !== '' || (await currentOperation(root)) !== null
}

/**
 * Nombre a pasarle a merge o rebase: el corto ("feature", "origin/feature") si no es ambiguo, así Git
 * escribe el mensaje de siempre ("Merge branch 'feature'"); si no, el completo.
 */
async function revisionName(root: string, ref: string): Promise<string> {
  assertSafeRef(ref)
  const prefix = [LOCAL, REMOTE, TAG].find((p) => ref.startsWith(p))
  if (!prefix) return ref
  const short = ref.slice(prefix.length)
  assertSafeRef(short)
  const resolved = await gitText(root, ['rev-parse', '--symbolic-full-name', short]).then(
    (out) => out.trim(),
    () => ''
  )
  return resolved === ref ? short : ref
}

export async function merge(root: string, ref: string, mode: MergeMode): Promise<Outcome> {
  const name = await revisionName(root, ref)
  const flags = { default: [], 'no-ff': ['--no-ff'], 'ff-only': ['--ff-only'] }[mode]
  return withConflicts(root, () => git(root, ['merge', '--no-edit', ...flags, name], SLOW))
}

export async function rebase(root: string, onto: string): Promise<Outcome> {
  const name = await revisionName(root, onto)
  return withConflicts(root, () => git(root, ['rebase', name], SLOW))
}

async function isMergeCommit(root: string, sha: string): Promise<boolean> {
  const parents = (await gitText(root, ['rev-list', '--parents', '-n', '1', sha])).trim().split(' ')
  return parents.length > 2
}

/** De un commit de merge se toman los cambios respecto del primer padre (la rama donde se mergeó). */
const mainline = async (root: string, sha: string) => ((await isMergeCommit(root, sha)) ? ['-m', '1'] : [])

export async function cherryPick(root: string, sha: string): Promise<Outcome> {
  const commit = await resolveCommit(root, sha)
  const flags = await mainline(root, commit)
  return withConflicts(root, () => git(root, ['cherry-pick', ...flags, commit], SLOW))
}

export async function revert(root: string, sha: string): Promise<Outcome> {
  const commit = await resolveCommit(root, sha)
  const flags = await mainline(root, commit)
  return withConflicts(root, () => git(root, ['revert', '--no-edit', ...flags, commit], SLOW))
}

export async function reset(root: string, sha: string, mode: ResetMode): Promise<void> {
  const commit = await resolveCommit(root, sha)
  await git(root, ['reset', `--${mode}`, commit])
}

/** Sigue la operación a medio hacer, después de resolver los conflictos (y prepararlos). */
export async function continueOperation(root: string): Promise<Outcome> {
  const operation = await currentOperation(root)
  if (!operation) throw new GitError(t('No hay ninguna operación a medio hacer.'))
  const unmerged = (await gitText(root, ['diff', '--name-only', '--diff-filter=U'])).trim()
  if (unmerged) throw new GitError(t('Todavía hay archivos con conflictos. Resolvelos y preparalos antes de continuar.'))
  if (operation === 'merge') {
    // Se commitea con el mensaje que preparó Git ("Merge branch ..."). strip saca las líneas de
    // comentario ("# Conflicts: ...") como cuando se confirma desde el editor.
    return withConflicts(root, () => git(root, ['commit', '--no-edit', '--cleanup=strip'], SLOW))
  }
  return withConflicts(root, () => git(root, [operation, '--continue'], SLOW))
}

export async function abortOperation(root: string): Promise<void> {
  const operation = await currentOperation(root)
  if (!operation) throw new GitError(t('No hay ninguna operación a medio hacer.'))
  await git(root, [operation, '--abort'])
}

// ---------- Tags ----------

/** Crea un tag liviano o, con mensaje, uno anotado. */
export async function createTag(root: string, name: string, sha: string, message: string | null): Promise<string> {
  const tag = await checkTagName(root, name)
  if (await refExists(root, `${TAG}${tag}`)) throw new GitError(t('Ya existe una etiqueta "{name}".', { name: tag }))
  const commit = await resolveCommit(root, sha)
  if (message?.trim()) await git(root, ['tag', '--annotate', '--file=-', tag, commit], { input: message })
  else await git(root, ['tag', tag, commit])
  return `${TAG}${tag}`
}

/** Borra un tag local y devuelve el commit al que apuntaba. */
export async function deleteTag(root: string, ref: string): Promise<string> {
  const sha = await resolveCommit(root, ref)
  await git(root, ['tag', '--delete', tagName(ref)])
  return sha
}

async function assertRemote(root: string, remote: string): Promise<void> {
  if (!(await listRemotes(root)).includes(remote)) throw new GitError(t('No existe el remoto "{name}".', { name: remote }))
}

export async function pushTag(root: string, ref: string, remote: string): Promise<void> {
  tagName(ref)
  await assertRemote(root, remote)
  await git(root, ['push', remote, `${ref}:${ref}`], SLOW)
}

export async function deleteRemoteTag(root: string, ref: string, remote: string): Promise<void> {
  tagName(ref)
  await assertRemote(root, remote)
  await git(root, ['push', remote, '--delete', ref], SLOW)
}

// ---------- Servidor ----------

type OnProgress = (progress: GitProgress) => void

/** Opciones para correr un comando con el servidor mostrando su progreso. */
const withProgress = (onProgress?: OnProgress) => ({ ...SLOW, onStderr: onProgress && progressReader(onProgress) })
const progressFlag = (onProgress?: OnProgress) => (onProgress ? ['--progress'] : [])

export async function pull(root: string, mode: PullMode, onProgress?: OnProgress): Promise<Outcome> {
  const branch = await currentBranch(root)
  if (!branch) throw new GitError(t('Con HEAD desacoplado no hay rama para traer cambios. Cambiá a una rama.'))
  const upstream = await gitText(root, ['for-each-ref', '--format=%(upstream)', branch]).then((o) => o.trim())
  if (!upstream) throw new GitError(t('La rama "{name}" no sigue ninguna rama remota. Publicala con Subir o elegí cuál seguir.', { name: localName(branch) }))
  const flags = { 'ff-or-merge': ['--no-rebase', '--ff'], 'ff-only': ['--ff-only'], rebase: ['--rebase'] }[mode]
  return withConflicts(root, () => git(root, ['pull', '--no-edit', ...progressFlag(onProgress), ...flags], withProgress(onProgress)))
}

/**
 * Sube una rama local. Si sigue una remota, sube a esa; si no, la publica con el mismo nombre en
 * origin (o en el único remoto que haya) y la deja siguiéndola. Con force se usa
 * --force-with-lease: no pisa commits del servidor que este repo todavía no vio.
 */
export async function push(root: string, ref: string, force: boolean, onProgress?: OnProgress): Promise<void> {
  const branch = localName(ref)
  const [remoteName, remoteRef] = (
    await gitText(root, ['for-each-ref', '--format=%(upstream:remotename)%09%(upstream:remoteref)', ref])
  )
    .trim()
    .split('\t')
  const flags = [...(force ? ['--force-with-lease'] : []), ...progressFlag(onProgress)]
  if (remoteName && remoteRef) {
    await git(root, ['push', ...flags, remoteName, `${ref}:${remoteRef}`], withProgress(onProgress))
    return
  }
  const remotes = await listRemotes(root)
  const remote = remotes.includes('origin') ? 'origin' : remotes[0]
  if (!remote) throw new GitError(t('Este repo no tiene remotos a donde subir la rama.'))
  await git(root, ['push', ...flags, '--set-upstream', remote, `${ref}:${LOCAL}${branch}`], withProgress(onProgress))
}

// ---------- Stash ----------

const FIELD = '\x1f'

export async function listStashes(root: string): Promise<StashInfo[]> {
  const output = await gitText(root, ['stash', 'list', `--format=%gd%x1f%H%x1f%P%x1f%ct%x1f%gs`]).catch(() => '')
  const stashes: StashInfo[] = []
  for (const line of output.split('\n')) {
    const [selector, sha, parents, date, subject] = line.split(FIELD)
    const index = Number(/\{(\d+)\}/.exec(selector ?? '')?.[1])
    if (!sha || Number.isNaN(index)) continue
    stashes.push({ index, sha, base: parents.split(' ')[0] ?? '', message: subject?.trim() ?? '', date: Number(date) })
  }
  return stashes
}

const stashRef = (index: number) => {
  if (!Number.isInteger(index) || index < 0) throw new GitError(t('Cambios guardados inválidos.'))
  return `stash@{${index}}`
}

/** Guarda los cambios sin commitear, incluidos los archivos nuevos. */
export async function stash(root: string, message: string): Promise<boolean> {
  const before = (await listStashes(root)).length
  const args = ['stash', 'push', '--include-untracked']
  if (message.trim()) args.push('--message', message.trim())
  await git(root, args)
  return (await listStashes(root)).length > before
}

export async function applyStash(root: string, index: number, pop: boolean): Promise<Outcome> {
  const ref = stashRef(index)
  // Si hay conflictos, pop no borra el stash: queda para volver a intentarlo.
  return withConflicts(root, () => git(root, ['stash', pop ? 'pop' : 'apply', ref]))
}

export async function dropStash(root: string, index: number): Promise<string> {
  const ref = stashRef(index)
  const sha = await resolveCommit(root, ref)
  await git(root, ['stash', 'drop', ref])
  return sha
}

export async function restoreStash(root: string, sha: string, message: string): Promise<void> {
  const commit = await resolveCommit(root, sha)
  await git(root, ['stash', 'store', '--message', message || 'Stash recuperado', commit])
}

/**
 * Cambia el mensaje de un stash. Git no lo permite directo: se borra y se vuelve a guardar (queda
 * primero en la lista). Primero se borra porque, si es el de arriba, guardarlo de nuevo no agrega nada.
 */
export async function renameStash(root: string, index: number, message: string): Promise<void> {
  const ref = stashRef(index)
  const sha = await resolveCommit(root, ref)
  const old = (await listStashes(root)).find((s) => s.index === index)?.message ?? 'Stash'
  await git(root, ['stash', 'drop', ref])
  try {
    await git(root, ['stash', 'store', '--message', message.trim() || 'Stash', sha])
  } catch (error) {
    await git(root, ['stash', 'store', '--message', old, sha]).catch(() => undefined)
    throw error
  }
}

/** Un commit en formato de parche, para guardarlo como archivo. */
export async function formatPatch(root: string, sha: string): Promise<{ name: string; patch: Buffer }> {
  const commit = await resolveCommit(root, sha)
  const subject = (await gitText(root, ['log', '-1', '--format=%f', commit])).trim()
  const patch = await git(root, ['format-patch', '-1', '--stdout', commit])
  return { name: `${commit.slice(0, 7)}-${subject || 'commit'}.patch`, patch }
}
