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
}

export function computeGraph(commits: GraphCommit[]): Graph {
  const lanes: (string | null)[] = []
  const laneColors: number[] = []
  let nextColor = 0
  let width = 0

  const openLane = (sha: string): number => {
    let index = lanes.indexOf(null)
    if (index === -1) index = lanes.length
    lanes[index] = sha
    laneColors[index] = nextColor++
    return index
  }

  const rows = commits.map((commit): GraphRow => {
    const before = lanes.slice()
    const incoming = before.flatMap((sha, i) => (sha === commit.sha ? [i] : []))
    const top: GraphLine[] = []
    const bottom: GraphLine[] = []

    // Si ningún carril lo esperaba, es la punta de una rama: abre un carril propio, sin línea arriba.
    const column = incoming.length > 0 ? incoming[0] : openLane(commit.sha)
    const color = laneColors[column]

    before.forEach((sha, i) => {
      if (sha === null) return
      // Los carriles que esperaban este commit convergen en el nodo; el resto sigue derecho.
      top.push({ from: i, to: sha === commit.sha ? column : i, color: laneColors[i] })
    })

    for (const i of incoming.slice(1)) lanes[i] = null
    const [firstParent, ...otherParents] = commit.parents
    lanes[column] = firstParent ?? null

    for (const parent of otherParents) {
      const existing = lanes.indexOf(parent)
      const lane = existing !== -1 ? existing : openLane(parent)
      bottom.push({ from: column, to: lane, color: laneColors[lane] })
    }

    lanes.forEach((sha, i) => {
      if (sha === null) return
      if (i === column) {
        bottom.push({ from: column, to: column, color })
        return
      }
      // Siguen derecho los carriles que ya venían de arriba con otro commit pendiente
      // (no los que se acaban de abrir para un padre del merge).
      const carried = before[i] ?? null
      if (carried !== null && carried !== commit.sha) bottom.push({ from: i, to: i, color: laneColors[i] })
    })

    width = Math.max(width, before.length, lanes.length)
    while (lanes.length > 0 && lanes[lanes.length - 1] === null) {
      lanes.pop()
      laneColors.pop()
    }
    return { column, color, top, bottom }
  })

  return { rows, width }
}
