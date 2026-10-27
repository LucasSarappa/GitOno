import { FolderGit2, FolderOpen, X } from 'lucide-react'
import { useState } from 'react'
import onoFull from '../assets/ono.svg'
import { forgetRecent, loadRecent } from '../lib/recent'
import { t } from '../../../shared/i18n'

interface Props {
  onOpen(): void
  onOpenPath(path: string): void
  error: string | null
}

/** Pestaña nueva: abrir un repo o volver a uno reciente. */
export function Welcome({ onOpen, onOpenPath, error }: Props) {
  const [recent, setRecent] = useState(loadRecent)

  return (
    <div className="welcome">
      <div className="welcome__panel glass">
        <img className="welcome__logo" src={onoFull} alt={t('Ono, el caniche que le da nombre a GitOno')} draggable={false} />
        <h1 className="welcome__title">GitOno</h1>
        <p className="welcome__lead">{t('Historial, ramas y commits de tus repositorios Git. Gratis y sin cuenta.')}</p>
        <div className="welcome__actions">
          <button className="btn btn--primary btn--lg" onClick={onOpen}>
            <FolderOpen size={16} strokeWidth={1.75} aria-hidden />
            {t('Abrir repositorio…')}
          </button>
          <kbd>Ctrl+O</kbd>
        </div>
        {error && (
          <p className="welcome__error" role="alert">
            {error}
          </p>
        )}

        {recent.length > 0 && (
          <section className="welcome__recent" aria-labelledby="recientes">
            <h2 id="recientes">{t('Recientes')}</h2>
            <ul>
              {recent.map((repo) => (
                <li key={repo.root} className="recent">
                  <button className="recent__open" onClick={() => onOpenPath(repo.root)} title={repo.root}>
                    <FolderGit2 size={15} strokeWidth={1.75} aria-hidden />
                    <span className="recent__name">{repo.name}</span>
                    <span className="recent__path">{repo.root}</span>
                  </button>
                  <button
                    className="btn btn--icon btn--ghost recent__forget"
                    aria-label={t('Quitar {name} de recientes', { name: repo.name })}
                    title={t('Quitar de recientes')}
                    onClick={() => {
                      forgetRecent(repo.root)
                      setRecent(loadRecent())
                    }}
                  >
                    <X size={14} strokeWidth={1.75} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
