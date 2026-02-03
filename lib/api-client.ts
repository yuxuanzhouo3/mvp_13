/**
 * API 客户端工具函数
 */

const API_BASE = '/api'

export async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || '请求失败')
  }

  return data
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    signup: (data: any) =>
      apiRequest('/auth/signup', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
  properties: {
    search: (params: Record<string, string>) => {
      const query = new URLSearchParams(params).toString()
      return apiRequest(`/properties/search?${query}`)
    },
    list: (params?: Record<string, string>) => {
      const query = params ? `?${new URLSearchParams(params).toString()}` : ''
      return apiRequest(`/properties${query}`)
    },
    get: (id: string) => apiRequest(`/properties/${id}`),
    create: (data: any) =>
      apiRequest('/properties', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
  ai: {
    chat: (query: string, userType: string) =>
      apiRequest('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ query, userType }),
      }),
  },
}
