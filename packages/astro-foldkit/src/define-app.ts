import type { AppConfigContract, DefineAppOptions, EmptyProps, FoldkitApp } from './types';

export type { AppConfig, DefineAppOptions, FoldkitApp } from './types';

export function defineApp<
  Props extends object = EmptyProps,
  Config extends AppConfigContract<Props> = AppConfigContract<Props>,
>(load: () => Promise<Config>, options?: DefineAppOptions): FoldkitApp<Props, Config> {
  return Object.assign((_props?: Props) => {}, {
    __foldkit: true as const,
    load,
    prerender: options?.prerender === true,
  });
}

/** Preferred name for Astro's intentional lazy island entry boundary. */
export const lazyApp = defineApp;
