import { Check, Pencil, Plus, Trash, UserRound } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { GitIdentity, IdentityInfo } from '../../../shared/types'
import { t } from '../../../shared/i18n'
import { api } from '../api'
import { deleteProfile, sameIdentity, saveProfile, useProfiles, type Profile } from '../lib/profiles'
import { Avatar } from './Avatar'
import { useDialog } from './Dialog'

interface Props {
  /** Repo de la pestaña activa: su identidad propia manda sobre la global. */
  root: string | null
  repoName: string | null
}

/**
 * Botón con la foto del usuario, arriba a la derecha como en GitKraken. Muestra con qué nombre y
 * email se firman los commits y permite cambiarlos con perfiles guardados: para todos los repos
 * (git config --global) o solo para el de la pestaña.
 */
export function ProfileMenu({ root, repoName }: Props) {
  const profiles = useProfiles()
  const dialog = useDialog()
  const [identity, setIdentity] = useState<IdentityInfo>({ global: null, local: null })
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, right: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const reload = useCallback(async () => {
    try {
      const info = await api.readIdentity(root)
      setIdentity(info)
      return info
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return null
    }
  }, [root])

  // También al volver a la ventana: la identidad se puede haber cambiado desde la terminal.
  useEffect(() => {
    void reload()
    const onFocus = () => void reload()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [reload])

  const effective = identity.local ?? identity.global

  const toggle = async () => {
    const rect = buttonRef.current!.getBoundingClientRect()
    setPosition({ top: rect.bottom + 8, right: window.innerWidth - rect.right })
    setError(null)
    setOpen((o) => !o)
    // La primera vez, la identidad global pasa a ser el perfil "Personal".
    const info = await reload()
    if (info?.global && profiles.length === 0) saveProfile({ label: t('Personal'), ...info.global })
  }

  // Se cierra con Esc o con un clic afuera (salvo en un diálogo abierto desde acá).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !document.querySelector('.dialog') && setOpen(false)
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target) && !target.closest('.dialog, .dialog-backdrop')) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  const apply = async (target: string | null, value: GitIdentity | null) => {
    setError(null)
    try {
      await api.writeIdentity(target, value)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const edit = (profile?: Profile) =>
    void dialog.show({
      title: profile ? t('Editar el perfil') : t('Nuevo perfil'),
      description: t('Git firma tus commits con este nombre y este email.'),
      fields: [
        { name: 'label', label: t('Nombre del perfil'), value: profile?.label ?? '', placeholder: t('Personal, Facultad, Trabajo…'), required: true },
        { name: 'name', label: t('Nombre para los commits'), value: profile?.name ?? effective?.name ?? '', required: true },
        { name: 'email', label: t('Email'), value: profile?.email ?? '', placeholder: 'nombre@ejemplo.com', required: true }
      ],
      confirmLabel: t('Guardar'),
      onSubmit: async (values) => {
        const next = { label: String(values.label).trim(), name: String(values.name).trim(), email: String(values.email).trim() }
        if (!/^[^\s@<>]+@[^\s@<>]+$/.test(next.email)) throw new Error(t('"{email}" no parece un email.', { email: next.email }))
        const wasInUse = profile && sameIdentity(profile, effective)
        saveProfile({ ...next, id: profile?.id })
        // Si se editó el perfil en uso, se actualiza también la configuración de Git.
        if (wasInUse) await api.writeIdentity(identity.local ? root : null, next)
        await reload()
      }
    })

  const remove = (profile: Profile) =>
    void dialog.show({
      title: t('Borrar el perfil "{label}"', { label: profile.label }),
      description: t('Solo se borra de la lista: la configuración de Git no cambia.'),
      confirmLabel: t('Borrar'),
      danger: true,
      onSubmit: () => deleteProfile(profile.id)
    })

  return (
    <>
      <button
        ref={buttonRef}
        className={`profile-button${open ? ' profile-button--open' : ''}`}
        aria-label={t('Perfil de Git')}
        aria-expanded={open}
        title={effective ? `${effective.name} <${effective.email}>` : t('Perfil de Git')}
        onClick={() => void toggle()}
      >
        {effective ? <Avatar name={effective.name} email={effective.email} size={26} /> : <UserRound size={17} strokeWidth={1.75} />}
      </button>
      {open &&
        createPortal(
          <div ref={menuRef} className="menu menu--profile glass" role="dialog" aria-label={t('Perfil de Git')} style={{ top: position.top, right: position.right }}>
            <div className="profile-current">
              {effective ? <Avatar name={effective.name} email={effective.email} size={40} /> : <UserRound size={28} strokeWidth={1.5} />}
              <div className="profile-current__text">
                <strong>{effective?.name ?? t('Sin nombre configurado')}</strong>
                <span className="text-2">{effective?.email ?? t('Sin email configurado')}</span>
                <span className="profile-current__scope">
                  {identity.local ? t('Solo en {repo}', { repo: repoName ?? '' }) : t('En todos los repos')}
                </span>
              </div>
            </div>
            <p className="text-2 small profile-note">{t('Git firma tus commits con este nombre y este email.')}</p>

            <div className="menu__separator" />

            <div className="menu__group">
              <span className="menu__label">{t('Perfiles')}</span>
              {profiles.length === 0 && <p className="text-2 small">{t('Todavía no hay perfiles guardados.')}</p>}
              <ul className="profile-list">
                {profiles.map((profile) => {
                  const inUse = sameIdentity(profile, effective)
                  return (
                    <li key={profile.id} className={`profile-row${inUse ? ' profile-row--active' : ''}`}>
                      <button
                        className="profile-row__main"
                        onClick={() => void apply(null, profile)}
                        title={t('Usar en todos los repos (git config --global)')}
                      >
                        <Avatar name={profile.name} email={profile.email} size={26} />
                        <span className="profile-row__text">
                          <span className="profile-row__label">{profile.label}</span>
                          <span className="profile-row__identity">
                            {profile.name} · {profile.email}
                          </span>
                        </span>
                        {inUse && <Check size={14} strokeWidth={2.25} className="profile-row__check" aria-label={t('en uso')} />}
                      </button>
                      <span className="profile-row__actions">
                        {root && (
                          <button
                            className="btn btn--sm btn--ghost"
                            onClick={() => void apply(root, profile)}
                            title={t('Usar este perfil solo en {repo}', { repo: repoName ?? '' })}
                          >
                            {t('Solo acá')}
                          </button>
                        )}
                        <button className="btn btn--icon btn--sm btn--ghost" aria-label={t('Editar {label}', { label: profile.label })} onClick={() => edit(profile)}>
                          <Pencil size={13} strokeWidth={1.75} />
                        </button>
                        <button className="btn btn--icon btn--sm btn--ghost" aria-label={t('Borrar {label}', { label: profile.label })} onClick={() => remove(profile)}>
                          <Trash size={13} strokeWidth={1.75} />
                        </button>
                      </span>
                    </li>
                  )
                })}
              </ul>
              <button className="btn btn--sm menu__wide" onClick={() => edit()}>
                <Plus size={14} strokeWidth={2} aria-hidden />
                {t('Nuevo perfil…')}
              </button>
            </div>

            {identity.local && root && (
              <>
                <div className="menu__separator" />
                <button className="btn btn--sm menu__wide" onClick={() => void apply(root, null)}>
                  {t('Usar la identidad global en {repo}', { repo: repoName ?? '' })}
                </button>
              </>
            )}
            {error && (
              <p className="profile-error small" role="alert">
                {error}
              </p>
            )}
          </div>,
          document.body
        )}
    </>
  )
}
