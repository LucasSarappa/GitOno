import { useCallback, useEffect, useState } from 'react'
import type { RepoInfo } from '../../shared/types'
import { api } from './api'
import { ContextMenuProvider } from './components/ContextMenu'
import { DialogProvider } from './components/Dialog'
import { TitleBar } from './components/TitleBar'
import { Welcome } from './components/Welcome'
import { AppearanceProvider, useAppearance } from './lib/appearance'
import { rememberRecent } from './lib/recent'
import { loadSetting, saveSetting } from './lib/settings'
import { RepoWorkspace } from './views/RepoWorkspace'

interface Tab {
  id: string
  /** null: pestaña nueva, todavía sin repo. */
  repo: RepoInfo | null
}

const newTab = (repo: RepoInfo | null = null): Tab => ({ id: crypto.randomUUID(), repo })

export function App() {
  return (
    <AppearanceProvider>
      <DialogProvider>
        <ContextMenuProvider>
          <Shell />
        </ContextMenuProvider>
      </DialogProvider>
    </AppearanceProvider>
  )
}

function Shell() {
  const [tabs, setTabs] = useState<Tab[]>(() => [newTab()])
  const [activeId, setActiveId] = useState(() => tabs[0].id)
  const [restored, setRestored] = useState(false)
  const { zoomBy } = useAppearance()
  const [error, setError] = useState<string | null>(null)

  // Al abrir: las pestañas de la última vez, más la carpeta pasada por línea de comandos.
  useEffect(() => {
    void (async () => {
      const saved = loadSetting<string[]>('openTabs', [])
      const initial = await api.initialRepoPath().catch(() => null)
      const paths = [...new Set([...saved, ...(initial ? [initial] : [])])]
      const opened: Tab[] = []
      for (const path of paths) {
        try {
          const info = await api.openRepo(path)
          // La misma carpeta puede llegar escrita distinto (C:\x y C:/x): se compara por la raíz de Git.
          if (!opened.some((t) => t.repo?.root === info.root)) opened.push(newTab(info))
          rememberRecent(info.root, info.name)
        } catch {
          // La carpeta ya no existe o dejó de ser un repo: se omite.
        }
      }
      if (opened.length > 0) {
        const wanted = initial ? await api.openRepo(initial).then((r) => r.root, () => '') : loadSetting('activeTab', '')
        setTabs(opened)
        setActiveId((opened.find((t) => t.repo?.root === wanted) ?? opened[0]).id)
      }
      setRestored(true)
    })()
  }, [])

  useEffect(() => {
    if (!restored) return
    saveSetting(
      'openTabs',
      tabs.flatMap((t) => (t.repo ? [t.repo.root] : []))
    )
    saveSetting('activeTab', tabs.find((t) => t.id === activeId)?.repo?.root ?? '')
  }, [tabs, activeId, restored])

  /** Abre un repo en la pestaña activa (si está vacía) o en una nueva. Si ya está abierto, va a esa pestaña. */
  const showRepo = useCallback(
    (info: RepoInfo) => {
      rememberRecent(info.root, info.name)
      setError(null)
      const existing = tabs.find((t) => t.repo?.root === info.root)
      if (existing) {
        setActiveId(existing.id)
        return
      }
      const active = tabs.find((t) => t.id === activeId)
      if (active && !active.repo) {
        setTabs((prev) => prev.map((t) => (t.id === active.id ? { ...t, repo: info } : t)))
      } else {
        const tab = newTab(info)
        setTabs((prev) => [...prev, tab])
        setActiveId(tab.id)
      }
    },
    [tabs, activeId]
  )

  const pickRepo = useCallback(async () => {
    try {
      const info = await api.pickRepo()
      if (info) showRepo(info)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [showRepo])

  const openPath = async (path: string) => {
    try {
      showRepo(await api.openRepo(path))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const addTab = useCallback(() => {
    const tab = newTab()
    setTabs((prev) => [...prev, tab])
    setActiveId(tab.id)
  }, [])

  const closeTab = useCallback(
    (id: string) => {
      const index = tabs.findIndex((t) => t.id === id)
      const rest = tabs.filter((t) => t.id !== id)
      if (rest.length === 0) {
        const tab = newTab()
        setTabs([tab])
        setActiveId(tab.id)
        return
      }
      setTabs(rest)
      if (id === activeId) setActiveId(rest[Math.min(index, rest.length - 1)].id)
    },
    [tabs, activeId]
  )

  // Atajos de pestañas, como en el navegador.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      const key = e.key.toLowerCase()
      if (key === 't') addTab()
      else if (key === 'w') closeTab(activeId)
      else if (key === 'o') void pickRepo()
      else if (e.key === '=' || e.key === '+') zoomBy(1)
      else if (e.key === '-') zoomBy(-1)
      else if (e.key === '0') zoomBy(0)
      else if (e.key === 'Tab') {
        const index = tabs.findIndex((t) => t.id === activeId)
        const next = (index + (e.shiftKey ? tabs.length - 1 : 1)) % tabs.length
        setActiveId(tabs[next].id)
      } else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tabs, activeId, addTab, closeTab, pickRepo, zoomBy])

  return (
    <div className="app" data-platform={api.platform}>
      <TitleBar
        tabs={tabs.map((t) => ({ id: t.id, title: t.repo?.name ?? 'Nueva pestaña', path: t.repo?.root ?? '' }))}
        activeId={activeId}
        onSelect={setActiveId}
        onClose={closeTab}
        onNew={addTab}
      />
      {tabs.map((tab) => (
        <div key={tab.id} className="tab-page" hidden={tab.id !== activeId}>
          {tab.repo ? (
            <RepoWorkspace repo={tab.repo} active={tab.id === activeId} />
          ) : (
            <Welcome onOpen={pickRepo} onOpenPath={openPath} error={tab.id === activeId ? error : null} />
          )}
        </div>
      ))}
    </div>
  )
}
