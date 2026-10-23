import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { AvatarResolver, avatarFromNoreply, gravatarUrl, type Fetcher } from './avatars'

const github = { id: 'github', name: 'GitHub', host: 'github.com', repoPath: 'ana/tienda' }

describe('avatarFromNoreply', () => {
  it('arma la URL desde el ID del email privado de GitHub', () => {
    expect(avatarFromNoreply('12345+ana@users.noreply.github.com')).toBe('https://avatars.githubusercontent.com/u/12345?s=64&v=4')
  })

  it('usa el usuario en los emails privados viejos (sin ID)', () => {
    expect(avatarFromNoreply('ana@users.noreply.github.com')).toBe('https://github.com/ana.png?size=64')
  })

  it('ignora los demás emails', () => {
    expect(avatarFromNoreply('ana@example.com')).toBeNull()
  })
})

describe('gravatarUrl', () => {
  it('usa el SHA-256 del email en minúsculas y sin espacios', () => {
    expect(gravatarUrl(' Ana@Example.com ')).toBe(gravatarUrl('ana@example.com'))
    expect(gravatarUrl('ana@example.com')).toMatch(/^https:\/\/www\.gravatar\.com\/avatar\/[0-9a-f]{64}\?s=64&d=404$/)
  })
})

describe('AvatarResolver', () => {
  let dir: string
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  const fakeGitHub = (calls: string[]): Fetcher => async (url) => {
    calls.push(url)
    return {
      ok: true,
      json: async () => [{ commit: { author: { email: 'Bruno@Example.com' } }, author: { avatar_url: 'https://avatars.githubusercontent.com/u/7?v=4' } }]
    }
  }

  it('combina los tres métodos y guarda en caché lo que trae de GitHub', async () => {
    dir = mkdtempSync(join(tmpdir(), 'gitono-avatars-'))
    const calls: string[] = []
    const resolver = new AvatarResolver(join(dir, 'cache.json'), fakeGitHub(calls))
    const result = await resolver.resolve(['1+ana@users.noreply.github.com', 'bruno@example.com', 'carla@example.com'], github)
    expect(result['1+ana@users.noreply.github.com']).toContain('/u/1?')
    expect(result['bruno@example.com']).toBe('https://avatars.githubusercontent.com/u/7?v=4&s=64')
    expect(result['carla@example.com']).toContain('gravatar.com')
    // Un solo pedido a la API de GitHub (más la verificación de Gravatar para carla).
    expect(calls.filter((u) => u.includes('api.github.com'))).toHaveLength(1)

    // Otra instancia lee la caché del disco y no vuelve a pedir nada.
    const again: string[] = []
    await new AvatarResolver(join(dir, 'cache.json'), fakeGitHub(again)).resolve(['bruno@example.com', 'carla@example.com'], github)
    expect(again).toHaveLength(0)
  })

  it('si la API de GitHub falla, sigue con Gravatar', async () => {
    dir = mkdtempSync(join(tmpdir(), 'gitono-avatars-'))
    const onlyGravatar: Fetcher = async (url) => {
      if (url.includes('api.github.com')) throw new Error('sin cupo')
      return { ok: true, json: async () => null }
    }
    const result = await new AvatarResolver(join(dir, 'cache.json'), onlyGravatar).resolve(['bruno@example.com'], github)
    expect(result['bruno@example.com']).toContain('gravatar.com')
  })

  it('no devuelve URLs de Gravatar sin foto, y lo recuerda', async () => {
    dir = mkdtempSync(join(tmpdir(), 'gitono-avatars-'))
    const calls: string[] = []
    const notFound: Fetcher = async (url) => {
      calls.push(url)
      return { ok: false, status: 404, json: async () => null }
    }
    expect(await new AvatarResolver(join(dir, 'cache.json'), notFound).resolve(['sin@foto.com'], null)).toEqual({})
    expect(await new AvatarResolver(join(dir, 'cache.json'), notFound).resolve(['sin@foto.com'], null)).toEqual({})
    expect(calls).toHaveLength(1)
  })

  it('no consulta GitHub para repos de otras plataformas', async () => {
    dir = mkdtempSync(join(tmpdir(), 'gitono-avatars-'))
    const calls: string[] = []
    await new AvatarResolver(join(dir, 'cache.json'), fakeGitHub(calls)).resolve(['bruno@example.com'], { ...github, id: 'gitlab' })
    expect(calls.some((u) => u.includes('api.github.com'))).toBe(false)
  })
})
