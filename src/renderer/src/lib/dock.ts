import { t } from '../../../shared/i18n'
// Disposición de los tres cuadros del historial: el panel de ramas y el de detalle se pegan a un
// borde (izquierda, derecha, arriba o abajo) y el gráfico ocupa lo que queda. Como en un "dock":
// el primero de la lista es el de más afuera y ocupa todo su borde; los siguientes, lo que sobra.
// Todo se dibuja en una sola grilla CSS, así mover un panel no vuelve a crear los demás.

export type PanelId = 'refs' | 'details'
export type Side = 'left' | 'right' | 'top' | 'bottom'
export type Placement = 'outer' | 'inner'

export interface DockPanel {
  panel: PanelId
  side: Side
  /** Ancho (izquierda o derecha) o alto (arriba o abajo), en píxeles. */
  size: number
  open: boolean
}

export interface DockLayout {
  /** En orden: el primero es el de más afuera. */
  docks: DockPanel[]
}

export const PANEL_NAMES: Record<PanelId, string> = { refs: t('Ramas'), details: t('Detalle') }
export const SIDE_NAMES: Record<Side, string> = { left: t('a la izquierda'), right: t('a la derecha'), top: t('arriba'), bottom: t('abajo') }

const DEFAULT_SIZE: Record<PanelId, { across: number; along: number }> = {
  // across: ancho si va a un costado; along: alto si va arriba o abajo.
  refs: { across: 220, along: 200 },
  details: { across: 348, along: 300 }
}
export const SIZE_LIMITS = { min: 120, max: 900 }

export const isHorizontal = (side: Side) => side === 'left' || side === 'right'
export const opposite = (side: Side): Side => ({ left: 'right', right: 'left', top: 'bottom', bottom: 'top' })[side] as Side
export const defaultSize = (panel: PanelId, side: Side) => (isHorizontal(side) ? DEFAULT_SIZE[panel].across : DEFAULT_SIZE[panel].along)
const clamp = (size: number) => Math.round(Math.min(SIZE_LIMITS.max, Math.max(SIZE_LIMITS.min, size)))

export const DEFAULT_LAYOUT: DockLayout = {
  docks: [
    { panel: 'refs', side: 'left', size: 220, open: true },
    { panel: 'details', side: 'right', size: 348, open: true }
  ]
}

const SIDES: Side[] = ['left', 'right', 'top', 'bottom']

/** Arregla una disposición guardada: cada panel una vez, lados válidos y tamaños razonables. */
export function normalizeLayout(layout: DockLayout | undefined): DockLayout {
  const seen = new Set<PanelId>()
  const docks: DockPanel[] = []
  for (const dock of layout?.docks ?? []) {
    if (!dock || !(dock.panel in PANEL_NAMES) || seen.has(dock.panel) || !SIDES.includes(dock.side)) continue
    seen.add(dock.panel)
    const size = Number.isFinite(dock.size) ? clamp(dock.size) : defaultSize(dock.panel, dock.side)
    docks.push({ panel: dock.panel, side: dock.side, size, open: dock.open !== false })
  }
  for (const fallback of DEFAULT_LAYOUT.docks) if (!seen.has(fallback.panel)) docks.push({ ...fallback })
  return { docks }
}

/** Pega un panel a un lado: afuera de todo (ocupa el borde completo) o al lado del gráfico. */
export function movePanel(layout: DockLayout, panel: PanelId, side: Side, placement: Placement): DockLayout {
  const current = layout.docks.find((d) => d.panel === panel)
  if (!current) return layout
  const rest = layout.docks.filter((d) => d.panel !== panel)
  // Si cambia de orientación (de costado a arriba o abajo), el tamaño viejo no sirve.
  const size = isHorizontal(current.side) === isHorizontal(side) ? current.size : defaultSize(panel, side)
  const moved: DockPanel = { ...current, side, size, open: true }
  return { docks: placement === 'outer' ? [moved, ...rest] : [...rest, moved] }
}

/**
 * Lleva el gráfico hacia un lado: los paneles que estaban de ese lado pasan al opuesto. Si ningún
 * panel está de ese lado, el gráfico ya toca ese borde y no cambia nada.
 */
export function moveCenter(layout: DockLayout, side: Side): DockLayout {
  if (!layout.docks.some((d) => d.open && d.side === side)) return layout
  return { docks: layout.docks.map((d) => (d.side === side ? { ...d, side: opposite(side) } : d)) }
}

export function setPanelOpen(layout: DockLayout, panel: PanelId, open: boolean): DockLayout {
  return { docks: layout.docks.map((d) => (d.panel === panel ? { ...d, open } : d)) }
}

export function resizePanel(layout: DockLayout, panel: PanelId, size: number): DockLayout {
  return { docks: layout.docks.map((d) => (d.panel === panel ? { ...d, size: clamp(size) } : d)) }
}

