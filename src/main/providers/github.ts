import type { GitProvider } from './types'

const GITHUB_HOSTS = new Set(['github.com', 'www.github.com', 'ssh.github.com'])

export const github: GitProvider = {
  id: 'github',
  name: 'GitHub',
  // GitHub Enterprise usa dominios propios: se van a poder configurar más adelante.
  matches: ({ host }) => GITHUB_HOSTS.has(host)
}
