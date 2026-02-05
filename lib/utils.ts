import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getCurrencySymbol() {
  const region =
    (typeof window !== 'undefined'
      ? (window as any).__NEXT_DATA__?.env?.NEXT_PUBLIC_APP_REGION ||
        (process.env as any).NEXT_PUBLIC_APP_REGION
      : (process.env as any).NEXT_PUBLIC_APP_REGION) || 'global'
  const locale =
    typeof document !== 'undefined' ? document.documentElement.lang || '' : ''
  const isChina = region === 'china' || locale.startsWith('zh')
  return isChina ? '￥' : '$'
}