export const PRESETS: { id: string; label: string; layout: DockLayout }[] = [
  { id: 'clasica', label: t('Clásica (como GitKraken)'), layout: DEFAULT_LAYOUT },
  {
    id: 'espejada',
    label: t('Espejada: detalle a la izquierda, ramas a la derecha'),
    layout: {
      docks: [
        { panel: 'details', side: 'left', size: 348, open: true },
        { panel: 'refs', side: 'right', size: 220, open: true }
      ]
    }
  },
  {
    id: 'detalle-abajo',
    label: t('Detalle abajo del gráfico'),
    layout: {
      docks: [
        { panel: 'refs', side: 'left', size: 220, open: true },
        { panel: 'details', side: 'bottom', size: 300, open: true }
      ]
    }
  },
  {
    id: 'ramas-arriba',
    label: t('Ramas arriba del gráfico'),
    layout: {
      docks: [
        { panel: 'details', side: 'right', size: 348, open: true },
        { panel: 'refs', side: 'top', size: 200, open: true }
      ]
    }
  },
  {
    id: 'grafico-derecha',
    label: t('Gráfico a la derecha'),
    layout: {
      docks: [
        { panel: 'refs', side: 'left', size: 220, open: true },
        { panel: 'details', side: 'left', size: 348, open: true }
      ]
    }
  },
  {
    id: 'enfoque',
    label: t('Solo el gráfico'),
    layout: {
      docks: [
        { panel: 'refs', side: 'left', size: 220, open: false },
        { panel: 'details', side: 'right', size: 348, open: false }
      ]
    }
  }
]

/** La disposición coincide con un preset (para tildarlo en el menú). */
export function matchingPreset(layout: DockLayout): string | null {
  const key = (l: DockLayout) => l.docks.map((d) => `${d.panel}:${d.side}:${d.open}`).join('|')
  return PRESETS.find((p) => key(p.layout) === key(layout))?.id ?? null
}

export interface GridArea {
  gridColumn: string
  gridRow: string
}

export interface DockGrid {
  columns: string
  rows: string
  center: GridArea
  /** Área de cada panel abierto y de su divisor. */
  panels: Partial<Record<PanelId, { panel: GridArea; splitter: GridArea; side: Side }>>
}

/**
 * Convierte la disposición en una grilla CSS. Cada panel abierto se "corta" de un borde de la
 * región que queda, empezando por el de más afuera: suma una pista para él y otra para su divisor,
 * y ocupa el alto (o el ancho) que la región tenía en ese momento. `splitter` es el ancho del
 * divisor (un valor CSS).
 */
export function layoutGrid(layout: DockLayout, splitter: string): DockGrid {
  const left: string[] = []
  const right: string[] = []
  const top: string[] = []
  const bottom: string[] = []
  const panels: DockGrid['panels'] = {}
  const columnSpan = () => `${left.length + 1} / ${-(right.length + 1)}`
  const rowSpan = () => `${top.length + 1} / ${-(bottom.length + 1)}`

  for (const dock of layout.docks) {
    if (!dock.open) continue
    const size = `${dock.size}px`
    if (dock.side === 'left') {
      const at = left.length
      panels[dock.panel] = {
        side: dock.side,
        panel: { gridColumn: `${at + 1} / ${at + 2}`, gridRow: rowSpan() },
        splitter: { gridColumn: `${at + 2} / ${at + 3}`, gridRow: rowSpan() }
      }
      left.push(size, splitter)
    } else if (dock.side === 'right') {
      const at = right.length
      panels[dock.panel] = {
        side: dock.side,
        panel: { gridColumn: `${-(at + 2)} / ${-(at + 1)}`, gridRow: rowSpan() },
        splitter: { gridColumn: `${-(at + 3)} / ${-(at + 2)}`, gridRow: rowSpan() }
      }
      right.push(size, splitter)
    } else if (dock.side === 'top') {
      const at = top.length
      panels[dock.panel] = {
        side: dock.side,
        panel: { gridRow: `${at + 1} / ${at + 2}`, gridColumn: columnSpan() },
        splitter: { gridRow: `${at + 2} / ${at + 3}`, gridColumn: columnSpan() }
      }
      top.push(size, splitter)
    } else {
      const at = bottom.length
      panels[dock.panel] = {
        side: dock.side,
        panel: { gridRow: `${-(at + 2)} / ${-(at + 1)}`, gridColumn: columnSpan() },
        splitter: { gridRow: `${-(at + 3)} / ${-(at + 2)}`, gridColumn: columnSpan() }
      }
      bottom.push(size, splitter)
    }
  }

  return {
    columns: [...left, 'minmax(0, 1fr)', ...[...right].reverse()].join(' '),
    rows: [...top, 'minmax(0, 1fr)', ...[...bottom].reverse()].join(' '),
    center: { gridColumn: columnSpan(), gridRow: rowSpan() },
    panels
  }
}

/** Lado más cercano de un rectángulo a un punto (para saber dónde soltar un panel arrastrado). */
export function nearestSide(rect: { left: number; top: number; width: number; height: number }, x: number, y: number): Side {
  const distances: [Side, number][] = [
    ['left', (x - rect.left) / rect.width],
    ['right', (rect.left + rect.width - x) / rect.width],
    ['top', (y - rect.top) / rect.height],
    ['bottom', (rect.top + rect.height - y) / rect.height]
  ]
  return distances.sort((a, b) => a[1] - b[1])[0][0]
}
