import type { Document, HtmlBuilder } from 'foldkit/html';

const FOLDKIT_ROOT_SELECTOR = '[data-foldkit-app][data-foldkit-build]';

export type FoldkitRootContainer = {
  readonly querySelectorAll: (selector: string) => ArrayLike<unknown>;
};

export const findSingleFoldkitRoot = (container: FoldkitRootContainer): unknown => {
  const roots = Array.from(container.querySelectorAll(FOLDKIT_ROOT_SELECTOR));
  if (roots.length !== 1)
    throw new Error(
      `Expected exactly one stamped FoldKit root inside the Astro island, found ${roots.length}.`,
    );
  return roots[0];
};

/** Returns true when the `noMeta` prop should suppress document metadata writes. */
export const shouldSkipMetadata = (props: Record<string, unknown>): boolean =>
  props.noMeta === true || props.noMeta === '';

/**
 * Wraps a foldkit view function so the Document it returns always carries
 * `initialTitle` as its title, preventing the runtime from overwriting
 * `document.title` when the app is embedded as an island on a page that
 * owns its own title.
 */
export const makeNoMetaView =
  <Model, Message>(
    view: (model: Model, h: HtmlBuilder<Message>) => Document,
    initialTitle: string,
  ) =>
  (model: Model, h: HtmlBuilder<Message>): Document => ({
    ...view(model, h),
    title: initialTitle,
  });
