import { Runtime } from 'foldkit';

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

    const program = Runtime.makeProgram({
      ...(config as any),
      // Forward Astro props into init so apps can seed their model from server data.
      // Apps that declare no props simply receive an empty object and ignore it.
      init: () => (config as any).init(props),
      container: element,
    });

    Runtime.run(program);

    element.addEventListener('astro:unmount', () => {}, { once: true });
  };
