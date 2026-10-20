import type { FileChange } from '../../../shared/types'

export interface FolderNode {
  kind: 'folder'
  /** Puede incluir varias carpetas compactadas, ej. "src/main/git". */
  name: string
  path: string
  children: TreeNode[]
}

export interface FileNode {
  kind: 'file'
  name: string
  change: FileChange
}

export type TreeNode = FolderNode | FileNode

const collator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' })

function compareNodes(a: TreeNode, b: TreeNode): number {
  if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1
  return collator.compare(a.name, b.name)
}

/** Arma el árbol de carpetas a partir de la lista plana de archivos cambiados. */
export function buildTree(changes: FileChange[]): TreeNode[] {
  const root: FolderNode = { kind: 'folder', name: '', path: '', children: [] }
  const folders = new Map<string, FolderNode>([['', root]])

  for (const change of changes) {
    const parts = change.path.split('/')
    let parent = root
    for (const part of parts.slice(0, -1)) {
      const path = parent.path ? `${parent.path}/${part}` : part
      let folder = folders.get(path)
      if (!folder) {
        folder = { kind: 'folder', name: part, path, children: [] }
        folders.set(path, folder)
        parent.children.push(folder)
      }
      parent = folder
    }
    parent.children.push({ kind: 'file', name: parts[parts.length - 1], change })
  }

  return root.children.map(finalize).sort(compareNodes)
}

/** Ordena y compacta cadenas de carpetas con un único hijo, como hace VS Code. */
function finalize(node: TreeNode): TreeNode {
  if (node.kind === 'file') return node
  let folder = node
  while (folder.children.length === 1 && folder.children[0].kind === 'folder') {
    const child = folder.children[0]
    folder = { kind: 'folder', name: `${folder.name}/${child.name}`, path: child.path, children: child.children }
  }
  return { ...folder, children: folder.children.map(finalize).sort(compareNodes) }
}

/** Archivos en el orden en que se ven, salteando carpetas colapsadas (para moverse con el teclado). */
export function visibleFiles(nodes: TreeNode[], collapsed: ReadonlySet<string>): FileChange[] {
  const files: FileChange[] = []
  const walk = (list: TreeNode[]): void => {
    for (const node of list) {
      if (node.kind === 'file') files.push(node.change)
      else if (!collapsed.has(node.path)) walk(node.children)
    }
  }
  walk(nodes)
  return files
}
