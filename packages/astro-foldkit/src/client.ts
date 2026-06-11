import { Runtime } from 'foldkit';

import { makeNoMetaView, shouldSkipMetadata } from './client-helpers';
import type { FoldkitApp } from './types';

export default (element: HTMLElement) =>
  async (
    component: FoldkitApp,
    props: Record<string, unknown>,
    _slots: Record<string, unknown>,
    _meta: { client: string },
  ): Promise<void> => {
    const config = await component.load();

    element.id ||= element.getAttribute('uid') ?? crypto.randomUUID();

    const baseView = (config as any).view;
    const view = shouldSkipMetadata(props) ? makeNoMetaView(baseView, document.title) : baseView;

    const program = Runtime.makeApplication({
      ...(config as any),
      // Forward Astro props into init so apps can seed their model from server data.
      // Apps that declare no props simply receive an empty object and ignore it.
      init: () => (config as any).init(props),
      view,
      container: element,
    });

    const handle = Runtime.embed(program);

    element.addEventListener('astro:unmount', () => handle.dispose(), { once: true });
  };
