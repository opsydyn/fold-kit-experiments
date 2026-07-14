import { Runtime } from 'foldkit';

import { makeNoMetaView, shouldSkipMetadata } from './client-helpers';
import { normalizeNavigationEvent } from './navigation';
import type { NavigationConfig, NavigationPhase } from './navigation';
import type { AppConfigShape, FoldkitApp } from './types';

type EventTargetLike = {
  readonly addEventListener: (type: string, listener: EventListener) => void;
  readonly removeEventListener: (type: string, listener: EventListener) => void;
};

type EmbedHandle = {
  readonly ports?: Record<string, { readonly send: (value: unknown) => unknown }>;
  readonly dispose: () => void;
};

type ClientEnvironment = {
  readonly document: EventTargetLike & { readonly title: string };
  readonly window: { readonly location: { readonly href: string } };
};

export type ClientRuntime = {
  readonly makeApplication: (config: unknown) => unknown;
  readonly embed: (program: unknown) => EmbedHandle;
};

const listenOnce = (
  target: EventTargetLike,
  type: string,
  listener: EventListener,
): (() => void) => {
  let active = true;
  const wrapped: EventListener = (event) => {
    if (!active) return;
    active = false;
    target.removeEventListener(type, wrapped);
    listener(event);
  };
  target.addEventListener(type, wrapped);
  return () => {
    if (!active) return;
    active = false;
    target.removeEventListener(type, wrapped);
  };
};

const attachNavigationBridge = (
  element: EventTargetLike,
  navigation: NavigationConfig<unknown>,
  send: (value: unknown) => void,
  environment: ClientEnvironment,
): (() => void) => {
  let active = true;
  let previousUrl: string | null = null;
  const forward = (phase: NavigationPhase) => {
    if (!active) return;
    const url = environment.window.location.href;
    const event = normalizeNavigationEvent(phase, url, previousUrl);
    previousUrl = url;
    send(navigation.map(event));
  };

  forward('coldLoad');
  const removePageLoad = () =>
    environment.document.removeEventListener('astro:page-load', onPageLoad);
  const removeBeforeSwap = () =>
    environment.document.removeEventListener('astro:before-swap', onBeforeSwap);
  const onPageLoad: EventListener = () => forward('entered');
  const onBeforeSwap: EventListener = () => forward('stayed');
  environment.document.addEventListener('astro:page-load', onPageLoad);
  environment.document.addEventListener('astro:before-swap', onBeforeSwap);
  const removeUnmount = listenOnce(element, 'astro:unmount', () => {
    forward('exited');
    active = false;
    removePageLoad();
    removeBeforeSwap();
  });

  return () => {
    active = false;
    removePageLoad();
    removeBeforeSwap();
    removeUnmount();
  };
};

const defaultRuntime: ClientRuntime = {
  makeApplication: (config) => Runtime.makeApplication(config as never),
  embed: (program) => Runtime.embed(program as never) as EmbedHandle,
};

export function createClientRenderer(
  runtime: ClientRuntime = defaultRuntime,
  environment: Partial<ClientEnvironment> = {},
) {
  return (element: HTMLElement) =>
    async <Props extends Record<string, unknown>, Config extends AppConfigShape<Props>>(
      component: FoldkitApp<Props, Config>,
      props: Props,
      _slots: Record<string, unknown>,
      _meta: { client: string },
    ): Promise<void> => {
      const config = await component.load();
      const clientEnvironment = {
        document: environment.document ?? globalThis.document,
        window: environment.window ?? globalThis.window,
      } as ClientEnvironment;

      element.id ||= element.getAttribute('uid') ?? crypto.randomUUID();

      const baseView = config.view;
      const view = shouldSkipMetadata(props)
        ? makeNoMetaView(baseView, clientEnvironment.document.title)
        : baseView;

      const program = runtime.makeApplication({
        ...config,
        // Forward Astro props into init so apps can seed their model from server data.
        // Apps that declare no props simply receive an empty object and ignore it.
        init: () => config.init(props),
        view,
        container: element,
        preserveScroll: true,
      });

      const handle = runtime.embed(program);
      let disposed = false;
      let detachNavigation = () => {};

      if (config.navigation) {
        const port = handle.ports?.[config.navigation.port];
        if (port) {
          detachNavigation = attachNavigationBridge(
            element,
            config.navigation,
            (value) => port.send(value),
            clientEnvironment,
          );
        } else {
          console.warn(`FoldKit navigation port "${config.navigation.port}" is not available`);
        }
      }

      element.addEventListener(
        'astro:unmount',
        () => {
          if (disposed) return;
          disposed = true;
          detachNavigation();
          handle.dispose();
        },
        { once: true },
      );
    };
}

export default createClientRenderer();
