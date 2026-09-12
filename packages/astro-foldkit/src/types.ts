import type { Schema } from 'effect';
import type { Runtime } from 'foldkit';
import type { Document } from 'foldkit/html';

import type { NavigationConfig } from './navigation';

type TaggedMessage = { readonly _tag: string };

export type AppReturn<Model = unknown> = Readonly<{
  readonly model: Model;
  readonly commands?: ReadonlyArray<unknown>;
}>;

export type AppConfigShape<Props extends Record<string, unknown>> = {
  readonly Model: unknown;
  readonly init: (props: Props) => AppReturn;
  readonly update: (model: never, message: never) => AppReturn;
  readonly view: (model: never, h: never) => Document;
  readonly navigation?: NavigationConfig<unknown>;
  readonly ports?: Record<string, unknown>;
};

export type AppConfig<
  Props extends Record<string, unknown> = Record<string, unknown>,
  Model = unknown,
  Message extends TaggedMessage = TaggedMessage,
> = {
  readonly Model: unknown;
  readonly init: (props: Props) => AppReturn<Model>;
  readonly update: Runtime.ApplicationConfig<Model, Message>['update'];
  readonly view: Runtime.ApplicationConfig<Model, Message>['view'];
};

export type FoldkitApp<
  Props extends Record<string, unknown> = Record<string, unknown>,
  Config extends AppConfigShape<Props> = AppConfigShape<Props>,
> = {
  (props?: Props): void;
  readonly __foldkit: true;
  readonly load: () => Promise<Config>;
};

export type PageParams = Readonly<Record<string, string | undefined>>;

export type PageFlagsContext<Props extends Record<string, unknown> = Record<string, unknown>> = {
  readonly request: Request;
  readonly url: URL;
  readonly params: PageParams;
  readonly props: Props;
};

export type PageContext<Props extends Record<string, unknown> = Record<string, unknown>> =
  PageFlagsContext<Props>;

export type PageFlagsSchema<Flags extends Record<string, unknown>> = Schema.Codec<
  Flags,
  any,
  never,
  never
>;

export type PageConfig<
  Flags extends Record<string, unknown> = Record<string, unknown>,
  Model = unknown,
  Message extends TaggedMessage = TaggedMessage,
> = AppConfig<Flags, Model, Message> & {
  readonly Flags: PageFlagsSchema<Flags>;
};

export type PageConfigShape<Flags extends Record<string, unknown>> = AppConfigShape<Flags> & {
  readonly Flags: PageFlagsSchema<Flags>;
};

export type DefinePageOptions<
  Props extends Record<string, unknown> = Record<string, unknown>,
  Flags extends Record<string, unknown> = Record<string, unknown>,
> = {
  readonly flags: (context: PageFlagsContext<Props>) => Flags;
};

export type FoldkitPage<
  Props extends Record<string, unknown> = Record<string, unknown>,
  Flags extends Record<string, unknown> = Record<string, unknown>,
  Config extends PageConfigShape<Flags> = PageConfigShape<Flags>,
> = {
  (props?: Props): void;
  readonly __foldkitPage: true;
  readonly load: () => Promise<Config>;
  readonly flags: (context: PageFlagsContext<Props>) => Flags;
};
