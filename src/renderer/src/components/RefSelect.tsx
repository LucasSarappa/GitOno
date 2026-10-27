import type { RefInfo, RefKind, RefList } from '../../../shared/types'
import { t } from '../../../shared/i18n'

const GROUPS: { kind: RefKind; label: string }[] = [
  { kind: 'local', label: t('Ramas locales') },
  { kind: 'remote', label: t('Ramas remotas') },
  { kind: 'tag', label: t('Etiquetas') }
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
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={t('Rama {label}', { label })}>
        <option value="" disabled>
          {t('Elegí una rama…')}
        </option>
        {GROUPS.map(({ kind, label: groupLabel }) => {
          const list = byKind(kind)
          if (list.length === 0) return null
          return (
            <optgroup key={kind} label={groupLabel}>
              {list.map((r) => (
                <option key={r.ref} value={r.ref}>
                  {r.ref === refs.current ? t('{name} (actual)', { name: r.name }) : r.name}
                </option>
              ))}
            </optgroup>
          )
        })}
      </select>
    </label>
  )
}
