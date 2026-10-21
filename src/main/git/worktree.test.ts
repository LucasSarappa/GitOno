// Cambios locales contra repositorios reales: estado, preparar, parches por bloque y por línea, commit.

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildPatch, parseFileDiff, wholeHunk } from '../../shared/patch'
import {
  applyPatch,
  commit,
  insideRepo,
  lastCommitMessage,
  readSource,
  restoreWorktree,
  stageFiles,
  unstageFiles,
  workingDiff,
  workingStatus
} from './worktree'

let dir: string

const sh = (...args: string[]) => execFileSync('git', args, { cwd: dir, stdio: 'pipe' }).toString()
const write = (path: string, content: string) => writeFileSync(join(dir, path), content)
const read = (path: string) => readFileSync(join(dir, path), 'utf8')
const lines = (count: number, change: Record<number, string> = {}) =>
  Array.from({ length: count }, (_, i) => change[i + 1] ?? `línea ${i + 1}`).join('\n') + '\n'

function newRepo(config: Record<string, string> = {}) {
  dir = mkdtempSync(join(tmpdir(), 'gitono-wt-'))
  sh('init', '-q', '-b', 'main')
  sh('config', 'user.name', 'Ana')
  sh('config', 'user.email', 'ana@example.com')
  sh('config', 'commit.gpgsign', 'false')
  for (const [key, value] of Object.entries(config)) sh('config', key, value)
}

afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('estado de la carpeta de trabajo', () => {
  beforeEach(() => {
    newRepo()
    write('app.txt', lines(5))
    write('viejo.txt', 'a renombrar\n')
    write('borrar.txt', 'chau\n')
    sh('add', '.')
    sh('commit', '-q', '-m', 'inicial')
  })

  it('separa preparados, sin preparar y nuevos', async () => {
    write('app.txt', lines(5, { 2: 'cambiada' }))
    sh('mv', 'viejo.txt', 'nuevo nombre.txt')
    sh('rm', '-q', 'borrar.txt')
    write('sin seguimiento.txt', 'hola\n')

    const status = await workingStatus(dir)
    expect(status.branch).toBe('main')
    expect(status.head).toBe(sh('rev-parse', 'HEAD').trim())
    expect(status.staged).toEqual([
      { path: 'borrar.txt', status: 'deleted' },
      { path: 'nuevo nombre.txt', oldPath: 'viejo.txt', status: 'renamed' }
    ])
    expect(status.unstaged).toEqual([
      { path: 'app.txt', status: 'modified' },
      { path: 'sin seguimiento.txt', status: 'added', untracked: true }
    ])
    expect(status.conflicted).toEqual([])
  })

  it('prepara y quita archivos enteros', async () => {
    write('app.txt', lines(5, { 2: 'cambiada' }))
    write('nuevo.txt', 'hola\n')
    await stageFiles(dir, ['app.txt', 'nuevo.txt'])
    let status = await workingStatus(dir)
    expect(status.staged.map((f) => f.path)).toEqual(['app.txt', 'nuevo.txt'])
    expect(status.unstaged).toEqual([])

    await unstageFiles(dir, ['app.txt', 'nuevo.txt'])
    status = await workingStatus(dir)
    expect(status.staged).toEqual([])
    expect(status.unstaged.map((f) => f.path)).toEqual(['app.txt', 'nuevo.txt'])
  })

  it('descarta cambios sin preparar de archivos con seguimiento', async () => {
    write('app.txt', 'todo distinto\n')
    await restoreWorktree(dir, ['app.txt'])
    expect(read('app.txt')).toBe(lines(5))
  })

  it('lee un archivo del índice y de la carpeta de trabajo', async () => {
    write('app.txt', lines(5, { 1: 'en disco' }))
    expect(await readSource(dir, { kind: 'index' }, 'app.txt')).toEqual({ kind: 'text', text: lines(5) })
    expect(await readSource(dir, { kind: 'worktree' }, 'app.txt')).toEqual({ kind: 'text', text: lines(5, { 1: 'en disco' }) })
    expect(await readSource(dir, { kind: 'worktree' }, 'no-existe.txt')).toEqual({ kind: 'missing' })
  })

  it('no deja leer archivos fuera del repo', () => {
    expect(() => insideRepo(dir, '../afuera.txt')).toThrow('fuera del repositorio')
    expect(() => insideRepo(dir, 'C:/Windows/win.ini')).toThrow('fuera del repositorio')
  })
})

