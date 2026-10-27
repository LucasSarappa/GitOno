// Identidad con la que Git firma los commits: user.name y user.email de git config, la global (de
// todos los repos) y la de un repo (que manda sobre la global en ese repo).

import { homedir } from 'node:os'
import { t } from '../../shared/i18n'
import type { GitIdentity, IdentityInfo } from '../../shared/types'
import { GitError, gitText } from './run'

type Scope = '--global' | '--local'

async function readScope(cwd: string, scope: Scope): Promise<GitIdentity | null> {
  // `git config --get` sale con error si la clave no existe: eso es "no configurado".
  const get = (key: string) => gitText(cwd, ['config', scope, '--get', key]).then((value) => value.trim(), () => '')
  const [name, email] = await Promise.all([get('user.name'), get('user.email')])
  return name || email ? { name, email } : null
}

/** La identidad global y, si se pasa un repo, la propia de ese repo (null si no tiene). */
export async function readIdentity(root: string | null): Promise<IdentityInfo> {
  const [global, local] = await Promise.all([readScope(root ?? homedir(), '--global'), root ? readScope(root, '--local') : null])
  return { global, local }
}

function validate(identity: GitIdentity): GitIdentity {
  const name = identity.name.trim()
  const email = identity.email.trim()
  if (!name) throw new GitError(t('Falta el nombre.'))
  if (/[\r\n<>]/.test(name)) throw new GitError(t('El nombre no puede tener saltos de línea ni "<" ">".'))
  if (!/^[^\s@<>]+@[^\s@<>]+$/.test(email)) throw new GitError(t('"{email}" no parece un email.', { email }))
  return { name, email }
}

/**
 * Cambia la identidad global (sin repo) o la de un repo. Con `identity` null, el repo deja de
 * tener una propia y vuelve a usar la global.
 */
export async function writeIdentity(root: string | null, identity: GitIdentity | null): Promise<void> {
  const scope: Scope = root ? '--local' : '--global'
  const cwd = root ?? homedir()
  if (identity === null) {
    if (!root) throw new GitError(t('La identidad global no se puede borrar desde GitOno.'))
    // --unset sale con error si la clave no estaba: no importa.
    for (const key of ['user.name', 'user.email']) await gitText(cwd, ['config', scope, '--unset', key]).catch(() => '')
    return
  }
  const { name, email } = validate(identity)
  await gitText(cwd, ['config', scope, 'user.name', name])
  await gitText(cwd, ['config', scope, 'user.email', email])
}
