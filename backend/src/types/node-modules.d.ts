declare module 'process' {
  const process: {
    env: Record<string, string | undefined>
    exit(code?: number): never
  }

  export default process
}

declare module 'buffer' {
  export const Buffer: {
    from(input: Uint8Array | string): {
      toString(): string
    }
  }
}
