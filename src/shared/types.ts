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
  /** SHA del commit al que apunta (en tags anotados, el commit y no el objeto tag). */
  target: string
}

export interface RefList {
  /** Rama en la que está parado el repo, o null si HEAD está desacoplado. */
  current: string | null
  /** SHA del commit actual (HEAD), o null si el repo todavía no tiene commits. */
  head: string | null
  refs: RefInfo[]
}

export interface CommitInfo {
  sha: string
  parents: string[]
  authorName: string
  authorEmail: string
  /** Fecha del autor, en segundos desde 1970. */
  authorDate: number
  subject: string
}

export interface CommitPage {
  commits: CommitInfo[]
  /** Hay más commits para cargar más allá del límite pedido. */
  hasMore: boolean
}

export interface CommitDetails extends CommitInfo {
  committerName: string
  committerEmail: string
  committerDate: number
  /** Mensaje completo: resumen y descripción. */
  message: string
  /** Archivos cambiados respecto del primer padre (o todos, si es el primer commit). */
  files: FileChange[]
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
  /** Historial de todas las ramas y tags, del más nuevo al más viejo. */
  listCommits(root: string, limit: number): Promise<CommitPage>
  commitDetails(root: string, sha: string): Promise<CommitDetails>
}

export const IPC = {
  pickRepo: 'repo:pick',
  openRepo: 'repo:open',
  initialRepoPath: 'repo:initial-path',
  listRefs: 'git:list-refs',
  fetchAll: 'git:fetch-all',
  compare: 'git:compare',
  readFile: 'git:read-file',
  listCommits: 'git:list-commits',
  commitDetails: 'git:commit-details'
} as const

export type IpcResult<T> = { ok: true; value: T } | { ok: false; error: string }
