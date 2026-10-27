// Perfiles de usuario, como en GitKraken: varias identidades guardadas (personal, facultad, trabajo)
// para cambiar con un clic el nombre y el email con los que se firman los commits.

import { useSyncExternalStore } from 'react'
import type { GitIdentity } from '../../../shared/types'
import { loadSetting, saveSetting } from './settings'

export interface Profile extends GitIdentity {
  id: string
  /** Cómo se llama el perfil: "Personal", "Facultad". */
  label: string
}

const clean = (saved: unknown): Profile[] =>
  Array.isArray(saved)
    ? saved.filter(
        (p): p is Profile => typeof p?.id === 'string' && typeof p.label === 'string' && typeof p.name === 'string' && typeof p.email === 'string'
      )
    : []

let profiles: Profile[] = clean(loadSetting<unknown[]>('profiles', []))
const listeners = new Set<() => void>()

function commit(next: Profile[]): void {
  profiles = next
  saveSetting('profiles', profiles)
  for (const listener of listeners) listener()
}

export function saveProfile(profile: Omit<Profile, 'id'> & { id?: string }): Profile {
  const saved: Profile = { ...profile, id: profile.id ?? crypto.randomUUID() }
  commit(profiles.some((p) => p.id === saved.id) ? profiles.map((p) => (p.id === saved.id ? saved : p)) : [...profiles, saved])
  return saved
}

export const deleteProfile = (id: string) => commit(profiles.filter((p) => p.id !== id))

export const sameIdentity = (a: GitIdentity | null, b: GitIdentity | null) =>
  a !== null && b !== null && a.name === b.name && a.email.toLowerCase() === b.email.toLowerCase()

// Otra ventana cambió los perfiles.
window.addEventListener('storage', (e) => {
  if (e.key !== 'gitono:profiles') return
  profiles = clean(loadSetting<unknown[]>('profiles', []))
  for (const listener of listeners) listener()
})

export function useProfiles(): Profile[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => profiles
  )
}