describe('preparar, quitar y descartar por bloque y por línea', () => {
  beforeEach(() => {
    newRepo()
    write('app.txt', lines(20))
    sh('add', '.')
    sh('commit', '-q', '-m', 'inicial')
    // Dos cambios bien separados: dos bloques.
    write('app.txt', lines(20, { 2: 'DOS', 18: 'dieciocho A\ndieciocho B' }))
  })

  const unstagedDiff = async () => parseFileDiff(await workingDiff(dir, 'app.txt', 'unstaged'))
  const index = () => sh('show', ':app.txt')

  it('prepara un solo bloque', async () => {
    const diff = await unstagedDiff()
    expect(diff.hunks).toHaveLength(2)
    await applyPatch(dir, buildPatch(diff, wholeHunk(0), 'forward')!, 'stage')
    expect(index()).toBe(lines(20, { 2: 'DOS' }))
    // La carpeta de trabajo no se toca.
    expect(read('app.txt')).toBe(lines(20, { 2: 'DOS', 18: 'dieciocho A\ndieciocho B' }))
  })

  it('prepara una sola línea de un bloque', async () => {
    const diff = await unstagedDiff()
    const hunk = diff.hunks[1]
    const lineB = hunk.lines.findIndex((l) => l.text === 'dieciocho B')
    await applyPatch(dir, buildPatch(diff, (h, l) => h === 1 && l === lineB, 'forward')!, 'stage')
    // Se agregó "dieciocho B" pero la línea 18 original sigue en el índice.
    expect(index()).toBe(lines(20, { 18: 'línea 18\ndieciocho B' }))
  })

  it('quita del índice una sola línea', async () => {
    sh('add', 'app.txt')
    const staged = parseFileDiff(await workingDiff(dir, 'app.txt', 'staged'))
    const lineA = staged.hunks[1].lines.findIndex((l) => l.text === 'dieciocho A')
    await applyPatch(dir, buildPatch(staged, (h, l) => h === 1 && l === lineA, 'reverse')!, 'unstage')
    expect(index()).toBe(lines(20, { 2: 'DOS', 18: 'dieciocho B' }))
  })

  it('descarta un bloque de la carpeta de trabajo', async () => {
    const diff = await unstagedDiff()
    await applyPatch(dir, buildPatch(diff, wholeHunk(1), 'reverse')!, 'discard')
    expect(read('app.txt')).toBe(lines(20, { 2: 'DOS' }))
  })

  it('descartar con un diff viejo (el archivo cambió después) falla sin tocar el archivo', async () => {
    const diff = await unstagedDiff()
    const changedAgain = lines(20, { 1: 'otra cosa', 2: 'otra más', 18: 'dieciocho A\ndieciocho B' })
    write('app.txt', changedAgain)
    await expect(applyPatch(dir, buildPatch(diff, wholeHunk(0), 'reverse')!, 'discard')).rejects.toThrow()
    expect(read('app.txt')).toBe(changedAgain)
  })
})

describe('archivos con finales de línea de Windows (core.autocrlf=true)', () => {
  it('descartar un bloque conserva el CRLF y el resto de los cambios', async () => {
    newRepo({ 'core.autocrlf': 'true' })
    write('win.txt', lines(20).replace(/\n/g, '\r\n'))
    sh('add', '.')
    sh('commit', '-q', '-m', 'inicial')
    const edited = lines(20, { 2: 'DOS', 18: 'DIECIOCHO' }).replace(/\n/g, '\r\n')
    write('win.txt', edited)

    const diff = parseFileDiff(await workingDiff(dir, 'win.txt', 'unstaged'))
    await applyPatch(dir, buildPatch(diff, wholeHunk(1), 'reverse')!, 'discard')
    expect(read('win.txt')).toBe(lines(20, { 2: 'DOS' }).replace(/\n/g, '\r\n'))

    await applyPatch(dir, buildPatch(diff, wholeHunk(0), 'forward')!, 'stage')
    expect(sh('show', ':win.txt')).toBe(lines(20, { 2: 'DOS' }))
  })
})

describe('commit', () => {
  beforeEach(() => newRepo())

  it('funciona en un repo sin commits, con mensajes de varias líneas y "#"', async () => {
    write('a.txt', 'uno\n')
    await stageFiles(dir, ['a.txt'])
    await unstageFiles(dir, ['a.txt'])
    expect((await workingStatus(dir)).unstaged).toEqual([{ path: 'a.txt', status: 'added', untracked: true }])

    await stageFiles(dir, ['a.txt'])
    const sha = await commit(dir, 'Primer commit\n\n#12 con detalle\n', false)
    expect(sha).toBe(sh('rev-parse', 'HEAD').trim())
    expect(await lastCommitMessage(dir)).toBe('Primer commit\n\n#12 con detalle')
    expect((await workingStatus(dir)).staged).toEqual([])
  })

  it('enmienda el último commit', async () => {
    write('a.txt', 'uno\n')
    sh('add', '.')
    sh('commit', '-q', '-m', 'mensaje con error')
    write('a.txt', 'uno\ndos\n')
    await stageFiles(dir, ['a.txt'])
    await commit(dir, 'mensaje corregido', true)
    expect(sh('rev-list', '--count', 'HEAD').trim()).toBe('1')
    expect(await lastCommitMessage(dir)).toBe('mensaje corregido')
    expect(sh('show', 'HEAD:a.txt')).toBe('uno\ndos\n')
  })

  it('rechaza un mensaje vacío', async () => {
    await expect(commit(dir, '   \n', false)).rejects.toThrow('no puede estar vacío')
  })
})
