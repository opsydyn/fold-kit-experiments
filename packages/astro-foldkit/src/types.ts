import type { Runtime } from 'foldkit';
import type { Document } from 'foldkit/html';

type TaggedMessage = { readonly _tag: string };
type CommandBatch = ReadonlyArray<unknown>;

export type AppConfigShape<Props extends Record<string, unknown>> = {
  readonly Model: unknown;
  readonly init: (props: Props) => readonly [unknown, CommandBatch];
  readonly update: (model: never, message: never) => readonly [unknown, CommandBatch];
  readonly view: (model: never) => Document;
};

export type AppConfig<
  Props extends Record<string, unknown> = Record<string, unknown>,
  Model = unknown,
  Message extends TaggedMessage = TaggedMessage,
> = {
  readonly Model: unknown;
  readonly init: (props: Props) => readonly [Model, CommandBatch];
  readonly update: Runtime.ApplicationConfig<Model, Message>['update'];
  readonly view: (model: Model) => Document;
};

export type FoldkitApp<
  Props extends Record<string, unknown> = Record<string, unknown>,
  Config extends AppConfigShape<Props> = AppConfigShape<Props>,
> = {
  (props?: Props): void;
  readonly __foldkit: true;
  readonly load: () => Promise<Config>;
};
