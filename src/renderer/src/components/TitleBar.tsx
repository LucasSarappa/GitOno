import { FolderGit2, Plus, X } from 'lucide-react'
import type { MouseEvent, ReactNode } from 'react'
import onoMark from '../assets/ono-mark.svg'
import { t } from '../../../shared/i18n'

export interface TabInfo {
  id: string
  title: string
  /** Ruta completa del repo, para el tooltip; vacía en una pestaña nueva. */
  path: string
}

interface Props {
  tabs: TabInfo[]
  activeId: string
  onSelect(id: string): void
  onClose(id: string): void
  onNew(): void
  /** Lo que va a la derecha de las pestañas (el perfil del usuario). */
  end?: ReactNode
}

/** Barra de título con las pestañas de repos, como en GitKraken. Se puede arrastrar la ventana desde ella. */
export function TitleBar({ tabs, activeId, onSelect, onClose, onNew, end }: Props) {
  const close = (e: MouseEvent, id: string) => {
    e.stopPropagation()
    onClose(id)
  }
  return (
    <header className="titlebar">
      <img className="titlebar__logo" src={onoMark} alt="GitOno" draggable={false} />
      <nav className="titlebar__tabs" role="tablist" aria-label={t('Repositorios abiertos')}>
        {tabs.map((tab) => {
          const active = tab.id === activeId
          return (
            <div
              key={tab.id}
              role="tab"
              tabIndex={active ? 0 : -1}
              aria-selected={active}
              className={`repo-tab${active ? ' repo-tab--active' : ''}`}
              title={tab.path || t('Nueva pestaña')}
              onClick={() => onSelect(tab.id)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(tab.id)}
              // Clic con la rueda del mouse cierra la pestaña, como en el navegador.
              onAuxClick={(e) => e.button === 1 && close(e, tab.id)}
            >
              <FolderGit2 size={14} strokeWidth={1.75} aria-hidden />
              <span className="repo-tab__name">{tab.title}</span>
              <button className="repo-tab__close" aria-label={t('Cerrar {title}', { title: tab.title })} title={t('Cerrar (Ctrl+W)')} onClick={(e) => close(e, tab.id)}>
                <X size={13} strokeWidth={2} />
              </button>
            </div>
          )
        })}
        <button className="titlebar__new" onClick={onNew} aria-label={t('Nueva pestaña')} title={t('Nueva pestaña (Ctrl+T)')}>
          <Plus size={16} strokeWidth={1.75} />
        </button>
      </nav>
      {end && <div className="titlebar__end">{end}</div>}
    </header>
  )
}
