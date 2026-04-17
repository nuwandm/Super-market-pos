import type { Api } from '../../../preload'

// Proxy wrapper — renderer uses this, never window.api directly
export const api = (window as unknown as { api: Api }).api
