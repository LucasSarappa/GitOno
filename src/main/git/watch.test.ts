import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { RepoChange } from '../../shared/types'
import { classifyChange, watchRepo } from './watch'

describe('classifyChange', () => {
  it.each([
    ['src/app.ts', 'worktree'],
    ['src\\app.ts', 'worktree'],
    ['.git/index', 'worktree'],
    ['.git/HEAD', 'refs'],
    ['.git/refs/heads/main', 'refs'],
    ['.git\\refs\\remotes\\origin\\main', 'refs'],
    ['.git/packed-refs', 'refs'],
    ['.git/index.lock', null],
    ['.git/refs/heads/main.lock', null],
    ['.git/objects/ab/cdef', null],
    ['.git/logs/HEAD', null],
    ['.git', null],
    ['.gitignore', 'worktree']
  ])('%s → %s', (path, expected) => {
    expect(classifyChange(path)).toBe(expected)
  })
})

describe('watchRepo', () => {
  it('junta una ráfaga de cambios en un solo aviso, y "refs" tiene prioridad', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'gitono-watch-'))
    mkdirSync(join(dir, '.git', 'refs', 'heads'), { recursive: true })
    const changes: RepoChange[] = []
    const stop = watchRepo(dir, (change) => changes.push(change))
    try {
      writeFileSync(join(dir, 'a.txt'), '1')
      writeFileSync(join(dir, 'b.txt'), '2')
      writeFileSync(join(dir, '.git', 'refs', 'heads', 'main'), 'abc')
      await new Promise((r) => setTimeout(r, 800))
      expect(changes).toEqual(['refs'])
    } finally {
      stop()
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
