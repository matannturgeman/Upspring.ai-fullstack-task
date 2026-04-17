const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') ?? ''
export const API_BASE_URL = base ? `${base}/api` : '/api'

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${normalizedPath}`
}
