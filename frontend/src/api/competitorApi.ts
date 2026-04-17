import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

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
