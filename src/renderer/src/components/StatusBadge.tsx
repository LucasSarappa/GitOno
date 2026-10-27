import { ArrowRight, Copy, FileQuestion, FileType, Minus, Pencil, Plus } from 'lucide-react'
import type { ChangeStatus } from '../../../shared/types'
import { STATUS_META } from '../lib/status'

const ICONS: Record<ChangeStatus, typeof Plus> = {
  added: Plus,
  deleted: Minus,
  modified: Pencil,
  renamed: ArrowRight,
  copied: Copy,
  'type-changed': FileType,
  unknown: FileQuestion
}

interface Props {
  status: ChangeStatus
  /** Texto del tooltip, si es distinto del estándar (ej. "Archivo nuevo"). */
  title?: string
  tone?: 'added' | 'deleted' | 'modified' | 'renamed'
}

/** Estado de un archivo cambiado: el ícono solo, del color del estado (verde, rojo, ámbar, azul), como en GitKraken. */
export function StatusBadge({ status, title, tone }: Props) {
  const meta = STATUS_META[status]
  const Icon = ICONS[status]
  return (
    <span className={`status-badge status-badge--${tone ?? meta.tone}`} title={title ?? meta.label} role="img" aria-label={title ?? meta.label}>
      <Icon size={14} strokeWidth={2.25} aria-hidden />
    </span>
  )
}
