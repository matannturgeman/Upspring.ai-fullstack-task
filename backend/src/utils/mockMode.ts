export function isMockMode(): boolean {
  return process.env.MOCK_LLM === 'true'
}
