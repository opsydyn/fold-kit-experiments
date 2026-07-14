import type { Runtime } from 'foldkit';

type TaggedMessage = { readonly _tag: string };

export type AppConfig<
  Props extends Record<string, unknown> = Record<string, unknown>,
  Model = unknown,
  Message extends TaggedMessage = TaggedMessage,
> = Omit<Runtime.ApplicationConfig<Model, Message>, 'init' | 'container'> & {
  readonly init: (props: Props) => ReturnType<Runtime.ApplicationInit<Model, Message>>;
};

export type FoldkitApp<
  Props extends Record<string, unknown> = Record<string, unknown>,
  Model = unknown,
  Message extends TaggedMessage = TaggedMessage,
> = {
  (props?: Props): void;
  readonly __foldkit: true;
  readonly load: () => Promise<AppConfig<Props, Model, Message>>;
};
