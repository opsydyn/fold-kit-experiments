import type { AppConfig, FoldkitApp } from './types'

export type { AppConfig, FoldkitApp }

export function defineApp(load: () => Promise<AppConfig>): FoldkitApp {
  return Object.assign(() => {}, { __foldkit: true as const, load })
}
