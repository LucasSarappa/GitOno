import type { GitProvider } from './types'

export const gitlab: GitProvider = {
  id: 'gitlab',
  name: 'GitLab',
  // gitlab.com y las instancias propias que suelen llamarse "gitlab.empresa.com".
  // Más adelante el usuario va a poder registrar hosts con cualquier nombre.
  matches: ({ host }) => host.split('.').includes('gitlab')
}
