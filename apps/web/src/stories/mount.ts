import type { EmbedHandle, MakeRuntimeReturn } from 'foldkit/runtime';
import { embed, makeApplication } from 'foldkit/runtime';

export type FoldkitAppConfig = {
  Model: any;
  init: (...args: any[]) => readonly [any, ReadonlyArray<any>];
  update: (model: any, msg: any) => readonly [any, ReadonlyArray<any>];
  view: (model: any) => any;
};

type RuntimeHandle = Pick<EmbedHandle, 'dispose'>;
type FoldkitProgram = MakeRuntimeReturn<any>;

export function mountFoldkitProgram(
  createProgram: (container: HTMLElement) => FoldkitProgram,
  hostStyle = 'display:block;width:100%;',
): HTMLElement {
  const host = document.createElement('div');
  host.style.cssText = hostStyle;

  const container = document.createElement('div');
  container.id = crypto.randomUUID();
  container.style.cssText = 'display:block;width:100%;';
  host.appendChild(container);

  let handle: RuntimeHandle | undefined;
  let timeout: number | undefined;
  let observer: MutationObserver | undefined;
  let attempts = 0;

  const dispose = () => {
    if (timeout !== undefined) {
      window.clearTimeout(timeout);
      timeout = undefined;
    }
    observer?.disconnect();
    observer = undefined;
    handle?.dispose();
    handle = undefined;
  };

  const start = () => {
    if (handle || !host.isConnected) {
      if (attempts++ < 120) {
        timeout = window.setTimeout(start, 0);
      }
      return;
    }

    handle = embed(createProgram(container));
    observer = new MutationObserver(() => {
      if (!host.isConnected) {
        dispose();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  };

  timeout = window.setTimeout(start, 0);

  return host;
}

export function mountFoldkit(
  config: FoldkitAppConfig,
  initProps: Record<string, unknown> = {},
): HTMLElement {
  return mountFoldkitProgram((container) =>
    makeApplication({
      ...config,
      init: () => config.init(initProps),
      container,
      crash: {
        report: ({ error }: { error: Error }) => {
          console.error('[foldkit-viz] Chart crashed:', error);
        },
      },
    }),
  );
}
