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

/** Estado de un archivo cambiado: ícono sobre el color del estado (verde, rojo, ámbar, azul). */
export function StatusBadge({ status, title, tone }: Props) {
  const meta = STATUS_META[status]
  const Icon = ICONS[status]
  return (
    <span className={`status-badge status-badge--${tone ?? meta.tone}`} title={title ?? meta.label} role="img" aria-label={title ?? meta.label}>
      <Icon size={11} strokeWidth={2.75} aria-hidden />
    </span>
  )
}
