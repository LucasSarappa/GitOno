import { t } from '../../../shared/i18n'
// Columnas del historial, como en GitKraken: se pueden ensanchar, ocultar y reordenar.
// Se guardan en las preferencias y valen para todos los repos.

export type ColumnId = 'refs' | 'graph' | 'message' | 'author' | 'date' | 'sha'

export interface ColumnsConfig {
  /** Orden de las columnas que van después de Rama / tag y Gráfico (esas dos siempre van primero). */
  order: ColumnId[]
  /** Ancho elegido de cada columna. El gráfico sin ancho se ajusta a sus carriles; el mensaje usa lo que sobra. */
  widths: Partial<Record<ColumnId, number>>
  hidden: ColumnId[]
  /** Versión de la configuración, para migrar las viejas. */
  version?: number
}

export const COLUMN_LABELS: Record<ColumnId, string> = {
  refs: t('Rama / etiqueta'),
  graph: t('Gráfico'),
  message: t('Mensaje'),
  author: t('Autor'),
  date: t('Fecha'),
  sha: 'SHA'
}

const FIXED_FIRST: ColumnId[] = ['refs', 'graph']
export const MOVABLE: ColumnId[] = ['message', 'author', 'date', 'sha']

export const DEFAULT_COLUMNS: ColumnsConfig = {
  order: [...MOVABLE],
  widths: { refs: 156, author: 144, date: 112, sha: 72 },
  // Como GitKraken: por defecto solo Rama / tag, Gráfico y Mensaje (el autor va en el nodo del gráfico).
  hidden: ['author', 'date', 'sha'],
  version: 2
}

export const MIN_WIDTH: Record<ColumnId, number> = { refs: 48, graph: 32, message: 160, author: 72, date: 64, sha: 56 }
export const MAX_WIDTH = 640
/** Si al mensaje le queda menos que esto, se ocultan solas otras columnas (primero SHA, después fecha y autor). */
export const MESSAGE_COMFORT = 240
const AUTO_HIDE: ColumnId[] = ['sha', 'date', 'author']

export interface ColumnLayout {
  id: ColumnId
  /** null: el mensaje, que se queda con el espacio que sobra. */
  width: number | null
}

/** Arregla una configuración guardada por una versión vieja o editada a mano. */
export function normalizeColumns(config: ColumnsConfig): ColumnsConfig {
  const order = config.order.filter((id, i) => MOVABLE.includes(id) && config.order.indexOf(id) === i)
  for (const id of MOVABLE) if (!order.includes(id)) order.push(id)
  const hidden = config.hidden.filter((id) => id !== 'message' && id in COLUMN_LABELS)
  const widths = { ...config.widths }
  // Hasta la v0.6.1 los carriles medían 16 px: un ancho de gráfico elegido entonces corta las fotos de
  // los nodos (24 px por carril). Se vuelve a ajustar a los carriles una sola vez.
  if ((config.version ?? 1) < 2) delete widths.graph
  return { order, hidden, widths, version: 2 }
}

export const clampWidth = (id: ColumnId, width: number) => Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH[id], width)))

/**
 * Columnas a dibujar, en orden y con su ancho. `available` es el ancho de la lista y `graphAuto` el
 * ancho que necesita el gráfico para sus carriles.
 */
export function layoutColumns(config: ColumnsConfig, available: number, graphAuto: number): ColumnLayout[] {
  const { order, hidden, widths } = normalizeColumns(config)
  const width = (id: ColumnId): number | null => {
    if (id === 'message') return null
    if (id === 'graph') return widths.graph ?? graphAuto
    return widths[id] ?? DEFAULT_COLUMNS.widths[id] ?? MIN_WIDTH[id]
  }
  let columns = [...FIXED_FIRST, ...order].filter((id) => !hidden.includes(id)).map((id) => ({ id, width: width(id) }))
  const fixedTotal = () => columns.reduce((sum, c) => sum + (c.width ?? 0), 0)
  for (const id of AUTO_HIDE) {
    if (available - fixedTotal() >= MESSAGE_COMFORT) break
    columns = columns.filter((c) => c.id !== id)
  }
  return columns
}

/** Valor de grid-template-columns para un layout. */
export const gridTemplate = (columns: ColumnLayout[]) => columns.map((c) => (c.width === null ? 'minmax(0, 1fr)' : `${c.width}px`)).join(' ')

/** Mueve una columna antes (o después) de otra. Solo entre las que se pueden mover. */
export function moveColumn(config: ColumnsConfig, id: ColumnId, target: ColumnId, after: boolean): ColumnsConfig {
  if (id === target || !MOVABLE.includes(id) || !MOVABLE.includes(target)) return config
  const order = normalizeColumns(config).order.filter((c) => c !== id)
  order.splice(order.indexOf(target) + (after ? 1 : 0), 0, id)
  return { ...config, order }
}
