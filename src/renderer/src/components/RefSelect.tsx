import type { RefInfo, RefKind, RefList } from '../../../shared/types'

const GROUPS: { kind: RefKind; label: string }[] = [
  { kind: 'local', label: 'Ramas locales' },
  { kind: 'remote', label: 'Ramas remotas' },
  { kind: 'tag', label: 'Tags' }
]

interface Props {
  label: string
  refs: RefList
  value: string
  onChange(ref: string): void
}

export function RefSelect({ label, refs, value, onChange }: Props) {
  const byKind = (kind: RefKind): RefInfo[] => refs.refs.filter((r) => r.kind === kind)

  return (
    <label className={`ref-select${value ? '' : ' ref-select--empty'}`}>
      <span className="ref-select__label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={`Rama ${label}`}>
        <option value="" disabled>
          Elegí una rama…
        </option>
        {GROUPS.map(({ kind, label: groupLabel }) => {
          const list = byKind(kind)
          if (list.length === 0) return null
          return (
            <optgroup key={kind} label={groupLabel}>
              {list.map((r) => (
                <option key={r.ref} value={r.ref}>
                  {r.ref === refs.current ? `${r.name} (actual)` : r.name}
                </option>
              ))}
            </optgroup>
          )
        })}
      </select>
    </label>
  )
}
