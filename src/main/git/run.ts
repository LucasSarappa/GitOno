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
  /** Texto que se le pasa a Git por la entrada estándar (un parche, un mensaje de commit). */
  input?: string
  /** Recibe stderr a medida que llega (para leer el progreso de fetch, pull y push). */
  onStderr?: (chunk: Buffer) => void
}

/** Ejecuta `git` en `cwd` y devuelve la salida cruda (sirve también para archivos binarios). */
export function git(cwd: string, args: string[], options: RunOptions = {}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      'git',
      ['-c', 'core.quotepath=false', ...args],
      {
        cwd,
        encoding: 'buffer',
        maxBuffer: options.maxBuffer ?? 64 * 1024 * 1024,
        timeout: options.timeoutMs ?? 60_000,
        windowsHide: true,
        env: {
          ...process.env,
          // Sin terminal no hay dónde escribir una contraseña; el Credential Manager sí puede abrir su ventana.
          GIT_TERMINAL_PROMPT: '0',
          // Tampoco hay dónde editar un mensaje: si un comando (rebase --continue, por ejemplo) quisiera
          // abrir el editor, se usa el mensaje que Git propone en vez de quedar esperando.
          GIT_EDITOR: 'true',
          GIT_SEQUENCE_EDITOR: 'true',
          GIT_MERGE_AUTOEDIT: 'no'
        }
      },
      (error, stdout, stderr) => {
        if (!error) return resolve(stdout)
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return reject(new GitError('No se encontró Git. Instalá Git (https://git-scm.com) y volvé a abrir la app.'))
        }
        // Algunos comandos (como commit sin cambios) explican el error por la salida normal.
        const text = stderr.toString('utf8').trim() || stdout.toString('utf8').trim()
        reject(new GitError(text || error.message, text))
      }
    )
    if (options.onStderr) child.stderr?.on('data', options.onStderr)
    // Siempre se cierra la entrada: si un comando intentara leerla, no queda esperando para siempre.
    child.stdin?.end(options.input ?? '')
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
