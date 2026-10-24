// Operaciones contra repositorios reales: un clon de trabajo y un remoto "bare" que hace de servidor.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  abortOperation,
  applyStash,
  checkout,
  cherryPick,
  continueOperation,
  createBranch,
  createTag,
  deleteBranch,
  deleteRemoteBranch,
  deleteRemoteTag,
  deleteTag,
  dropStash,
  fastForward,
  listStashes,
  merge,
  pull,
  push,
  pushTag,
  rebase,
  renameBranch,
  renameStash,
  reset,
  restoreStash,
  revert,
  setUpstream,
  stash
} from './ops'
import { listCommits, listRefs, searchCode } from './repo'
import { currentOperation, workingStatus } from './worktree'

let base: string
let dir: string
let server: string

const run = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, stdio: 'pipe' }).toString().trim()
const sh = (...args: string[]) => run(dir, ...args)
const write = (file: string, content: string) => writeFileSync(join(dir, file), content)
const read = (file: string) => readFileSync(join(dir, file), 'utf8')
const commit = (file: string, content: string, message: string) => {
  write(file, content)
  sh('add', '.')
  sh('commit', '-q', '-m', message)
  return sh('rev-parse', 'HEAD')
}
const sha = (rev: string) => sh('rev-parse', rev)

function configure(cwd: string) {
  run(cwd, 'config', 'user.name', 'Ana')
  run(cwd, 'config', 'user.email', 'ana@example.com')
  run(cwd, 'config', 'commit.gpgsign', 'false')
  run(cwd, 'config', 'tag.gpgsign', 'false')
}

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'gitono-ops-'))
  server = join(base, 'servidor.git')
  dir = join(base, 'trabajo')
  run(base, 'init', '-q', '--bare', '-b', 'main', server)
  run(base, 'clone', '-q', server, dir)
  configure(dir)
  sh('checkout', '-q', '-b', 'main')
  commit('a.txt', 'uno\n', 'c1')
  sh('push', '-q', '-u', 'origin', 'main')
})

afterEach(() => rmSync(base, { recursive: true, force: true }))

describe('ramas', () => {
  it('crea, cambia, renombra y borra ramas', async () => {
    expect(await createBranch(dir, 'feature/login', 'HEAD', true)).toBe('refs/heads/feature/login')
    expect(sh('branch', '--show-current')).toBe('feature/login')
    commit('b.txt', 'b\n', 'f1')

    expect(await renameBranch(dir, 'refs/heads/feature/login', 'feature/ingreso')).toBe('refs/heads/feature/ingreso')
    expect(await checkout(dir, 'refs/heads/main')).toBe('refs/heads/main')

    // Tiene un commit que no está en main: sin forzar, Git se niega.
    await expect(deleteBranch(dir, 'refs/heads/feature/ingreso', false)).rejects.toThrow(/no están en otra rama/)
    const tip = await deleteBranch(dir, 'refs/heads/feature/ingreso', true)
    expect(tip).toHaveLength(40)
    expect(sh('branch', '--list', 'feature/ingreso')).toBe('')

    // Para deshacer: se vuelve a crear en el mismo commit.
    await createBranch(dir, 'feature/ingreso', tip, false)
    expect(sha('feature/ingreso')).toBe(tip)
  })

  it('rechaza nombres inválidos y ramas que ya existen', async () => {
    await expect(createBranch(dir, 'con espacio', 'HEAD', false)).rejects.toThrow(/no sirve como nombre/)
    await expect(createBranch(dir, '-x', 'HEAD', false)).rejects.toThrow()
    await expect(createBranch(dir, 'main', 'HEAD', false)).rejects.toThrow(/Ya existe/)
  })

  it('checkout de una rama remota crea la local que la sigue', async () => {
    sh('push', '-q', 'origin', 'HEAD:refs/heads/remota')
    sh('fetch', '-q')
    expect(await checkout(dir, 'refs/remotes/origin/remota')).toBe('refs/heads/remota')
    expect(sh('rev-parse', '--abbrev-ref', 'remota@{upstream}')).toBe('origin/remota')
    // Si la local ya existe, se usa esa.
    await checkout(dir, 'refs/heads/main')
    expect(await checkout(dir, 'refs/remotes/origin/remota')).toBe('refs/heads/remota')
  })

  it('checkout de un commit deja HEAD desacoplado', async () => {
    const c1 = sha('HEAD')
    commit('a.txt', 'dos\n', 'c2')
    expect(await checkout(dir, c1)).toBeNull()
    expect((await listRefs(dir)).current).toBeNull()
  })

  it('avanza una rama que no es la actual, solo si es avance rápido', async () => {
    sh('branch', 'atrasada')
    const c2 = commit('a.txt', 'dos\n', 'c2')
    await fastForward(dir, 'refs/heads/atrasada', 'refs/heads/main')
    expect(sha('atrasada')).toBe(c2)

    sh('checkout', '-q', 'atrasada')
    commit('b.txt', 'b\n', 'propio')
    sh('checkout', '-q', 'main')
    await expect(fastForward(dir, 'refs/heads/atrasada', 'refs/heads/main')).rejects.toThrow(/avance rápido/)
  })

  it('sigue y deja de seguir una rama remota', async () => {
    sh('branch', 'otra')
    await setUpstream(dir, 'refs/heads/otra', 'refs/remotes/origin/main')
    expect((await listRefs(dir)).refs.find((r) => r.name === 'otra')?.upstream).toBe('refs/remotes/origin/main')
    await setUpstream(dir, 'refs/heads/otra', null)
    expect((await listRefs(dir)).refs.find((r) => r.name === 'otra')?.upstream).toBeUndefined()
  })
})

