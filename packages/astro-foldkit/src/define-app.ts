import type { AppConfigContract, EmptyProps, FoldkitApp } from './types';

export type { AppConfig, FoldkitApp } from './types';

export function defineApp<
  Props extends object = EmptyProps,
  Config extends AppConfigContract<Props> = AppConfigContract<Props>,
>(load: () => Promise<Config>): FoldkitApp<Props, Config> {
  return Object.assign((_props?: Props) => {}, { __foldkit: true as const, load });
}

/** Preferred name for Astro's intentional lazy island entry boundary. */
export const lazyApp = defineApp;
