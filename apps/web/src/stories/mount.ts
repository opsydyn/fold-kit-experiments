import { makeProgram, run } from 'foldkit/runtime';

export type FoldkitAppConfig = {
  Model: any;
  init: (...args: any[]) => readonly [any, ReadonlyArray<any>];
  update: (model: any, msg: any) => readonly [any, ReadonlyArray<any>];
  view: (model: any) => any;
};

/**
 * Mount a foldkit TEA app into a fresh div for use in Storybook stories.
 * Returns the container so Storybook can render it into its canvas.
 */
export function mountFoldkit(
  config: FoldkitAppConfig,
  initProps: Record<string, unknown> = {},
): HTMLElement {
  const container = document.createElement('div');
  container.id = crypto.randomUUID();
  container.style.cssText = 'display:inline-block;';

  const program = makeProgram({
    ...config,
    init: () => config.init(initProps),
    container,
  });

  run(program);
  return container;
}
