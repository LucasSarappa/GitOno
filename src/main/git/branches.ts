// Linaje de una rama: de qué rama sale, en qué commit nace, qué commits son propios y si se
// mergeó, dónde y con qué commit. Es lo que la interfaz resalta en el gráfico.

import type { BranchInsight, RefKind } from '../../shared/types'
import { assertSafeRef, gitText } from './run'

/** Máximo de commits propios que se devuelven para resaltar (el total se cuenta aparte). */
const OWN_LIMIT = 2000

const shortName = (ref: string) => ref.replace(/^refs\/(heads|remotes|tags)\//, '')
const kindOf = (ref: string): RefKind => (ref.startsWith('refs/remotes/') ? 'remote' : ref.startsWith('refs/tags/') ? 'tag' : 'local')

const revParse = async (root: string, rev: string) => (await gitText(root, ['rev-parse', '--verify', `${rev}^{commit}`])).trim()
const exists = (root: string, ref: string) => revParse(root, ref).then(() => true, () => false)
const lines = (out: string) => out.split('\n').map((l) => l.trim()).filter(Boolean)

/** `git merge-base --is-ancestor` sale con 1 cuando no es ancestro: no es un error. */
const isAncestor = (root: string, commit: string, of: string) =>
  gitText(root, ['merge-base', '--is-ancestor', commit, of]).then(() => true, () => false)

/**
 * Rama principal del repo: la que apunta origin/HEAD o, si no hay, main, master, develop o trunk.
 * Se prefiere la copia local; si no existe, la remota.
 */
export async function defaultBranch(root: string): Promise<{ ref: string; name: string } | null> {
  const candidates: string[] = []
  const originHead = await gitText(root, ['symbolic-ref', '-q', 'refs/remotes/origin/HEAD']).then((o) => o.trim(), () => '')
  if (originHead) candidates.push(`refs/heads/${originHead.slice('refs/remotes/origin/'.length)}`, originHead)
  for (const name of ['main', 'master', 'develop', 'trunk']) candidates.push(`refs/heads/${name}`, `refs/remotes/origin/${name}`)
  for (const ref of candidates) if (await exists(root, ref)) return { ref, name: shortName(ref) }
  return null
}

/** Del reflog de una rama local: "branch: Created from main" y la fecha. */
async function creationFromReflog(root: string, ref: string): Promise<BranchInsight['created']> {
  const out = await gitText(root, ['reflog', 'show', '--format=%gs%x1f%ct', ref, '--']).catch(() => '')
  const oldest = lines(out).at(-1)
  if (!oldest) return null
  const [message, date] = oldest.split('\x1f')
  const match = /^branch: Created from (.+)$/.exec(message)
  if (!match) return null
  const createdAt = Number(date)
  // Con `checkout -b` o `git branch` sin punto de partida, Git anota "Created from HEAD":
  // se averigua en qué rama estaba HEAD en ese momento.
  const from = match[1] === 'HEAD' ? await branchAtHead(root, shortName(ref), createdAt) : match[1]
  return { from, date: createdAt }
}

/** Rama en la que estaba HEAD cuando se creó `branch`, según el reflog de HEAD. */
async function branchAtHead(root: string, branch: string, createdAt: number): Promise<string> {
  const out = await gitText(root, ['reflog', 'show', '--format=%gs%x1f%ct', 'HEAD', '--']).catch(() => '')
  // El reflog viene del más nuevo al más viejo.
  const moves = lines(out).flatMap((line) => {
    const [message, date] = line.split('\x1f')
    const match = /^checkout: moving from (.+) to (.+)$/.exec(message)
    return match ? [{ from: match[1], to: match[2], date: Number(date) }] : []
  })
  // Creada con `checkout -b` o `switch -c`: el cambio hacia la rama nueva dice de dónde venía.
  const creation = [...moves].reverse().find((m) => m.to === branch && m.date >= createdAt)
  if (creation) return creation.from
  // Creada con `git branch`: la última rama a la que se cambió antes de ese momento.
  return moves.find((m) => m.date <= createdAt)?.to ?? 'HEAD'
}

export async function branchInsight(root: string, ref: string): Promise<BranchInsight> {
  assertSafeRef(ref)
  const [tip, base, created] = await Promise.all([
    revParse(root, ref),
    defaultBranch(root),
    ref.startsWith('refs/heads/') ? creationFromReflog(root, ref) : Promise.resolve(null)
  ])
  const insight: BranchInsight = {
    ref,
    name: shortName(ref),
    kind: kindOf(ref),
    tip,
    base,
    isBase: false,
    forkPoint: null,
    ownCommits: [],
    ownCount: 0,
    behind: 0,
    merge: null,
    created
  }
  // La rama principal (o su copia remota) no tiene "origen": es la referencia de las demás.
  if (!base || ref === base.ref || shortName(ref).replace(/^[^/]+\//, '') === base.name.replace(/^[^/]+\//, '')) {
    insight.isBase = base !== null
    return insight
  }

  const baseTip = await revParse(root, base.ref)
  const count = async (range: string[]) => Number((await gitText(root, ['rev-list', '--count', ...range, '--'])).trim())
  const list = async (range: string[]) => lines(await gitText(root, ['rev-list', `--max-count=${OWN_LIMIT}`, ...range, '--']))

  insight.behind = await count([`${tip}..${baseTip}`])

  if (tip === baseTip) {
    // Recién creada: todavía no tiene commits propios.
    insight.forkPoint = tip
    return insight
  }

  if (await isAncestor(root, tip, baseTip)) {
    // Ya está integrada en la base: se busca el primer merge en el camino de la punta a la base.
    const [mergeSha] = lines(await gitText(root, ['rev-list', '--ancestry-path', '--merges', '--reverse', `${tip}..${baseTip}`, '--']))
    if (!mergeSha) {
      insight.merge = { kind: 'fast-forward' }
      return insight
    }
    const parents = lines((await gitText(root, ['rev-list', '--parents', '-n', '1', mergeSha, '--'])).replace(/\s+/g, '\n')).slice(1)
    const subject = (await gitText(root, ['log', '-1', '--no-show-signature', '--format=%s', mergeSha, '--'])).trim()
    const beforeMerge = parents[0]
    // Commits que trajo la rama: los de la punta que la base no tenía antes del merge.
    insight.ownCommits = await list([tip, `^${beforeMerge}`])
    insight.ownCount = await count([tip, `^${beforeMerge}`])
    insight.forkPoint = (await gitText(root, ['merge-base', beforeMerge, tip])).trim() || null
    insight.merge = { kind: 'merge-commit', sha: mergeSha, subject }
    return insight
  }

  // Sin mergear: punto de partida según el reflog de la base y, si no alcanza, el ancestro común.
  const forkPoint = await gitText(root, ['merge-base', '--fork-point', base.ref, tip]).then(
    (o) => o.trim(),
    () => ''
  )
  insight.forkPoint = forkPoint || (await gitText(root, ['merge-base', baseTip, tip]).then((o) => o.trim(), () => '')) || null
  insight.ownCommits = await list([`${baseTip}..${tip}`])
  insight.ownCount = await count([`${baseTip}..${tip}`])
  return insight
}

/** Ramas (locales y remotas) que contienen un commit. */
export async function branchesContaining(root: string, sha: string): Promise<string[]> {
  assertSafeRef(sha)
  const out = await gitText(root, ['for-each-ref', `--contains=${sha}`, '--format=%(refname)', 'refs/heads', 'refs/remotes'])
  return lines(out)
    .filter((ref) => !(ref.startsWith('refs/remotes/') && ref.endsWith('/HEAD')))
    .map(shortName)
}
