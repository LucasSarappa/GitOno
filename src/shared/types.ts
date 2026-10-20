// Tipos compartidos entre el proceso principal (Node) y la interfaz (React).

export type ChangeStatus =
  | 'added' // solo existe en B
  | 'deleted' // solo existe en A
  | 'modified'
  | 'renamed'
  | 'copied'
  | 'type-changed'
  | 'unknown'

export interface FileChange {
  status: ChangeStatus
  /** Ruta en B, o en A si el archivo solo existe en A. Siempre con "/". */
  path: string
  /** Ruta en A cuando el archivo fue renombrado o copiado. */
  oldPath?: string
  /** Líneas agregadas y borradas; null si el archivo es binario. */
  additions: number | null
  deletions: number | null
}

export interface CompareResult {
  files: FileChange[]
  /** Commits que están en A pero no en B, y viceversa. */
  commitsOnlyInA: number
  commitsOnlyInB: number
}

export type RefKind = 'local' | 'remote' | 'tag'

export interface RefInfo {
  /** Nombre completo, sin ambigüedad (ej. "refs/heads/main"). Es lo que se le pasa a Git. */
  ref: string
  /** Nombre corto para mostrar (ej. "main" u "origin/main"). */
  name: string
  kind: RefKind
}

export interface RefList {
  /** Rama en la que está parado el repo, o null si HEAD está desacoplado. */
  current: string | null
  refs: RefInfo[]
}

export interface ProviderInfo {
  /** "github", "gitlab" o "generic" si la plataforma todavía no tiene adaptador. */
  id: string
  name: string
  host: string
  /** Ruta del repo en la plataforma, ej. "owner/repo" o "grupo/subgrupo/repo". */
  repoPath: string
}

export interface RepoInfo {
  root: string
  name: string
  remoteUrl: string | null
  provider: ProviderInfo | null
}

export type FileContent =
  | { kind: 'text'; text: string }
  | { kind: 'missing' }
  | { kind: 'binary' }
  | { kind: 'too-large'; size: number }

/** API que el preload expone a la interfaz como `window.gitono`. */
export interface GitOnoApi {
  /** Abre el selector de carpetas. Devuelve null si el usuario cancela. */
  pickRepo(): Promise<RepoInfo | null>
  openRepo(path: string): Promise<RepoInfo>
  /** Carpeta pasada por línea de comandos al abrir la app, si hubo una. */
  initialRepoPath(): Promise<string | null>
  listRefs(root: string): Promise<RefList>
  fetchAll(root: string): Promise<void>
  compare(root: string, refA: string, refB: string): Promise<CompareResult>
  readFile(root: string, ref: string, path: string): Promise<FileContent>
}

export const IPC = {
  pickRepo: 'repo:pick',
  openRepo: 'repo:open',
  initialRepoPath: 'repo:initial-path',
  listRefs: 'git:list-refs',
  fetchAll: 'git:fetch-all',
  compare: 'git:compare',
  readFile: 'git:read-file'
} as const

export type IpcResult<T> = { ok: true; value: T } | { ok: false; error: string }
