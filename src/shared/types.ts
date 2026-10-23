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

/** Linaje de una rama: de dónde sale, qué commits son suyos y dónde se mergeó. */
export interface BranchInsight {
  ref: string
  name: string
  kind: RefKind
  tip: string
  /** Rama principal contra la que se mide (ej. main), o null si el repo no tiene una reconocible. */
  base: { ref: string; name: string } | null
  /** Es la rama principal (o su copia remota). */
  isBase: boolean
  /** Commit donde la rama salió de la principal. */
  forkPoint: string | null
  /** Commits propios, del más nuevo al más viejo (como máximo 2000; el total va en ownCount). */
  ownCommits: string[]
  ownCount: number
  /** Commits de la principal que esta rama no tiene. */
  behind: number
  merge: { kind: 'merge-commit'; sha: string; subject: string } | { kind: 'fast-forward' } | null
  /** Del reflog: desde dónde se creó y cuándo (solo ramas locales y mientras Git guarde el dato). */
  created: { from: string; date: number } | null
}

/** Un archivo con cambios sin commitear. */
export interface WorkingFile {
  path: string
  /** Ruta anterior, si el cambio preparado es un renombre. */
  oldPath?: string
  status: ChangeStatus
  /** Archivo nuevo que Git todavía no sigue (nunca se preparó). */
  untracked?: boolean
}

export interface WorkingTreeStatus {
  /** SHA del commit actual, o null si el repo todavía no tiene commits. */
  head: string | null
  /** Rama actual (nombre corto), o null si HEAD está desacoplado. */
  branch: string | null
  /** Cambios preparados para el próximo commit (índice contra HEAD). */
  staged: WorkingFile[]
  /** Cambios sin preparar (carpeta de trabajo contra el índice), incluidos los archivos nuevos. */
  unstaged: WorkingFile[]
  /** Archivos con conflictos de merge sin resolver. */
  conflicted: WorkingFile[]
}

export type WorkingArea = 'staged' | 'unstaged'

/** De dónde se lee una versión de un archivo. */
export type FileSource = { kind: 'ref'; ref: string } | { kind: 'index' } | { kind: 'worktree' }

/** Qué hacer con un parche de bloques o líneas elegidas. */
export type PatchAction = 'stage' | 'unstage' | 'discard'

export interface ConfirmOptions {
  title: string
  message: string
  detail?: string
  /** Texto del botón que confirma (ej. "Descartar"). */
  confirmLabel: string
}

/** Qué cambió en el disco: solo la carpeta de trabajo, o también ramas y commits. */
export type RepoChange = 'worktree' | 'refs'

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
  /** Lee una versión de un archivo: de un commit o rama, del índice o de la carpeta de trabajo. */
  readFile(root: string, source: FileSource, path: string): Promise<FileContent>
  /** Historial de todas las ramas y tags, del más nuevo al más viejo. */
  listCommits(root: string, limit: number): Promise<CommitPage>
  commitDetails(root: string, sha: string): Promise<CommitDetails>

  // Cambios locales
  workingStatus(root: string): Promise<WorkingTreeStatus>
  /** Diff unificado de un archivo: preparado (HEAD → índice) o sin preparar (índice → carpeta). */
  workingDiff(root: string, path: string, area: WorkingArea): Promise<string>
  stageFiles(root: string, paths: string[]): Promise<void>
  unstageFiles(root: string, paths: string[]): Promise<void>
  /** Descarta cambios sin preparar. Los archivos nuevos van a la papelera de reciclaje. */
  discardFiles(root: string, files: WorkingFile[]): Promise<void>
  /** Aplica un parche con bloques o líneas elegidas (ver shared/patch.ts). */
  applyPatch(root: string, patch: string, action: PatchAction): Promise<void>
  /** Hace el commit y devuelve el SHA nuevo. */
  commit(root: string, message: string, amend: boolean): Promise<string>
  lastCommitMessage(root: string): Promise<string>

  // Ramas
  branchInsight(root: string, ref: string): Promise<BranchInsight>
  branchesContaining(root: string, sha: string): Promise<string[]>

  /** URL del avatar de cada email (GitHub, si se puede; si no, Gravatar). */
  resolveAvatars(root: string, emails: string[], provider: ProviderInfo | null): Promise<Record<string, string>>

  /** Pregunta con un cuadro de diálogo del sistema. Devuelve true si el usuario confirma. */
  confirm(options: ConfirmOptions): Promise<boolean>
  /** Empieza a vigilar un repo (puede haber varios abiertos); los cambios llegan por `onRepoChanged`. */
  watchRepo(root: string): Promise<void>
  unwatchRepo(root: string): Promise<void>
  /** Avisa cuando cambia algo en un repo vigilado. Devuelve una función para dejar de escuchar. */
  onRepoChanged(listener: (root: string, change: RepoChange) => void): () => void

  /** Sistema operativo: decide cómo se dibuja la barra de título. */
  platform: 'win32' | 'darwin' | 'linux' | string
  /** Aplica el tema elegido a las partes nativas (diálogos, barra de título). */
  setAppearance(appearance: NativeAppearance): Promise<void>
}

export type ThemeChoice = 'system' | 'light' | 'dark'

export interface NativeAppearance {
  theme: ThemeChoice
  /** Colores de la barra de título nativa (botones de minimizar, maximizar y cerrar). */
  titleBar: { color: string; symbolColor: string }
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
  commitDetails: 'git:commit-details',
  workingStatus: 'git:working-status',
  workingDiff: 'git:working-diff',
  stageFiles: 'git:stage-files',
  unstageFiles: 'git:unstage-files',
  discardFiles: 'git:discard-files',
  applyPatch: 'git:apply-patch',
  commit: 'git:commit',
  lastCommitMessage: 'git:last-commit-message',
  branchInsight: 'git:branch-insight',
  branchesContaining: 'git:branches-containing',
  resolveAvatars: 'avatars:resolve',
  confirm: 'ui:confirm',
  setAppearance: 'ui:set-appearance',
  watchRepo: 'repo:watch',
  unwatchRepo: 'repo:unwatch',
  /** Evento del proceso principal hacia la interfaz (no es un pedido). */
  repoChanged: 'repo:changed'
} as const

export type IpcResult<T> = { ok: true; value: T } | { ok: false; error: string }
