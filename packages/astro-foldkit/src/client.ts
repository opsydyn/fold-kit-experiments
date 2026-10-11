import { Runtime } from 'foldkit';

import { readFoldkitBuildId } from './build-id';
import { findSingleFoldkitRoot, shouldSkipMetadata, withNoMetaView } from './client-helpers';
import { normalizeNavigationEvent } from './navigation';
import type { NavigationConfig, NavigationEvent, NavigationPhase } from './navigation';
import type { AppConfigContract, FoldkitApp } from './types';

interface RuntimeConfigInput {}
interface RuntimeProgram {}
interface RuntimeHydrationOptions {
  readonly buildId?: string;
}
interface ClientSlots {}

type ConfigModel<Props extends object, Config extends AppConfigContract<Props>> = ReturnType<
  Config['init']
>['model'];

type ConfigMessage<Props extends object, Config extends AppConfigContract<Props>> = Parameters<
  Config['update']
>[1];

type RuntimeConfigOf<
  Props extends object,
  Config extends AppConfigContract<Props>,
> = Runtime.ApplicationConfig<ConfigModel<Props, Config>, ConfigMessage<Props, Config>>;

type EventTargetLike = {
  readonly addEventListener: (type: string, listener: EventListener) => void;
  readonly removeEventListener: (type: string, listener: EventListener) => void;
};

type IslandLike = EventTargetLike & {
  readonly id: string;
  readonly getAttribute: (name: string) => string | null;
  readonly querySelectorAll: (selector: string) => ArrayLike<unknown>;
};

type NavigationDocument = EventTargetLike & {
  readonly title: string;
  readonly querySelector: (selector: string) => object | null;
};

type RuntimePortHandle<Value> = { readonly send: (value: Value) => void };
type EmbedHandle = {
  readonly ports?: Readonly<Record<string, RuntimePortHandle<NavigationEvent>>>;
  readonly dispose: () => void;
};

type ClientEnvironment = {
  readonly document: NavigationDocument;
  readonly window: { readonly location: { readonly href: string } };
};

type BeforeSwapEvent = Event & {
  readonly newDocument?: NavigationDocument;
  readonly detail?: {
    readonly newDocument?: NavigationDocument;
    readonly to?: { readonly href?: string };
  };
};

export type ClientRuntime = {
  readonly makeApplication: (config: RuntimeConfigInput) => RuntimeProgram;
  readonly embed: (program: RuntimeProgram) => EmbedHandle;
  readonly hydrate?: (program: RuntimeProgram, options: RuntimeHydrationOptions) => void;
};

interface ClientPage {
  (props?: never): void;
  readonly __foldkitPage: true;
  readonly load: () => Promise<RuntimeConfigInput>;
}

type ClientComponent<Props extends object, Config extends AppConfigContract<Props>> =
  | FoldkitApp<Props, Config>
  | ClientPage;

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

const seenIslandIdentities = new Set<string>();

const islandIdentity = (element: IslandLike): string => element.getAttribute('uid') ?? element.id;

const newDocumentFrom = (event: Event): NavigationDocument | undefined => {
  // SAFETY: The surrounding package boundary establishes this value before the assertion.
  const beforeSwap = event as BeforeSwapEvent;
  return beforeSwap.newDocument ?? beforeSwap.detail?.newDocument;
};

const destinationHrefFrom = (event: Event, fallback: string): string => {
  // SAFETY: The surrounding package boundary establishes this value before the assertion.
  const beforeSwap = event as BeforeSwapEvent;
  return beforeSwap.detail?.to?.href ?? fallback;
};

const containsIsland = (document: NavigationDocument | undefined, identity: string): boolean => {
  if (document === undefined) return false;
  return document.querySelector(`astro-island[uid="${identity}"]`) !== null;
};

const attachNavigationBridge = (
  element: IslandLike,
  navigation: NavigationConfig<NavigationEvent>,
  send: (value: NavigationEvent) => void,
  environment: ClientEnvironment,
): (() => void) => {
  let active = true;
  let previousUrl: string | null = null;
  let initialPageLoad = true;
  let retainedThroughSwap = false;
  const identity = islandIdentity(element);
  const initialPhase = seenIslandIdentities.has(identity) ? 'entered' : 'coldLoad';
  seenIslandIdentities.add(identity);
  const forward = (phase: NavigationPhase, href = environment.window.location.href) => {
    if (!active) return;
    const event = normalizeNavigationEvent(phase, href, previousUrl);
    previousUrl = href;
    send(navigation.map(event));
  };

  forward(initialPhase);
  const removePageLoad = () =>
    environment.document.removeEventListener('astro:page-load', onPageLoad);
  const removeBeforeSwap = () =>
    environment.document.removeEventListener('astro:before-swap', onBeforeSwap);
  const onPageLoad: EventListener = () => {
    if (initialPageLoad) {
      initialPageLoad = false;
      return;
    }
    if (retainedThroughSwap) {
      retainedThroughSwap = false;
      return;
    }
    forward('entered');
  };
  const onBeforeSwap: EventListener = (event) => {
    retainedThroughSwap = containsIsland(newDocumentFrom(event), identity);
    if (retainedThroughSwap)
      forward('stayed', destinationHrefFrom(event, environment.window.location.href));
  };
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
  // SAFETY: The surrounding package boundary establishes this value before the assertion.
  makeApplication: (config) => Runtime.makeApplication(config as never),
  // SAFETY: The surrounding package boundary establishes this value before the assertion.
  embed: (program) => Runtime.embed(program as never) as EmbedHandle,
  // SAFETY: The surrounding package boundary establishes this value before the assertion.
  hydrate: (program, options) => Runtime.hydrate(program as never, options),
};

