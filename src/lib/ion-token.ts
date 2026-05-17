const STORAGE_KEY = 'cesium-ion-token'

export function readIonToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(STORAGE_KEY)
}

export function writeIonToken(token: string): void {
  window.localStorage.setItem(STORAGE_KEY, token)
}

export function clearIonToken(): void {
  window.localStorage.removeItem(STORAGE_KEY)
}
