// Preferencias de la interfaz (ancho del panel, opciones del diff) guardadas en el navegador interno.
// Si el almacenamiento falla, la app sigue funcionando con los valores por defecto.

const PREFIX = 'gitono:'

export function loadSetting<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw === null) return fallback
    const saved: unknown = JSON.parse(raw)
    if (Array.isArray(fallback)) return (Array.isArray(saved) ? saved : fallback) as T
    if (typeof fallback === 'object' && fallback !== null) {
      // Se combina con el valor por defecto para que una opción nueva no quede vacía.
      return typeof saved === 'object' && saved !== null ? { ...fallback, ...saved } : fallback
    }
    return typeof saved === typeof fallback ? (saved as T) : fallback
  } catch {
    return fallback
  }
}

export function saveSetting(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // sin almacenamiento disponible: no se recuerda la preferencia
  }
}
