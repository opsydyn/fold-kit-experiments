import type { NamedSSRLoadedRendererValue } from 'astro';

import { readFoldkitBuildId } from './build-id';
import { renderFoldkitIslandMarkup, renderFoldkitServerApplication } from './server-render';
import type { FoldkitApp, FoldkitPage, PageFlagsContext, PageParams } from './types';

export interface AstroComponentInput {}
export interface AstroProps {}
export interface AstroSlots {}
interface ClaimedRendererResult {}

type AstroRendererResult = Readonly<{
  createAstro: (props: AstroProps, slots: AstroSlots) => AstroLike<AstroProps>;
  params: PageParams;
  request: Request;
}>;
type RendererThis = Readonly<{
  result?: AstroRendererResult;
}>;

type AstroLike<Props extends AstroProps> = Readonly<{
  request?: Request;
  url?: URL;
  params?: PageParams;
  props?: Props;
}>;

const claimedPageResults = new WeakSet<ClaimedRendererResult>();

const isObjectOrFunction = (value: unknown): value is object =>
  value != null && (typeof value === 'object' || typeof value === 'function');

const isFoldkitApp = (value: unknown): value is FoldkitApp =>
  isObjectOrFunction(value) &&
  '__foldkit' in value &&
  // SAFETY: The surrounding package boundary establishes this value before the assertion.
  (value as { readonly __foldkit: boolean }).__foldkit === true;

const isFoldkitPage = (value: unknown): value is FoldkitPage<AstroProps, AstroProps> =>
  isObjectOrFunction(value) &&
  '__foldkitPage' in value &&
  // SAFETY: The surrounding package boundary establishes this value before the assertion.
  (value as { readonly __foldkitPage: boolean }).__foldkitPage === true;

const claimPageResult = (result: ClaimedRendererResult): void => {
  if (claimedPageResults.has(result))
    throw new Error(
      'Astro FoldKit server rendering supports exactly one FoldKit page owner per result.',
    );
  claimedPageResults.add(result);
};

const requireResult = (result: RendererThis['result']): NonNullable<RendererThis['result']> => {
  if (result === undefined)
    throw new Error('Astro FoldKit server rendering requires the Astro renderer result.');
  return result;
};

const pageContext = <Props extends AstroProps>(
  result: NonNullable<RendererThis['result']>,
  props: Props,
  slots: AstroSlots,
): PageFlagsContext<Props> => {
  // SAFETY: The surrounding package boundary establishes this value before the assertion.
  const astro = result.createAstro(props, slots) as AstroLike<Props>;
  const request = astro.request ?? result.request;
  return {
    request,
    url: astro.url ?? new URL(request.url),
    params: astro.params ?? result.params,
    props: astro.props ?? props,
  };
};

const renderPage = async <Props extends AstroProps>(
  result: RendererThis['result'],
  component: FoldkitPage<Props>,
  props: Props,
  slots: AstroSlots,
): Promise<{ html: string }> => {
  const currentResult = requireResult(result);
  claimPageResult(currentResult);
  const context = pageContext(currentResult, props, slots);
  const flags = component.flags(context);
  const config = await component.load();
  const rendered = await renderFoldkitServerApplication(config, flags, readFoldkitBuildId());
  return { html: rendered.html };
};

/** The mount the client's `findIslandMount` resolves, empty or filled. */
const islandMount = (markup: string): string => `<div data-foldkit-island="true">${markup}</div>`;

const isPrerenderedApp = (value: unknown): value is FoldkitApp<AstroProps> =>
  // SAFETY: The surrounding package boundary establishes this value before the assertion.
  isFoldkitApp(value) && (value as FoldkitApp<AstroProps>).prerender === true;

/**
 * Renders an opted-in island inside the mount the client already resolves.
 *
 * The markup goes inside the mount rather than beside it, because
 * `findIslandMount` resolves that element as the runtime's container and the
 * runtime replaces its contents on boot. Server and client run the same pure
 * `init` and `view` over the same props, so the replacement is the same markup
 * and the swap is invisible.
 */
const renderIsland = async <Props extends AstroProps>(
  component: FoldkitApp<Props>,
  props: Props,
): Promise<{ html: string }> => {
  const config = await component.load();
  const rendered = await renderFoldkitIslandMarkup(config, props);
  return { html: islandMount(rendered.html) };
};

/**
 * What Astro passes a renderer about the component it is rendering: its name,
 * and the client directive it carries, if any. A `client:only` component never
 * reaches the renderer, so it never appears here.
 */
export type AstroRenderMetadata = Readonly<{
  displayName?: string;
  hydrate?: string;
}>;

const warnedIslands = new Set<string>();

const warnOnce = (key: string, message: string): void => {
  if (warnedIslands.has(key)) return;
  warnedIslands.add(key);
  console.warn(message);
};

/**
 * Names the two ways an island that is not pre-rendered fails without an
 * error, both of which leave it as the empty mount shell forever.
 *
 * With no client directive, nothing ever replaces the shell, so the island
 * renders nothing and ships nothing. With `client:visible`, Astro observes the
 * island's children because `astro-island` is `display: contents`; the empty
 * mount measures 0x0, a zero-area target never intersects, and the island never
 * hydrates. Other directives fire whatever the island's size.
 *
 * Both warn rather than fail: the shell is still valid output, and a warning
 * should never be what breaks a build.
 */
const diagnoseShellIsland = (metadata: AstroRenderMetadata | undefined): void => {
  const name = metadata?.displayName ?? 'A FoldKit island';
  if (metadata?.hydrate === undefined)
    warnOnce(
      `${name}:no-directive`,
      `[astro-foldkit] ${name} has no client directive and is not pre-rendered, so it renders an empty mount and ships no JavaScript: it will never display anything. Pass { prerender: true } to lazyApp to render it as static HTML, or add a client directive.`,
    );
  else if (metadata.hydrate === 'visible')
    warnOnce(
      `${name}:visible`,
      `[astro-foldkit] ${name} uses client:visible but is not pre-rendered. Astro observes an island's children, and an empty FoldKit mount measures 0x0, so it never intersects and the island never hydrates. Pass { prerender: true } to lazyApp, or use client:load or client:idle.`,
    );
};

export async function check<Component>(component: Component): Promise<boolean> {
  return isFoldkitApp(component) || isFoldkitPage(component);
}

export async function renderToStaticMarkup(
  this: RendererThis | void,
  component: AstroComponentInput,
  props: AstroProps,
  slots: AstroSlots,
  metadata?: AstroRenderMetadata,
): Promise<{ html: string }> {
  if (isFoldkitPage(component)) return renderPage(this?.result, component, props, slots);
  if (isPrerenderedApp(component)) return renderIsland(component, props);
  diagnoseShellIsland(metadata);
  return { html: islandMount('') };
}

const renderer: NamedSSRLoadedRendererValue = {
  name: 'astro-foldkit',
  check,
  renderToStaticMarkup,
  supportsAstroStaticSlot: true,
};

export default renderer;
