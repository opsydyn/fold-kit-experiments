import type { AppConfig, FoldkitApp } from './types';

export type { AppConfig, FoldkitApp };

export function defineApp<
  Props extends Record<string, unknown> = Record<string, unknown>,
  Model = unknown,
  Message extends { readonly _tag: string } = { readonly _tag: string },
>(load: () => Promise<AppConfig<Props, Model, Message>>): FoldkitApp<Props, Model, Message> {
  return Object.assign((_props?: Props) => {}, { __foldkit: true as const, load });
}
