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
  /** Solo ramas locales: la remota que sigue (ej. "refs/remotes/origin/main"). */
  upstream?: string
  /** Commits que tiene y que no están en su remota, y al revés. */
  ahead?: number
  behind?: number
  /** La remota que seguía ya no existe (se borró en el servidor). */
  upstreamGone?: boolean
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
  /** Remota que sigue la rama actual (ej. "origin/main"), y cuánto se adelanta y se atrasa. */
  upstream: string | null
  ahead: number
  behind: number
  /** Operación a medio hacer, por ejemplo frenada por conflictos. */
  operation: RepoOperation | null
}

/** Operación de Git que quedó a medio hacer y hay que continuar o abortar. */
export type RepoOperation = 'merge' | 'rebase' | 'cherry-pick' | 'revert'

/** Cómo terminó una operación que puede frenarse por conflictos. */
export type Outcome = 'done' | 'conflicts'

export interface StashInfo {
  /** Posición en la lista: es el n de stash@{n}. */
  index: number
  sha: string
  /** Commit sobre el que se guardó (el HEAD de ese momento). */
  base: string
  message: string
  /** Fecha en segundos desde 1970. */
  date: number
}

/** Por dónde va un fetch, pull o push (lo que Git escribe con --progress). */
export interface GitProgress {
  phase: string
  percent: number
}

/** Dónde abrir la carpeta del repo. */
export type OpenTarget = 'folder' | 'terminal' | 'editor'

export type MergeMode = 'default' | 'no-ff' | 'ff-only'
/** keep: como hard, pero se niega si pisaría cambios sin commitear (se usa para deshacer). */
export type ResetMode = 'soft' | 'mixed' | 'hard' | 'keep'
export type PullMode = 'ff-or-merge' | 'ff-only' | 'rebase'

/** Qué mostrar en el gráfico: todas las ramas menos las ocultas, o solo algunas. */
export interface GraphFilter {
  hidden: string[]
  /** Si tiene ramas, se muestran solo esas (y HEAD). */
  solo: string[]
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

/** Nombre y email con los que Git firma los commits (user.name y user.email). */
export interface GitIdentity {
  name: string
  email: string
}

/** La identidad global y la propia de un repo (si tiene una, manda sobre la global). */
export interface IdentityInfo {
  global: GitIdentity | null
  local: GitIdentity | null
}

/** Con qué arranca una ventana. */
export interface WindowStart {
  repoPath: string | null
  /** Solo la primera ventana recupera (y guarda) las pestañas de la última vez. */
  restoreTabs: boolean
}

/** API que el preload expone a la interfaz como `window.gitono`. */
export interface GitOnoApi {
  /** Abre el selector de carpetas. Devuelve null si el usuario cancela. */
  pickRepo(): Promise<RepoInfo | null>
  openRepo(path: string): Promise<RepoInfo>
  /** Con qué arranca esta ventana: el repo a abrir (línea de comandos o "ventana nueva") y si recupera las pestañas. */
  windowStart(): Promise<WindowStart>
  /** Identidad de Git: la global y, con un repo, la propia de ese repo. */
  readIdentity(root: string | null): Promise<IdentityInfo>
  /** Cambia la global (root null) o la de un repo; null en un repo vuelve a la global. */
  writeIdentity(root: string | null, identity: GitIdentity | null): Promise<void>
  /** Abre otra ventana de la app, vacía o con un repo. */
  newWindow(repoPath: string | null): Promise<void>
  listRefs(root: string): Promise<RefList>
  /** Trae las novedades de todos los remotos. El progreso llega por `onProgress`. */
  fetchAll(root: string): Promise<void>
  /** Commits que agregan o quitan un texto en el código (git log -S). */
  searchCode(root: string, text: string): Promise<string[]>
  /** Abre la carpeta del repo en el explorador, una terminal o VS Code. */
  openIn(root: string, target: OpenTarget): Promise<void>
  /** Avisa el progreso de fetch, pull y push. Devuelve una función para dejar de escuchar. */
  onProgress(listener: (root: string, progress: GitProgress) => void): () => void
  compare(root: string, refA: string, refB: string): Promise<CompareResult>
  /** Lee una versión de un archivo: de un commit o rama, del índice o de la carpeta de trabajo. */
  readFile(root: string, source: FileSource, path: string): Promise<FileContent>
  /** Historial de todas las ramas y tags (salvo las ocultas), del más nuevo al más viejo. */
  listCommits(root: string, limit: number, filter?: GraphFilter): Promise<CommitPage>
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

