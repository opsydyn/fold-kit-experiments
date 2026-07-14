import { Runtime } from 'foldkit';

import { makeNoMetaView, shouldSkipMetadata } from './client-helpers';
import type { AppConfig, FoldkitApp } from './types';

type EmbedHandle = { readonly dispose: () => void };

export type ClientRuntime = {
  readonly makeApplication: (config: unknown) => unknown;
  readonly embed: (program: unknown) => EmbedHandle;
};

const defaultRuntime: ClientRuntime = {
  makeApplication: (config) => Runtime.makeApplication(config as never),
  embed: (program) => Runtime.embed(program as never),
};

export function createClientRenderer(runtime: ClientRuntime = defaultRuntime) {
  return (element: HTMLElement) =>
    async <Props extends Record<string, unknown>, Model, Message extends { readonly _tag: string }>(
      component: FoldkitApp<Props, Model, Message>,
      props: Props,
      _slots: Record<string, unknown>,
      _meta: { client: string },
    ): Promise<void> => {
      const config = await component.load();

      element.id ||= element.getAttribute('uid') ?? crypto.randomUUID();

      const baseView = config.view;
      const view = shouldSkipMetadata(props) ? makeNoMetaView(baseView, document.title) : baseView;

      const program = runtime.makeApplication({
        ...(config as AppConfig<Props, Model, Message>),
        // Forward Astro props into init so apps can seed their model from server data.
        // Apps that declare no props simply receive an empty object and ignore it.
        init: () => config.init(props),
        view,
        container: element,
        preserveScroll: true,
      });

      const handle = runtime.embed(program);
      let disposed = false;

      element.addEventListener(
        'astro:unmount',
        () => {
          if (disposed) return;
          disposed = true;
          handle.dispose();
        },
        { once: true },
      );
    };
}

export default createClientRenderer();
