// Distribución del gráfico de commits en carriles (columnas), como en GitKraken.
//
// Se recorren los commits de más nuevo a más viejo. Cada carril "espera" a un commit: el
// próximo que va a aparecer en esa columna. Cuando llega ese commit, el carril pasa a esperar
// a su primer padre; los demás padres (en un merge) abren carriles nuevos o se unen a uno
// que ya los esperaba. Cada fila guarda las líneas de su mitad de arriba y de abajo, así se
// puede dibujar fila por fila sin conocer el resto del gráfico.

export interface GraphLine {
  /** Carril donde empieza la línea (arriba de todo, o en el nodo para la mitad de abajo). */
  from: number
  /** Carril donde termina (en el nodo para la mitad de arriba, o abajo de todo). */
  to: number
  color: number
  /** Línea punteada: une una fila que no es un commit real (los cambios sin commitear) con su padre. */
  dashed?: boolean
}

export interface GraphRow {
  /** Carril del nodo del commit. */
  column: number
  color: number
  /** Líneas desde el borde superior de la fila hasta el centro. */
  top: GraphLine[]
  /** Líneas desde el centro de la fila hasta el borde inferior. */
  bottom: GraphLine[]
}

export interface Graph {
  rows: GraphRow[]
  /** Cantidad máxima de carriles usados al mismo tiempo. */
  width: number
}

interface GraphCommit {
  sha: string
  parents: string[]
  /** Fila que no es un commit real, como los cambios sin commitear (WIP). */
  virtual?: boolean
}

/**
 * Filas de los stashes, intercaladas entre los commits por fecha, como en GitKraken. Cada una va
 * arriba de su commit base (si no, la línea hacia él subiría) y solo si ese commit está cargado.
 */
export function withStashRows<C extends { sha: string; authorDate: number }>(
  commits: C[],
  stashes: { sha: string; base: string; date: number }[],
  toRow: (stash: { sha: string; base: string; date: number }) => C
): C[] {
  if (stashes.length === 0) return commits
  const position = new Map(commits.map((c, i) => [c.sha, i]))
  const before = new Map<number, C[]>()
  for (const stash of [...stashes].sort((a, b) => b.date - a.date)) {
    const base = position.get(stash.base)
    if (base === undefined) continue
    const older = commits.findIndex((c) => c.authorDate < stash.date)
    const at = older === -1 ? base : Math.min(older, base)
    before.set(at, [...(before.get(at) ?? []), toRow(stash)])
  }
  return commits.flatMap((commit, i) => [...(before.get(i) ?? []), commit])
}

/** Color de los carriles de filas virtuales (WIP): se dibuja gris. */
export const VIRTUAL_COLOR = -1

const line = (from: number, to: number, color: number, dashed: boolean): GraphLine =>
  dashed ? { from, to, color, dashed } : { from, to, color }

export function computeGraph(commits: GraphCommit[]): Graph {
  const lanes: (string | null)[] = []
  const laneColors: number[] = []
  const laneDashed: boolean[] = []
  let nextColor = 0
  let width = 0

  const openLane = (sha: string, virtual = false): number => {
    let index = lanes.indexOf(null)
    if (index === -1) index = lanes.length
    lanes[index] = sha
    laneColors[index] = virtual ? VIRTUAL_COLOR : nextColor++
    laneDashed[index] = virtual
    return index
  }

  const rows = commits.map((commit): GraphRow => {
    const before = lanes.slice()
    const incoming = before.flatMap((sha, i) => (sha === commit.sha ? [i] : []))
    const top: GraphLine[] = []
    const bottom: GraphLine[] = []

    // Si ningún carril lo esperaba, es la punta de una rama: abre un carril propio, sin línea arriba.
    const column = incoming.length > 0 ? incoming[0] : openLane(commit.sha, commit.virtual)

    before.forEach((sha, i) => {
      if (sha === null) return
      // Los carriles que esperaban este commit convergen en el nodo; el resto sigue derecho.
      top.push(line(i, sha === commit.sha ? column : i, laneColors[i], laneDashed[i]))
    })

    // Un commit real que llega por el carril gris de WIP pasa a tener un color propio.
    if (laneColors[column] === VIRTUAL_COLOR && !commit.virtual) laneColors[column] = nextColor++
    const color = laneColors[column]

    for (const i of incoming.slice(1)) lanes[i] = null
    const [firstParent, ...otherParents] = commit.parents
    lanes[column] = firstParent ?? null
    laneDashed[column] = Boolean(commit.virtual)

    for (const parent of otherParents) {
      const existing = lanes.indexOf(parent)
      const lane = existing !== -1 ? existing : openLane(parent)
      bottom.push(line(column, lane, laneColors[lane], false))
    }

    lanes.forEach((sha, i) => {
      if (sha === null) return
      if (i === column) {
        bottom.push(line(column, column, color, laneDashed[column]))
        return
      }
      // Siguen derecho los carriles que ya venían de arriba con otro commit pendiente
      // (no los que se acaban de abrir para un padre del merge).
      const carried = before[i] ?? null
      if (carried !== null && carried !== commit.sha) bottom.push(line(i, i, laneColors[i], laneDashed[i]))
    })

    width = Math.max(width, before.length, lanes.length)
    while (lanes.length > 0 && lanes[lanes.length - 1] === null) {
      lanes.pop()
      laneColors.pop()
      laneDashed.pop()
    }
    return { column, color, top, bottom }
  })

  return { rows, width }
}
