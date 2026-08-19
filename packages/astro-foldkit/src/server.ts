import type { NamedSSRLoadedRendererValue } from 'astro';

import { readFoldkitBuildId } from './build-id';
import { renderFoldkitServerApplication } from './server-render';
import type { FoldkitApp, FoldkitPage, PageFlagsContext, PageParams } from './types';

type AstroRendererResult = Readonly<{
  createAstro: (props: Record<string, unknown>, slots: Record<string, string>) => unknown;
  params: PageParams;
  request: Request;
}>;
type RendererThis = Readonly<{
  result?: AstroRendererResult;
}>;

type AstroLike<Props extends Record<string, unknown>> = Readonly<{
  request?: Request;
  url?: URL;
  params?: PageParams;
  props?: Props;
}>;

const claimedPageResults = new WeakSet<object>();

const isObjectOrFunction = (value: unknown): value is object =>
  value != null && (typeof value === 'object' || typeof value === 'function');

const isFoldkitApp = (value: unknown): value is FoldkitApp =>
  isObjectOrFunction(value) &&
  '__foldkit' in value &&
  (value as { readonly __foldkit: unknown }).__foldkit === true;

const isFoldkitPage = (value: unknown): value is FoldkitPage =>
  isObjectOrFunction(value) &&
  '__foldkitPage' in value &&
  (value as { readonly __foldkitPage: unknown }).__foldkitPage === true;

const claimPageResult = (result: object): void => {
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

const pageContext = <Props extends Record<string, unknown>>(
  result: NonNullable<RendererThis['result']>,
  props: Props,
  slots: Record<string, string>,
): PageFlagsContext<Props> => {
  const astro = result.createAstro(props, slots) as AstroLike<Props>;
  const request = astro.request ?? result.request;
  return {
    request,
    url: astro.url ?? new URL(request.url),
    params: astro.params ?? result.params,
    props: astro.props ?? props,
  };
};

const renderPage = async <Props extends Record<string, unknown>>(
  result: RendererThis['result'],
  component: FoldkitPage<Props>,
  props: Props,
  slots: Record<string, string>,
): Promise<{ html: string }> => {
  const currentResult = requireResult(result);
  claimPageResult(currentResult);
  const context = pageContext(currentResult, props, slots);
  const flags = component.flags(context);
  const config = await component.load();
  const rendered = await renderFoldkitServerApplication(config, flags, readFoldkitBuildId());
  return { html: rendered.html };
};

export async function check(Component: unknown): Promise<boolean> {
  return isFoldkitApp(Component) || isFoldkitPage(Component);
}

export async function renderToStaticMarkup(
  this: RendererThis | void,
  component: unknown,
  props: Record<string, unknown>,
  slots: Record<string, string>,
): Promise<{ html: string }> {
  if (isFoldkitPage(component)) return renderPage(this?.result, component, props, slots);
  return { html: '<div data-foldkit-island="true"></div>' };
}

const renderer: NamedSSRLoadedRendererValue = {
  name: 'astro-foldkit',
  check,
  renderToStaticMarkup,
  supportsAstroStaticSlot: true,
};

export default renderer;
