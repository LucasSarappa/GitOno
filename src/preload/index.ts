import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type GitOnoApi, type IpcResult, type RepoChange } from '../shared/types'

async function call<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, ...args)) as IpcResult<T>
  if (!result.ok) throw new Error(result.error)
  return result.value
}

const api: GitOnoApi = {
  pickRepo: () => call(IPC.pickRepo),
  openRepo: (path) => call(IPC.openRepo, path),
  initialRepoPath: () => call(IPC.initialRepoPath),
  listRefs: (root) => call(IPC.listRefs, root),
  fetchAll: (root) => call(IPC.fetchAll, root),
  compare: (root, refA, refB) => call(IPC.compare, root, refA, refB),
  readFile: (root, source, path) => call(IPC.readFile, root, source, path),
  listCommits: (root, limit) => call(IPC.listCommits, root, limit),
  commitDetails: (root, sha) => call(IPC.commitDetails, root, sha),

  workingStatus: (root) => call(IPC.workingStatus, root),
  workingDiff: (root, path, area) => call(IPC.workingDiff, root, path, area),
  stageFiles: (root, paths) => call(IPC.stageFiles, root, paths),
  unstageFiles: (root, paths) => call(IPC.unstageFiles, root, paths),
  discardFiles: (root, files) => call(IPC.discardFiles, root, files),
  applyPatch: (root, patch, action) => call(IPC.applyPatch, root, patch, action),
  commit: (root, message, amend) => call(IPC.commit, root, message, amend),
  lastCommitMessage: (root) => call(IPC.lastCommitMessage, root),

  confirm: (options) => call(IPC.confirm, options),
  watchRepo: (root) => call(IPC.watchRepo, root),
  onRepoChanged: (listener) => {
    const handler = (_event: IpcRendererEvent, change: RepoChange) => listener(change)
    ipcRenderer.on(IPC.repoChanged, handler)
    return () => ipcRenderer.removeListener(IPC.repoChanged, handler)
  }
}

contextBridge.exposeInMainWorld('gitono', api)
