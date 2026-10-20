import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type IpcResult, type GitOnoApi } from '../shared/types'

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
  readFile: (root, ref, path) => call(IPC.readFile, root, ref, path)
}

contextBridge.exposeInMainWorld('gitono', api)
