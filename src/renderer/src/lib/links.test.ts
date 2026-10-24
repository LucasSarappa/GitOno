import { describe, expect, it } from 'vitest'
import { webLinks } from './links'

describe('webLinks', () => {
  it('arma las direcciones de GitHub', () => {
    const links = webLinks({ id: 'github', name: 'GitHub', host: 'github.com', repoPath: 'ana/tienda' })!
    expect(links.commit('abc')).toBe('https://github.com/ana/tienda/commit/abc')
    expect(links.branch('feature/login #2')).toBe('https://github.com/ana/tienda/tree/feature/login%20%232')
    expect(links.newRequest('feature/login', 'main')).toBe('https://github.com/ana/tienda/compare/main...feature/login?expand=1')
    // Sin destino, GitHub propone la rama por defecto del repo.
    expect(links.newRequest('feature/login')).toBe('https://github.com/ana/tienda/compare/feature/login?expand=1')
  })

  it('arma las direcciones de GitLab, también con subgrupos', () => {
    const links = webLinks({ id: 'gitlab', name: 'GitLab', host: 'gitlab.com', repoPath: 'grupo/sub/tienda' })!
    expect(links.commit('abc')).toBe('https://gitlab.com/grupo/sub/tienda/-/commit/abc')
    expect(links.newRequest('feature/x', 'main')).toBe(
      'https://gitlab.com/grupo/sub/tienda/-/merge_requests/new?merge_request%5Bsource_branch%5D=feature%2Fx&merge_request%5Btarget_branch%5D=main'
    )
  })

  it('no inventa direcciones para servidores desconocidos', () => {
    expect(webLinks({ id: 'generic', name: 'git.empresa.com', host: 'git.empresa.com', repoPath: 'x/y' })).toBeNull()
    expect(webLinks(null)).toBeNull()
  })
})