describe('merge, rebase, cherry-pick, revert y reset', () => {
  it('merge sin conflictos y con --no-ff', async () => {
    sh('checkout', '-q', '-b', 'feature')
    commit('b.txt', 'b\n', 'f1')
    sh('checkout', '-q', 'main')
    expect(await merge(dir, 'refs/heads/feature', 'no-ff')).toBe('done')
    expect(sh('log', '-1', '--format=%P').split(' ')).toHaveLength(2)
  })

  it('merge con conflictos: queda a medio hacer, se resuelve y se continúa', async () => {
    sh('checkout', '-q', '-b', 'feature')
    commit('a.txt', 'de feature\n', 'f1')
    sh('checkout', '-q', 'main')
    commit('a.txt', 'de main\n', 'c2')

    expect(await merge(dir, 'refs/heads/feature', 'default')).toBe('conflicts')
    expect(await currentOperation(dir)).toBe('merge')
    expect((await workingStatus(dir)).conflicted.map((f) => f.path)).toEqual(['a.txt'])
    await expect(continueOperation(dir)).rejects.toThrow(/conflictos/)

    write('a.txt', 'resuelto\n')
    sh('add', 'a.txt')
    expect(await continueOperation(dir)).toBe('done')
    expect(await currentOperation(dir)).toBeNull()
    // El mensaje queda limpio, sin las líneas "# Conflicts:" que agrega Git.
    expect(sh('log', '-1', '--format=%B')).toBe("Merge branch 'feature'")
  })

  it('abortar un merge vuelve todo a como estaba', async () => {
    sh('checkout', '-q', '-b', 'feature')
    commit('a.txt', 'de feature\n', 'f1')
    sh('checkout', '-q', 'main')
    const before = commit('a.txt', 'de main\n', 'c2')
    await merge(dir, 'refs/heads/feature', 'default')
    await abortOperation(dir)
    expect(await currentOperation(dir)).toBeNull()
    expect(sha('HEAD')).toBe(before)
    expect(read('a.txt')).toBe('de main\n')
  })

  it('rebase con conflicto se continúa sin abrir un editor', async () => {
    sh('checkout', '-q', '-b', 'feature')
    commit('a.txt', 'de feature\n', 'f1')
    sh('checkout', '-q', 'main')
    commit('a.txt', 'de main\n', 'c2')
    sh('checkout', '-q', 'feature')

    expect(await rebase(dir, 'refs/heads/main')).toBe('conflicts')
    expect(await currentOperation(dir)).toBe('rebase')
    write('a.txt', 'resuelto\n')
    sh('add', 'a.txt')
    expect(await continueOperation(dir)).toBe('done')
    expect(sh('log', '-2', '--format=%s')).toBe('f1\nc2')
  })

  it('cherry-pick y revert, también de un commit de merge', async () => {
    sh('checkout', '-q', '-b', 'feature')
    const f1 = commit('b.txt', 'b\n', 'f1')
    sh('checkout', '-q', 'main')
    expect(await cherryPick(dir, f1)).toBe('done')
    expect(read('b.txt')).toBe('b\n')

    expect(await revert(dir, 'HEAD')).toBe('done')
    expect(existsSync(join(dir, 'b.txt'))).toBe(false)

    sh('checkout', '-q', '-b', 'otra')
    commit('c.txt', 'c\n', 'o1')
    sh('checkout', '-q', 'main')
    sh('merge', '-q', '--no-ff', 'otra', '-m', 'merge otra')
    expect(existsSync(join(dir, 'c.txt'))).toBe(true)
    expect(await revert(dir, 'HEAD')).toBe('done')
    expect(existsSync(join(dir, 'c.txt'))).toBe(false)
  })

  it('reset suave, mixto y duro', async () => {
    const c1 = sha('HEAD')
    commit('a.txt', 'dos\n', 'c2')
    await reset(dir, c1, 'soft')
    expect((await workingStatus(dir)).staged.map((f) => f.path)).toEqual(['a.txt'])
    await reset(dir, c1, 'mixed')
    expect((await workingStatus(dir)).unstaged.map((f) => f.path)).toEqual(['a.txt'])
    await reset(dir, c1, 'hard')
    expect(read('a.txt')).toBe('uno\n')
  })
})

