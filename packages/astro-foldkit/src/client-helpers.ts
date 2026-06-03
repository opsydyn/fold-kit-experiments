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
  <Model>(
    view: (model: Model) => { readonly title: string; readonly [key: string]: unknown },
    initialTitle: string,
  ) =>
  (model: Model): { readonly title: string; readonly [key: string]: unknown } => ({
    ...view(model),
    title: initialTitle,
  });
