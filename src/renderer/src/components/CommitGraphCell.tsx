import type { GraphRow } from '../lib/graph'

export const LANE_WIDTH = 16
export const ROW_HEIGHT = 32
const MIDDLE = ROW_HEIGHT / 2
/** Cantidad de colores de carril definidos en styles.css (--lane-0 … --lane-7). */
const LANE_COUNT = 8

/** Color de un carril, tomado del tema (claro u oscuro). El -1 es el carril gris de WIP. */
export const laneColor = (index: number): string => (index < 0 ? 'var(--lane-wip)' : `var(--lane-${index % LANE_COUNT})`)

const laneX = (lane: number): number => lane * LANE_WIDTH + LANE_WIDTH / 2

/** Línea recta si no cambia de carril; curva suave si pasa de un carril a otro. */
function segment(x1: number, y1: number, x2: number, y2: number): string {
  if (x1 === x2) return `M${x1} ${y1}V${y2}`
  const middleY = (y1 + y2) / 2
  return `M${x1} ${y1}C${x1} ${middleY} ${x2} ${middleY} ${x2} ${y2}`
}

interface Props {
  row: GraphRow
  /** Carriles visibles: el ancho de la columna del gráfico. */
  lanes: number
  isHead: boolean
  isMerge: boolean
  /** Fila de cambios sin commitear: nodo hueco y punteado. */
  isVirtual?: boolean
  /** El commit tiene etiquetas de rama o tag: se une con una línea a la columna de etiquetas. */
  hasRefs?: boolean
  /** Es parte del linaje de la rama elegida. */
  emphasized?: boolean
}

export function CommitGraphCell({ row, lanes, isHead, isMerge, isVirtual = false, hasRefs = false, emphasized = false }: Props) {
  const x = laneX(row.column)
  const color = laneColor(row.color)
  return (
    <svg className={`graph-cell${emphasized ? ' graph-cell--emphasized' : ''}`} width={lanes * LANE_WIDTH} height={ROW_HEIGHT} aria-hidden>
      {hasRefs && <path className="graph-cell__connector" d={`M0 ${MIDDLE}H${x - 6}`} style={{ stroke: color }} />}
      {row.top.map((line, i) => (
        <path
          key={`t${i}`}
          d={segment(laneX(line.from), 0, laneX(line.to), MIDDLE)}
          style={{ stroke: laneColor(line.color) }}
          strokeDasharray={line.dashed ? '3 3' : undefined}
        />
      ))}
      {row.bottom.map((line, i) => (
        <path
          key={`b${i}`}
          d={segment(laneX(line.from), MIDDLE, laneX(line.to), ROW_HEIGHT)}
          style={{ stroke: laneColor(line.color) }}
          strokeDasharray={line.dashed ? '3 3' : undefined}
        />
      ))}
      {(isHead || emphasized) && <circle className="graph-cell__halo" cx={x} cy={MIDDLE} r={9} style={{ stroke: color }} />}
      {isVirtual ? (
        <circle className="graph-cell__virtual" cx={x} cy={MIDDLE} r={6} style={{ stroke: color }} />
      ) : isMerge ? (
        <circle className="graph-cell__merge" cx={x} cy={MIDDLE} r={4.5} style={{ stroke: color }} />
      ) : (
        <circle className="graph-cell__node" cx={x} cy={MIDDLE} r={5.5} style={{ fill: color }} />
      )}
    </svg>
  )
}