  // Operaciones (ver git/ops.ts). Las ramas y tags se pasan con el nombre completo (refs/...).
  /** Cambia a una rama local, a una remota (crea la local que la sigue) o a un commit suelto. Devuelve la rama local. */
  checkout(root: string, target: string): Promise<string | null>
  createBranch(root: string, name: string, startPoint: string, checkout: boolean): Promise<string>
  renameBranch(root: string, ref: string, newName: string): Promise<string>
  /** Borra una rama local y devuelve el commit al que apuntaba (para poder deshacer). */
  deleteBranch(root: string, ref: string, force: boolean): Promise<string>
  deleteRemoteBranch(root: string, ref: string): Promise<string>
  setUpstream(root: string, ref: string, upstream: string | null): Promise<void>
  /** Avanza una rama hasta otra, solo si es avance rápido (sin cambiar de rama). */
  fastForward(root: string, ref: string, to: string): Promise<void>
  merge(root: string, ref: string, mode: MergeMode): Promise<Outcome>
  rebase(root: string, onto: string): Promise<Outcome>
  cherryPick(root: string, sha: string): Promise<Outcome>
  revert(root: string, sha: string): Promise<Outcome>
  reset(root: string, sha: string, mode: ResetMode): Promise<void>
  continueOperation(root: string): Promise<Outcome>
  abortOperation(root: string): Promise<void>
  createTag(root: string, name: string, sha: string, message: string | null): Promise<string>
  deleteTag(root: string, ref: string): Promise<string>
  pushTag(root: string, ref: string, remote: string): Promise<void>
  deleteRemoteTag(root: string, ref: string, remote: string): Promise<void>
  listRemotes(root: string): Promise<string[]>
  pull(root: string, mode: PullMode): Promise<Outcome>
  /** Sube una rama. Si no sigue ninguna remota, la publica en el primer remoto y la deja siguiéndola. */
  push(root: string, ref: string, force: boolean): Promise<void>

  // Stash
  listStashes(root: string): Promise<StashInfo[]>
  /** Guarda los cambios sin commitear (también los archivos nuevos). Devuelve false si no había cambios. */
  stash(root: string, message: string): Promise<boolean>
  applyStash(root: string, index: number, pop: boolean): Promise<Outcome>
  /** Borra un stash y devuelve su SHA, para poder recuperarlo. */
  dropStash(root: string, index: number): Promise<string>
  /** Vuelve a guardar un stash borrado (deshacer). */
  restoreStash(root: string, sha: string, message: string): Promise<void>
  renameStash(root: string, index: number, message: string): Promise<void>

  /** Guarda un commit como archivo .patch (pregunta dónde). Devuelve false si se cancela. */
  savePatch(root: string, sha: string): Promise<boolean>
  copyText(text: string): Promise<void>
  /** Abre una dirección https en el navegador. */
  openExternal(url: string): Promise<void>

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
  /** Zoom de toda la interfaz (1 = 100 %). */
  setZoom(factor: number): void
  /** Idioma de los mensajes del proceso principal (errores de Git, diálogos). */
  setLocale(locale: 'es' | 'en'): Promise<void>
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
  windowStart: 'ui:window-start',
  newWindow: 'ui:new-window',
  readIdentity: 'git:read-identity',
  writeIdentity: 'git:write-identity',
  listRefs: 'git:list-refs',
  fetchAll: 'git:fetch-all',
  searchCode: 'git:search-code',
  openIn: 'ui:open-in',
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
  checkout: 'git:checkout',
  createBranch: 'git:create-branch',
  renameBranch: 'git:rename-branch',
  deleteBranch: 'git:delete-branch',
  deleteRemoteBranch: 'git:delete-remote-branch',
  setUpstream: 'git:set-upstream',
  fastForward: 'git:fast-forward',
  merge: 'git:merge',
  rebase: 'git:rebase',
  cherryPick: 'git:cherry-pick',
  revert: 'git:revert',
  reset: 'git:reset',
  continueOperation: 'git:continue',
  abortOperation: 'git:abort',
  createTag: 'git:create-tag',
  deleteTag: 'git:delete-tag',
  pushTag: 'git:push-tag',
  deleteRemoteTag: 'git:delete-remote-tag',
  listRemotes: 'git:list-remotes',
  pull: 'git:pull',
  push: 'git:push',
  listStashes: 'git:list-stashes',
  stash: 'git:stash',
  applyStash: 'git:apply-stash',
  dropStash: 'git:drop-stash',
  restoreStash: 'git:restore-stash',
  renameStash: 'git:rename-stash',
  savePatch: 'git:save-patch',
  copyText: 'ui:copy-text',
  openExternal: 'ui:open-external',
  resolveAvatars: 'avatars:resolve',
  confirm: 'ui:confirm',
  setAppearance: 'ui:set-appearance',
  watchRepo: 'repo:watch',
  unwatchRepo: 'repo:unwatch',
  /** Evento del proceso principal hacia la interfaz (no es un pedido). */
  repoChanged: 'repo:changed',
  progress: 'git:progress',
  setLocale: 'ui:set-locale'
} as const

export type IpcResult<T> = { ok: true; value: T } | { ok: false; error: string }
