export type AppConfig = {
  readonly Model: unknown;
  readonly init: (...args: ReadonlyArray<unknown>) => readonly [unknown, ReadonlyArray<unknown>];
  readonly update: (model: any, message: any) => readonly [any, ReadonlyArray<any>];
  readonly view: (model: any) => unknown;
};

export type FoldkitApp<Props extends Record<string, unknown> = Record<string, unknown>> = {
  (props?: Props): void;
  readonly __foldkit: true;
  readonly load: () => Promise<AppConfig>;
};
