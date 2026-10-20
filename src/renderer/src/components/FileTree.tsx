import type { FileChange } from '../../../shared/types'
import { STATUS_META } from '../lib/status'
import type { TreeNode } from '../lib/tree'

interface Props {
  nodes: TreeNode[]
  selectedPath: string | null
  collapsed: ReadonlySet<string>
  onSelect(change: FileChange): void
  onToggleFolder(path: string): void
}

export function FileTree(props: Props) {
  return (
    <ul className="tree" role="tree">
      <TreeLevel {...props} depth={0} />
    </ul>
  )
}

function TreeLevel({ nodes, depth, ...props }: Props & { depth: number }) {
  return nodes.map((node) => {
    const indent = { paddingLeft: 8 + depth * 14 }

    if (node.kind === 'folder') {
      const open = !props.collapsed.has(node.path)
      return (
        <li key={`d:${node.path}`} role="treeitem" aria-expanded={open}>
          <button className="tree__row tree__row--folder" style={indent} onClick={() => props.onToggleFolder(node.path)}>
            <span className={`tree__chevron${open ? ' tree__chevron--open' : ''}`} aria-hidden>
              ›
            </span>
            <span className="tree__name">{node.name}</span>
          </button>
          {open && (
            <ul role="group">
              <TreeLevel {...props} nodes={node.children} depth={depth + 1} />
            </ul>
          )}
        </li>
      )
    }

    const { change } = node
    const meta = STATUS_META[change.status]
    const selected = change.path === props.selectedPath
    const tooltip = change.oldPath ? `${meta.label}: ${change.oldPath} → ${change.path}` : `${meta.label}: ${change.path}`
    return (
      <li key={`f:${change.path}`} role="treeitem" aria-selected={selected}>
        <button
          className={`tree__row${selected ? ' tree__row--selected' : ''}`}
          style={indent}
          title={tooltip}
          data-path={change.path}
          onClick={() => props.onSelect(change)}
        >
          <span className={`status-badge status-badge--${meta.tone}`} aria-label={meta.label}>
            {meta.symbol}
          </span>
          <span className={`tree__name${change.status === 'deleted' ? ' tree__name--deleted' : ''}`}>{node.name}</span>
          <LineCounts change={change} />
        </button>
      </li>
    )
  })
}

function LineCounts({ change }: { change: FileChange }) {
  if (change.additions === null || change.deletions === null) return <span className="tree__counts">bin</span>
  return (
    <span className="tree__counts">
      {change.additions > 0 && <span className="added">+{change.additions}</span>}
      {change.deletions > 0 && <span className="deleted">−{change.deletions}</span>}
    </span>
  )
}
