// Historial y detalle de commits contra un repositorio real con ramas, un merge y un tag anotado.

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { commitDetails, listCommits, listRefs } from './repo'

let dir: string
let clock = 1_700_000_000

/** Ejecuta git con fechas fijas y crecientes, para que el orden del historial sea predecible. */
function sh(...args: string[]): string {
  clock += 60
  const date = `${clock} +0000`
  return execFileSync('git', args, {
    cwd: dir,
    stdio: 'pipe',
    env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date }
  })
    .toString()
    .trim()
}

const sha = (ref: string) => sh('rev-parse', ref)

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'gitono-log-'))
  sh('init', '-q', '-b', 'main')
  sh('config', 'user.name', 'Ana')
  sh('config', 'user.email', 'ana@example.com')
  sh('config', 'commit.gpgsign', 'false')
  sh('config', 'tag.gpgsign', 'false')

  writeFileSync(join(dir, 'a.txt'), 'uno\n')
  sh('add', '.')
  sh('commit', '-q', '-m', 'inicial')

  sh('checkout', '-q', '-b', 'feature')
  writeFileSync(join(dir, 'b.txt'), 'nuevo\n')
  sh('add', '.')
  sh('commit', '-q', '-m', 'agrega b')

  sh('checkout', '-q', 'main')
  writeFileSync(join(dir, 'a.txt'), 'uno\ndos\n')
  sh('commit', '-q', '-am', 'cambia a', '-m', 'Explicación más larga\nen dos líneas.')
  sh('tag', '-a', 'v1', '-m', 'versión 1')
  sh('merge', '-q', '--no-ff', 'feature', '-m', 'merge de feature')
})

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('historial', () => {
  it('lista los commits de todas las ramas, de más nuevo a más viejo', async () => {
    const page = await listCommits(dir, 100)
    expect(page.hasMore).toBe(false)
    expect(page.commits.map((c) => c.subject)).toEqual(['merge de feature', 'cambia a', 'agrega b', 'inicial'])
    const [merge] = page.commits
    expect(merge.parents).toEqual([sha('HEAD^1'), sha('feature')])
    expect(merge.authorName).toBe('Ana')
  })

  it('respeta el límite y avisa si hay más', async () => {
    const page = await listCommits(dir, 2)
    expect(page.commits).toHaveLength(2)
    expect(page.hasMore).toBe(true)
  })

  it('las referencias saben a qué commit apuntan (también los tags anotados)', async () => {
    const refs = await listRefs(dir)
    expect(refs.head).toBe(sha('HEAD'))
    expect(refs.refs.find((r) => r.name === 'v1')?.target).toBe(sha('v1^{commit}'))
    expect(refs.refs.find((r) => r.name === 'feature')?.target).toBe(sha('feature'))
  })

  it('devuelve una lista vacía en un repo sin commits', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'gitono-vacio-'))
    try {
      execFileSync('git', ['init', '-q'], { cwd: empty })
      expect(await listCommits(empty, 10)).toEqual({ commits: [], hasMore: false })
    } finally {
      rmSync(empty, { recursive: true, force: true })
    }
  })
})

describe('detalle de un commit', () => {
  it('trae el mensaje completo y los archivos cambiados', async () => {
    const details = await commitDetails(dir, sha('v1'))
    expect(details.subject).toBe('cambia a')
    expect(details.message).toBe('cambia a\n\nExplicación más larga\nen dos líneas.')
    expect(details.files).toEqual([{ status: 'modified', path: 'a.txt', additions: 1, deletions: 0 }])
  })

  it('el primer commit muestra todos sus archivos como nuevos', async () => {
    const root = sh('rev-list', '--max-parents=0', 'HEAD')
    const details = await commitDetails(dir, root)
    expect(details.parents).toEqual([])
    expect(details.files).toEqual([{ status: 'added', path: 'a.txt', additions: 1, deletions: 0 }])
  })

  it('un merge se compara contra su primer padre', async () => {
    const details = await commitDetails(dir, sha('HEAD'))
    expect(details.parents).toHaveLength(2)
    expect(details.files).toEqual([{ status: 'added', path: 'b.txt', additions: 1, deletions: 0 }])
  })
})
