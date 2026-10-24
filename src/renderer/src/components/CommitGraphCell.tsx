import type { GraphRow } from '../lib/graph'

/** Ancho de cada carril: más ancho si los nodos llevan la foto del autor. */
export const LANE_WIDTH = 16
export const LANE_WIDTH_AVATARS = 24
export const ROW_HEIGHT = 32
const MIDDLE = ROW_HEIGHT / 2
/** Cantidad de colores de carril definidos en styles.css (--lane-0 … --lane-7). */
const LANE_COUNT = 8
/** Radio del aro de color alrededor de la foto del autor. */
export const AVATAR_RING = 11

/** Color de un carril, tomado del tema. El -1 es el carril gris de WIP. */
export const laneColor = (index: number): string => (index < 0 ? 'var(--lane-wip)' : `var(--lane-${index % LANE_COUNT})`)

/** Margen a los costados del gráfico, para que el halo del commit actual no toque el borde. */
export const GRAPH_PAD = 6

/** Centro horizontal de un carril. */
export const laneX = (lane: number, laneWidth: number): number => GRAPH_PAD + lane * laneWidth + laneWidth / 2

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
  laneWidth: number
  isHead: boolean
  isMerge: boolean
  /** Fila de cambios sin commitear: nodo hueco y punteado. */
  isVirtual?: boolean
  /** El nodo es la foto del autor (la dibuja CommitList encima): acá solo va el aro. */
  avatarNode?: boolean
  /** El commit tiene etiquetas de rama o tag: se une con una línea a la columna de etiquetas. */
  hasRefs?: boolean
  /** Es parte del linaje de la rama elegida. */
  emphasized?: boolean
}

export function CommitGraphCell(props: Props) {
  const { row, lanes, laneWidth, isHead, isMerge, isVirtual = false, avatarNode = false, hasRefs = false, emphasized = false } = props
  const x = laneX(row.column, laneWidth)
  const color = laneColor(row.color)
  const nodeRadius = avatarNode ? AVATAR_RING : isVirtual ? 6 : 5.5
  return (
    <svg className={`graph-cell${emphasized ? ' graph-cell--emphasized' : ''}`} width={lanes * laneWidth + GRAPH_PAD * 2} height={ROW_HEIGHT} aria-hidden>
      {hasRefs && <path className="graph-cell__connector" d={`M0 ${MIDDLE}H${x - nodeRadius - 1}`} style={{ stroke: color }} />}
      {row.top.map((line, i) => (
        <path
          key={`t${i}`}
          d={segment(laneX(line.from, laneWidth), 0, laneX(line.to, laneWidth), MIDDLE)}
          style={{ stroke: laneColor(line.color) }}
          strokeDasharray={line.dashed ? '3 3' : undefined}
        />
      ))}
      {row.bottom.map((line, i) => (
        <path
          key={`b${i}`}
          d={segment(laneX(line.from, laneWidth), MIDDLE, laneX(line.to, laneWidth), ROW_HEIGHT)}
          style={{ stroke: laneColor(line.color) }}
          strokeDasharray={line.dashed ? '3 3' : undefined}
        />
      ))}
      {(isHead || emphasized) && <circle className="graph-cell__halo" cx={x} cy={MIDDLE} r={nodeRadius + 3.5} style={{ stroke: color }} />}
      {isVirtual ? (
        <circle className="graph-cell__virtual" cx={x} cy={MIDDLE} r={6} style={{ stroke: color }} />
      ) : avatarNode ? (
        <circle className="graph-cell__ring" cx={x} cy={MIDDLE} r={AVATAR_RING} style={{ fill: color }} />
      ) : isMerge ? (
        <circle className="graph-cell__merge" cx={x} cy={MIDDLE} r={4.5} style={{ stroke: color }} />
      ) : (
        <circle className="graph-cell__node" cx={x} cy={MIDDLE} r={5.5} style={{ fill: color }} />
      )}
    </svg>
  )
}
