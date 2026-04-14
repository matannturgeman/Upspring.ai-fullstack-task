import axios from 'axios'
import type { AdsResponse } from '../types/ad.types.ts'

const api = axios.create({ baseURL: '/api' })

api.interceptors.response.use(
  res => res,
  err => {
    const message = err.response?.data?.message || err.message || 'Unexpected error'
    const code = err.response?.data?.code || 'UNKNOWN'
    return Promise.reject({ message, code, status: err.response?.status })
  }
)

export async function fetchAds(
  brand: string,
  { limit = 20, forceRefresh = false }: { limit?: number; forceRefresh?: boolean } = {}
): Promise<AdsResponse> {
  const { data } = await api.get<AdsResponse>('/ads', {
    params: { brand, limit, forceRefresh },
  })
  return data
}
