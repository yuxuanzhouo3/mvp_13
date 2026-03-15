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

export function normalizeStringArray(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : String(item || '').trim()))
      .filter(Boolean)
  }
  if (typeof value === 'string') {
    const raw = value.trim()
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => (typeof item === 'string' ? item.trim() : String(item || '').trim()))
          .filter(Boolean)
      }
      if (parsed && typeof parsed === 'object') {
        const nested = (parsed as any).images
        if (Array.isArray(nested)) {
          return nested
            .map((item) => (typeof item === 'string' ? item.trim() : String(item || '').trim()))
            .filter(Boolean)
        }
      }
    } catch {}
    const commaSeparated = raw.split(',').map((item) => item.trim()).filter(Boolean)
    if (commaSeparated.length > 1) return commaSeparated
    if (raw.startsWith('http') || raw.startsWith('data:') || raw.startsWith('/')) return [raw]
    return []
  }
  if (typeof value === 'object') {
    const nested = (value as any).images
    if (Array.isArray(nested)) {
      return nested
        .map((item) => (typeof item === 'string' ? item.trim() : String(item || '').trim()))
        .filter(Boolean)
    }
  }
  return []
}

export function getPrimaryImage(value: unknown, fallback = '/placeholder.svg'): string {
  const images = normalizeStringArray(value)
  return images[0] || fallback
}
