import { embed, makeApplication } from 'foldkit/runtime';

export type FoldkitAppConfig = {
  Model: any;
  init: (...args: any[]) => readonly [any, ReadonlyArray<any>];
  update: (model: any, msg: any) => readonly [any, ReadonlyArray<any>];
  view: (model: any) => any;
};

export function mountFoldkit(
  config: FoldkitAppConfig,
  initProps: Record<string, unknown> = {},
): HTMLElement {
  const container = document.createElement('div');
  container.id = crypto.randomUUID();
  container.style.cssText = 'display:block;width:100%;';

  const program = makeApplication({
    ...config,
    init: () => config.init(initProps),
    container,
    crash: {
      report: ({ error }: { error: Error }) => {
        console.error('[foldkit-viz] Chart crashed:', error);
      },
    },
  });

  embed(program);
  return container;
}
