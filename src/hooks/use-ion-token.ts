import { useCallback, useEffect, useState } from 'react'
import { clearIonToken, readIonToken, writeIonToken } from '#/lib/ion-token.ts'

export function useIonToken() {
  const [token, setToken] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setToken(readIonToken())
    setHydrated(true)
  }, [])

  const save = useCallback((next: string) => {
    writeIonToken(next)
    setToken(next)
  }, [])

  const clear = useCallback(() => {
    clearIonToken()
    setToken(null)
  }, [])

  return { token, hydrated, save, clear }
}