const isPageOwner = (component: unknown): component is ClientPage =>
  typeof component === 'function' &&
  '__foldkitPage' in component &&
  component.__foldkitPage === true;

const findIslandMount = (element: HTMLElement): HTMLElement => {
  const mounts = Array.from(
    element.querySelectorAll<HTMLElement>('[data-foldkit-island="true"]'),
  ).filter((mount) => mount.closest('astro-island') === element);
  if (mounts.length > 1)
    throw new Error(
      `Expected at most one owned FoldKit island mount inside the Astro island, found ${mounts.length}.`,
    );
  if (mounts[0]) return mounts[0];

  const mount = element.ownerDocument.createElement('div');
  mount.setAttribute('data-foldkit-island', 'true');
  element.appendChild(mount);
  return mount;
};

export function createClientRenderer(
  runtime: ClientRuntime = defaultRuntime,
  environment: Partial<ClientEnvironment> = {},
) {
  const islandRenders = new WeakMap<HTMLElement, Promise<void>>();
  return (element: HTMLElement) =>
    async <Props extends object, Config extends AppConfigContract<Props>>(
      component: ClientComponent<Props, Config>,
      props: Props,
      _slots: ClientSlots,
      _meta: { client: string },
    ): Promise<void> => {
      // SAFETY: The surrounding package boundary establishes this value before the assertion.
      const clientEnvironment = {
        document: environment.document ?? globalThis.document,
        window: environment.window ?? globalThis.window,
      } as ClientEnvironment;

      element.id ||= element.getAttribute('uid') ?? crypto.randomUUID();

      if (isPageOwner(component)) {
        const config = await component.load();
        const root = findSingleFoldkitRoot(element);
        const application = runtime.makeApplication({ ...config, container: root });
        if (runtime.hydrate === undefined)
          throw new Error('FoldKit Runtime.hydrate is not available for page hydration.');
        runtime.hydrate(application, { buildId: readFoldkitBuildId() });
        return;
      }

      const existingRender = islandRenders.get(element);
      if (existingRender) return existingRender;

      let unmountedWhileLoading = false;
      let disposeAfterFailure = () => {};
      const removePendingUnmount = listenOnce(element, 'astro:unmount', () => {
        unmountedWhileLoading = true;
        islandRenders.delete(element);
      });
      const renderIsland = async () => {
        const config = await component.load();
        if (unmountedWhileLoading) return;
        removePendingUnmount();
        // SAFETY: The surrounding package boundary establishes this value before the assertion.
        const runtimeConfig = config as RuntimeConfigOf<Props, Config>;
        const baseView = runtimeConfig.view;
        const view = shouldSkipMetadata(props)
          ? withNoMetaView(baseView, clientEnvironment.document.title)
          : baseView;
        const mount = findIslandMount(element);
        mount.id ||= `${element.id}--foldkit-mount`;

        const program = runtime.makeApplication({
          ...runtimeConfig,
          // Forward Astro props into init so apps can seed their model from server data.
          // Apps that declare no props simply receive an empty object and ignore it.
          init: () => config.init(props),
          view,
          // FoldKit replaces its container; Astro must retain the outer lifecycle owner.
          container: mount,
          preserveScroll: true,
        });

        const handle = runtime.embed(program);
        let disposed = false;
        let detachNavigation = () => {};
        const dispose = () => {
          if (disposed) return;
          disposed = true;
          islandRenders.delete(element);
          detachNavigation();
          handle.dispose();
        };
        disposeAfterFailure = dispose;

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

        element.addEventListener('astro:unmount', dispose, { once: true });
      };
      // Astro may hydrate the same retained host again, even while its load is pending.
      const rendering: Promise<void> = renderIsland().catch((error) => {
        removePendingUnmount();
        disposeAfterFailure();
        if (islandRenders.get(element) === rendering) islandRenders.delete(element);
        throw error;
      });
      islandRenders.set(element, rendering);
      await rendering;
    };
}

export default createClientRenderer();
