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

export function getPropertyTypeLabel(propertyType?: string) {
  const region =
    (typeof window !== 'undefined'
      ? (window as any).__NEXT_DATA__?.env?.NEXT_PUBLIC_APP_REGION ||
        (process.env as any).NEXT_PUBLIC_APP_REGION
      : (process.env as any).NEXT_PUBLIC_APP_REGION) || 'global'
  const locale =
    typeof document !== 'undefined' ? document.documentElement.lang || '' : ''
  const isChina = region === 'china' || locale.startsWith('zh')
  const normalized = (propertyType || '').toString().toUpperCase()
  const labels: Record<string, { en: string; zh: string }> = {
    APARTMENT: { en: 'Apartment', zh: '公寓' },
    STUDIO: { en: 'Studio', zh: '工作室' },
    VILLA: { en: 'Villa', zh: '别墅' },
    LUXURY: { en: 'Luxury Apartment', zh: '豪华公寓' },
    TOWNHOUSE: { en: 'Townhouse', zh: '联排住宅' },
    HOUSE: { en: 'House', zh: '独栋住宅' },
    CONDO: { en: 'Condo', zh: '公寓楼' },
    OTHER: { en: 'Other', zh: '其他' },
  }
  const label = labels[normalized]
  if (!label) return propertyType || ''
  return isChina ? label.zh : label.en
}
