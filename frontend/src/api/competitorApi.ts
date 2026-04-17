import axios from 'axios'
import { API_BASE_URL } from '../config/api.ts'

const api = axios.create({ baseURL: API_BASE_URL })

export interface CompetitorsResponse {
  competitors: { name: string; reason: string }[]
  source: string
  disclaimer: string
}

export async function findCompetitors(
  brandName: string,
  brandId: string,
): Promise<CompetitorsResponse> {
  const { data } = await api.post<CompetitorsResponse>('/competitors/find', { brandName, brandId })
  return data
}