describe('tags', () => {
  it('crea tags livianos y anotados, los sube y los borra', async () => {
    expect(await createTag(dir, 'v1.0', 'HEAD', null)).toBe('refs/tags/v1.0')
    await createTag(dir, 'v1.1', 'HEAD', 'Versión 1.1')
    expect(sh('cat-file', '-t', 'v1.1')).toBe('tag')
    await expect(createTag(dir, 'v1.0', 'HEAD', null)).rejects.toThrow(/Ya existe/)

    await pushTag(dir, 'refs/tags/v1.0', 'origin')
    expect(run(server, 'tag', '--list')).toBe('v1.0')
    await deleteRemoteTag(dir, 'refs/tags/v1.0', 'origin')
    expect(run(server, 'tag', '--list')).toBe('')

    const target = await deleteTag(dir, 'refs/tags/v1.0')
    expect(target).toBe(sha('HEAD'))
    expect(sh('tag', '--list', 'v1.0')).toBe('')
  })
})

describe('stash', () => {
  it('guarda cambios y archivos nuevos, los aplica, los saca y los borra', async () => {
    write('a.txt', 'cambio\n')
    write('nuevo.txt', 'nuevo\n')
    expect(await stash(dir, 'mitad del login')).toBe(true)
    expect(read('a.txt')).toBe('uno\n')
    expect(existsSync(join(dir, 'nuevo.txt'))).toBe(false)

    const [saved] = await listStashes(dir)
    expect(saved).toMatchObject({ index: 0, base: sha('HEAD') })
    expect(saved.message).toContain('mitad del login')

    expect(await applyStash(dir, 0, false)).toBe('done')
    expect(read('a.txt')).toBe('cambio\n')
    expect(await listStashes(dir)).toHaveLength(1)

    sh('reset', '-q', '--hard')
    sh('clean', '-q', '-f')
    expect(await applyStash(dir, 0, true)).toBe('done')
    expect(await listStashes(dir)).toHaveLength(0)
    expect(existsSync(join(dir, 'nuevo.txt'))).toBe(true)
  })

  it('sin cambios no guarda nada', async () => {
    expect(await stash(dir, '')).toBe(false)
  })

  it('borrar, recuperar y renombrar', async () => {
    write('a.txt', 'cambio\n')
    await stash(dir, 'primero')
    const dropped = await dropStash(dir, 0)
    expect(await listStashes(dir)).toHaveLength(0)
    await restoreStash(dir, dropped, 'primero')
    expect((await listStashes(dir))[0].sha).toBe(dropped)

    await renameStash(dir, 0, 'nombre nuevo')
    const list = await listStashes(dir)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ sha: dropped, message: 'nombre nuevo' })
  })
})

