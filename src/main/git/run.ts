import { execFile } from 'node:child_process'

export class GitError extends Error {
  constructor(
    message: string,
    readonly stderr = ''
  ) {
    super(message)
    this.name = 'GitError'
  }
}

interface RunOptions {
  maxBuffer?: number
  timeoutMs?: number
}

/** Ejecuta `git` en `cwd` y devuelve la salida cruda (sirve también para archivos binarios). */
export function git(cwd: string, args: string[], options: RunOptions = {}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      ['-c', 'core.quotepath=false', ...args],
      {
        cwd,
        encoding: 'buffer',
        maxBuffer: options.maxBuffer ?? 64 * 1024 * 1024,
        timeout: options.timeoutMs ?? 60_000,
        windowsHide: true,
        // Sin terminal no hay dónde escribir una contraseña; el Credential Manager sí puede abrir su ventana.
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
      },
      (error, stdout, stderr) => {
        if (!error) return resolve(stdout)
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return reject(new GitError('No se encontró Git. Instalá Git (https://git-scm.com) y volvé a abrir la app.'))
        }
        const text = stderr.toString('utf8').trim()
        reject(new GitError(text || error.message, text))
      }
    )
  })
}

export async function gitText(cwd: string, args: string[], options?: RunOptions): Promise<string> {
  return (await git(cwd, args, options)).toString('utf8')
}

/** Evita que un nombre de rama se interprete como opción de Git (ej. "--output=..."). */
export function assertSafeRef(ref: string): void {
  if (!ref || ref.startsWith('-') || /[\0\n\r]/.test(ref)) {
    throw new GitError(`Referencia inválida: "${ref}"`)
  }
}
