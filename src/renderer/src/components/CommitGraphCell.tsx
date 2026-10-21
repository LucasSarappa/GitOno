import type { GraphRow } from '../lib/graph'

export const LANE_WIDTH = 16
export const ROW_HEIGHT = 30
const MIDDLE = ROW_HEIGHT / 2

// Colores de los carriles: tonos medios que se leen bien en tema claro y oscuro.
const LANE_COLORS = ['#4c8df6', '#e5a50a', '#2fb67c', '#e5534b', '#a371f7', '#1fb5c9', '#f0659d', '#8d9db0']

export const laneColor = (index: number): string => LANE_COLORS[index % LANE_COLORS.length]

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
}

export function CommitGraphCell({ row, lanes, isHead, isMerge }: Props) {
  const x = laneX(row.column)
  const color = laneColor(row.color)
  return (
    <svg className="graph-cell" width={lanes * LANE_WIDTH} height={ROW_HEIGHT} aria-hidden>
      {row.top.map((line, i) => (
        <path key={`t${i}`} d={segment(laneX(line.from), 0, laneX(line.to), MIDDLE)} stroke={laneColor(line.color)} />
      ))}
      {row.bottom.map((line, i) => (
        <path key={`b${i}`} d={segment(laneX(line.from), MIDDLE, laneX(line.to), ROW_HEIGHT)} stroke={laneColor(line.color)} />
      ))}
      {isHead && <circle className="graph-cell__head" cx={x} cy={MIDDLE} r={8.5} stroke={color} />}
      {isMerge ? (
        <circle className="graph-cell__merge" cx={x} cy={MIDDLE} r={4} stroke={color} />
      ) : (
        <circle cx={x} cy={MIDDLE} r={5.5} fill={color} />
      )}
    </svg>
  )
}
