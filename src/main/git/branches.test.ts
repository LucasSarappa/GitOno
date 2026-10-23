// Linaje de ramas contra un repositorio real: mergeada con commit de merge, por avance rápido,
// sin mergear, recién creada y la rama principal.

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { branchInsight, branchesContaining, defaultBranch } from './branches'

let dir: string
let clock = 1_700_000_000

function sh(...args: string[]): string {
  clock += 60
  const date = `${clock} +0000`
  return execFileSync('git', args, { cwd: dir, stdio: 'pipe', env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } })
    .toString()
    .trim()
}
const commit = (file: string, message: string) => {
  writeFileSync(join(dir, file), `${message}\n`)
  sh('add', '.')
  sh('commit', '-q', '-m', message)
  return sh('rev-parse', 'HEAD')
}

const shas: Record<string, string> = {}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'gitono-branches-'))
  sh('init', '-q', '-b', 'main')
  sh('config', 'user.name', 'Ana')
  sh('config', 'user.email', 'ana@example.com')
  sh('config', 'commit.gpgsign', 'false')

  shas.c1 = commit('a.txt', 'c1')
  sh('checkout', '-q', '-b', 'feature')
  shas.f1 = commit('f.txt', 'f1')
  shas.f2 = commit('f.txt', 'f2')
  sh('checkout', '-q', 'main')
  shas.c2 = commit('a.txt', 'c2')
  sh('merge', '-q', '--no-ff', 'feature', '-m', "Merge branch 'feature'")
  shas.merge = sh('rev-parse', 'HEAD')

  sh('checkout', '-q', '-b', 'rapida')
  shas.r1 = commit('r.txt', 'r1')
  sh('checkout', '-q', 'main')
  sh('merge', '-q', '--ff-only', 'rapida')

  sh('checkout', '-q', '-b', 'trabajo')
  shas.w1 = commit('w.txt', 'w1')
  sh('checkout', '-q', 'main')
  shas.c3 = commit('a.txt', 'c3')

  sh('branch', 'nueva')
})

afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('defaultBranch', () => {
  it('reconoce main como rama principal', async () => {
    expect(await defaultBranch(dir)).toEqual({ ref: 'refs/heads/main', name: 'main' })
  })
})

describe('branchInsight', () => {
  it('rama mergeada con commit de merge: sus commits, de dónde salió y dónde se mergeó', async () => {
    const insight = await branchInsight(dir, 'refs/heads/feature')
    expect(insight.merge).toEqual({ kind: 'merge-commit', sha: shas.merge, subject: "Merge branch 'feature'" })
    expect(insight.ownCommits).toEqual([shas.f2, shas.f1])
    expect(insight.ownCount).toBe(2)
    expect(insight.forkPoint).toBe(shas.c1)
    expect(insight.created).toMatchObject({ from: 'main' })
  })

  it('rama integrada por avance rápido (fast-forward)', async () => {
    const insight = await branchInsight(dir, 'refs/heads/rapida')
    expect(insight.merge).toEqual({ kind: 'fast-forward' })
  })

  it('rama sin mergear: commits propios y cuántos le faltan de la principal', async () => {
    const insight = await branchInsight(dir, 'refs/heads/trabajo')
    expect(insight.merge).toBeNull()
    expect(insight.ownCommits).toEqual([shas.w1])
    expect(insight.behind).toBe(1)
    expect(insight.forkPoint).toBe(sh('rev-parse', 'trabajo~1'))
  })

  it('rama recién creada, sin commits propios', async () => {
    const insight = await branchInsight(dir, 'refs/heads/nueva')
    expect(insight).toMatchObject({ ownCount: 0, merge: null, behind: 0, forkPoint: shas.c3 })
    // Creada con `git branch nueva` estando en main.
    expect(insight.created).toMatchObject({ from: 'main' })
  })

  it('la rama principal se marca como tal', async () => {
    expect(await branchInsight(dir, 'refs/heads/main')).toMatchObject({ isBase: true, ownCount: 0 })
  })
})

describe('branchesContaining', () => {
  it('lista las ramas que contienen un commit', async () => {
    expect((await branchesContaining(dir, shas.f1)).sort()).toEqual(['feature', 'main', 'nueva', 'rapida', 'trabajo'])
    expect(await branchesContaining(dir, shas.w1)).toEqual(['trabajo'])
  })
})
