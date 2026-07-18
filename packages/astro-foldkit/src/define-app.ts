import type { AppConfigShape, FoldkitApp } from './types';

export type { AppConfig, FoldkitApp } from './types';

export function defineApp<
  Props extends Record<string, unknown> = Record<string, unknown>,
  Config extends AppConfigShape<Props> = AppConfigShape<Props>,
>(load: () => Promise<Config>): FoldkitApp<Props, Config> {
  return Object.assign((_props?: Props) => {}, { __foldkit: true as const, load });
}

/** Preferred name for Astro's intentional lazy island entry boundary. */
export const lazyApp = defineApp;
