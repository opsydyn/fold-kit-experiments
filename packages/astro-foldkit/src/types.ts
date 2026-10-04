import type { Schema } from 'effect';
import type { Runtime } from 'foldkit';
import type { Document } from 'foldkit/html';
import type { Ports } from 'foldkit/port';

import type { NavigationConfig, NavigationEvent } from './navigation';

type TaggedMessage = { readonly _tag: string };
export interface EmptyProps {
  readonly noMeta?: boolean | '';
}

export type AppReturn<Model = unknown> = Readonly<{
  readonly model: Model;
  readonly commands?: ReadonlyArray<unknown>;
}>;

export type AppConfigContract<Props extends object = EmptyProps> = {
  readonly Model: unknown;
  readonly init: (props: Props) => AppReturn;
  readonly update: (model: never, message: never) => AppReturn;
  readonly view: (model: never, h: never) => Document;
  readonly navigation?: NavigationConfig<NavigationEvent>;
  readonly ports?: Ports;
};

export type AppConfig<
  Props extends object = EmptyProps,
  Model = unknown,
  Message extends TaggedMessage = TaggedMessage,
> = {
  readonly Model: unknown;
  readonly init: (props: Props) => AppReturn<Model>;
  readonly update: Runtime.ApplicationConfig<Model, Message>['update'];
  readonly view: Runtime.ApplicationConfig<Model, Message>['view'];
};

export type FoldkitApp<
  Props extends object = EmptyProps,
  Config extends AppConfigContract<Props> = AppConfigContract<Props>,
> = {
  (props?: Props): void;
  readonly __foldkit: true;
  readonly load: () => Promise<Config>;
};

export type PageParams = Readonly<Record<string, string | undefined>>;

export type PageFlagsContext<Props extends object = EmptyProps> = {
  readonly request: Request;
  readonly url: URL;
  readonly params: PageParams;
  readonly props: Props;
};

export type PageContext<Props extends object = EmptyProps> = PageFlagsContext<Props>;

export type PageFlagsSchema<Flags extends object> = Schema.Codec<Flags, any, never, never>;

export type PageConfig<
  Flags extends object = EmptyProps,
  Model = unknown,
  Message extends TaggedMessage = TaggedMessage,
> = AppConfig<Flags, Model, Message> & {
  readonly Flags: PageFlagsSchema<Flags>;
};

export type PageConfigContract<Flags extends object = EmptyProps> = AppConfigContract<Flags> & {
  readonly Flags: PageFlagsSchema<Flags>;
};

export type DefinePageOptions<
  Props extends object = EmptyProps,
  Flags extends object = EmptyProps,
> = {
  readonly flags: (context: PageFlagsContext<Props>) => Flags;
};

export type FoldkitPage<
  Props extends object = EmptyProps,
  Flags extends object = EmptyProps,
  Config extends PageConfigContract<Flags> = PageConfigContract<Flags>,
> = {
  (props?: Props): void;
  readonly __foldkitPage: true;
  readonly load: () => Promise<Config>;
  readonly flags: (context: PageFlagsContext<Props>) => Flags;
};
