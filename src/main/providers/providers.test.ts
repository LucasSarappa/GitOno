import { describe, expect, it } from 'vitest'
import { detectProvider } from './index'
import { parseRemoteUrl } from './remote-url'

describe('parseRemoteUrl', () => {
  it.each([
    ['https://github.com/owner/repo.git', 'github.com', 'owner/repo'],
    ['https://usuario@github.com/owner/repo', 'github.com', 'owner/repo'],
    ['git@github.com:owner/repo.git', 'github.com', 'owner/repo'],
    ['ssh://git@gitlab.empresa.com:2222/grupo/sub/repo.git', 'gitlab.empresa.com', 'grupo/sub/repo'],
    ['https://GitLab.com/grupo/repo/', 'gitlab.com', 'grupo/repo']
  ])('%s', (url, host, path) => {
    expect(parseRemoteUrl(url)).toEqual({ host, path })
  })

  it.each(['C:/repos/proyecto', 'C:\\repos\\proyecto', '/home/yo/repo', 'file:///C:/repos/x', ''])(
    'ignora remotos locales: %s',
    (url) => {
      expect(parseRemoteUrl(url)).toBeNull()
    }
  )
})

describe('detectProvider', () => {
  it('reconoce GitHub y GitLab (incluidas instancias propias)', () => {
    expect(detectProvider('git@github.com:owner/repo.git')?.id).toBe('github')
    expect(detectProvider('https://gitlab.com/grupo/repo.git')?.id).toBe('gitlab')
    expect(detectProvider('https://gitlab.facultad.edu.ar/grupo/repo.git')?.id).toBe('gitlab')
  })

  it('marca como "generic" los servidores sin adaptador, pero igual los identifica', () => {
    expect(detectProvider('https://codeberg.org/user/repo.git')).toEqual({
      id: 'generic',
      name: 'codeberg.org',
      host: 'codeberg.org',
      repoPath: 'user/repo'
    })
  })

  it('no confunde dominios que solo contienen la palabra', () => {
    expect(detectProvider('https://notgithub.com/a/b')?.id).toBe('generic')
  })
})
