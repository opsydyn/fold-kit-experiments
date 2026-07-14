import type { AppConfigShape, FoldkitApp } from './types';

export type { AppConfig, FoldkitApp } from './types';

export function defineApp<
  Props extends Record<string, unknown> = Record<string, unknown>,
  Config extends AppConfigShape<Props> = AppConfigShape<Props>,
>(load: () => Promise<Config>): FoldkitApp<Props, Config> {
  return Object.assign((_props?: Props) => {}, { __foldkit: true as const, load });
}
