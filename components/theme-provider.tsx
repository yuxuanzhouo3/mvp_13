'use client'

import * as React from 'react'
import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from 'next-themes'

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  React.useEffect(() => {
    const key = '__chunk_reload_once__'
    sessionStorage.removeItem(key)
    const shouldReload = (reason: unknown) => {
      const text = String((reason as any)?.message || reason || '')
      if (!text) return false
      return (
        text.includes('ChunkLoadError') ||
        text.includes('Loading chunk') ||
        text.includes('Failed to fetch dynamically imported module')
      )
    }
    const reloadOnce = () => {
      if (typeof window === 'undefined') return
      if (sessionStorage.getItem(key) === '1') return
      sessionStorage.setItem(key, '1')
      window.location.reload()
    }
    const onError = (event: ErrorEvent) => {
      if (shouldReload(event.error || event.message)) {
        reloadOnce()
      }
    }
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (shouldReload(event.reason)) {
        reloadOnce()
      }
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onUnhandledRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
    }
  }, [])

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
