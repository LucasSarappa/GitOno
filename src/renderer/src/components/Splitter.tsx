import { useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import type { Side } from '../lib/dock'
import { t } from '../../../shared/i18n'

interface Props {
  /** De qué lado del divisor está el panel que cambia de tamaño. */
  side: Side
  size: number
  min: number
  max: number
  label: string
  style?: CSSProperties
  onChange(size: number): void
  /** Doble clic: vuelve al tamaño original. */
  onReset(): void
}

/**
 * Divisor que se arrastra para cambiar el ancho (o el alto) de un panel. También se mueve con las
 * flechas desde el teclado, y con doble clic vuelve al tamaño original.
 */
export function Splitter({ side, size, min, max, label, style, onChange, onReset }: Props) {
  const drag = useRef<{ start: number; size: number } | null>(null)
  const horizontal = side === 'left' || side === 'right'
  // Si el panel está a la izquierda (o arriba), mover el divisor hacia la derecha (o abajo) lo agranda.
  const sign = side === 'left' || side === 'top' ? 1 : -1
  const clamp = (value: number) => Math.round(Math.min(max, Math.max(min, value)))
  const position = (e: PointerEvent) => (horizontal ? e.clientX : e.clientY)

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { start: position(e), size }
    document.body.classList.add(horizontal ? 'resizing' : 'resizing-rows')
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    onChange(clamp(drag.current.size + sign * (position(e) - drag.current.start)))
  }
  const onPointerUp = () => {
    drag.current = null
    document.body.classList.remove('resizing', 'resizing-rows')
  }
  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 48 : 16
    const forward = horizontal ? 'ArrowRight' : 'ArrowDown'
    const back = horizontal ? 'ArrowLeft' : 'ArrowUp'
    if (e.key === forward) onChange(clamp(size + sign * step))
    else if (e.key === back) onChange(clamp(size - sign * step))
    else return
    e.preventDefault()
  }

  return (
    <div
      className={`splitter splitter--${horizontal ? 'columns' : 'rows'}`}
      role="separator"
      aria-orientation={horizontal ? 'vertical' : 'horizontal'}
      aria-label={label}
      aria-valuenow={size}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      title={t('{label} · doble clic para volver al tamaño original', { label })}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
    />
  )
}