describe('servidor', () => {
  it('push de una rama nueva la publica y la deja siguiendo la remota', async () => {
    sh('checkout', '-q', '-b', 'nueva')
    commit('n.txt', 'n\n', 'n1')
    await push(dir, 'refs/heads/nueva', false)
    expect(run(server, 'rev-parse', 'nueva')).toBe(sha('HEAD'))
    expect(sh('rev-parse', '--abbrev-ref', 'nueva@{upstream}')).toBe('origin/nueva')

    await deleteRemoteBranch(dir, 'refs/remotes/origin/nueva')
    expect(() => run(server, 'rev-parse', '--verify', 'nueva')).toThrow()
  })

  it('pull trae lo nuevo; push rechazado se puede forzar', async () => {
    // Otro clon sube un commit.
    const other = join(base, 'otro')
    run(base, 'clone', '-q', server, other)
    configure(other)
    writeFileSync(join(other, 'a.txt'), 'del otro\n')
    run(other, 'commit', '-q', '-am', 'del otro')
    run(other, 'push', '-q')

    expect(await pull(dir, 'ff-only')).toBe('done')
    expect(read('a.txt')).toBe('del otro\n')

    // Ahora el otro reescribe y sube primero: el push normal se rechaza, con force pasa.
    run(other, 'commit', '-q', '--amend', '-m', 'reescrito')
    run(other, 'push', '-q', '--force')
    commit('a.txt', 'mío\n', 'mío')
    sh('fetch', '-q')
    await expect(push(dir, 'refs/heads/main', false)).rejects.toThrow(/rejected|non-fast-forward|fetch first/i)
    await push(dir, 'refs/heads/main', true)
    expect(run(server, 'rev-parse', 'main')).toBe(sha('HEAD'))
  })

  it('pull sin rama remota explica qué hacer', async () => {
    sh('checkout', '-q', '-b', 'local')
    await expect(pull(dir, 'ff-or-merge')).rejects.toThrow(/no sigue ninguna rama remota/)
  })
})

describe('buscar en el código', () => {
  it('encuentra los commits que agregan o quitan un texto', async () => {
    const agrega = commit('b.txt', 'const clave = 42\n', 'agrega la clave')
    commit('c.txt', 'otra cosa\n', 'no tiene que ver')
    const quita = commit('b.txt', 'nada\n', 'quita la clave')
    expect((await searchCode(dir, 'clave = 42')).sort()).toEqual([agrega, quita].sort())
    expect(await searchCode(dir, 'no existe en ningún lado')).toEqual([])
    expect(await searchCode(dir, 'x')).toEqual([])
  })
})

describe('filtro del gráfico', () => {
  it('oculta ramas o muestra solo algunas', async () => {
    sh('checkout', '-q', '-b', 'oculta')
    const hidden = commit('h.txt', 'h\n', 'de la oculta')
    sh('checkout', '-q', 'main')
    const visible = commit('a.txt', 'dos\n', 'de main')

    const all = await listCommits(dir, 100)
    expect(all.commits.map((c) => c.sha)).toContain(hidden)

    const withoutHidden = await listCommits(dir, 100, { hidden: ['refs/heads/oculta'], solo: [] })
    expect(withoutHidden.commits.map((c) => c.sha)).not.toContain(hidden)
    expect(withoutHidden.commits.map((c) => c.sha)).toContain(visible)

    const onlyHidden = await listCommits(dir, 100, { hidden: [], solo: ['refs/heads/oculta'] })
    expect(onlyHidden.commits.map((c) => c.sha)).toContain(hidden)
    expect(onlyHidden.commits.map((c) => c.sha)).not.toContain(visible)
  })
})
