import type { AppConfig, FoldkitApp } from './types';

export type { AppConfig, FoldkitApp };

export function defineApp<Props extends Record<string, unknown> = Record<string, unknown>>(
  load: () => Promise<AppConfig>,
): FoldkitApp<Props> {
  return Object.assign((_props: Props) => {}, { __foldkit: true as const, load });
}
