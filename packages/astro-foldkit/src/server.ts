import type { NamedSSRLoadedRendererValue } from 'astro';

import { readFoldkitBuildId } from './build-id';
import { renderFoldkitServerApplication } from './server-render';
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

export async function check<Component>(component: Component): Promise<boolean> {
  return isFoldkitApp(component) || isFoldkitPage(component);
}

export async function renderToStaticMarkup(
  this: RendererThis | void,
  component: AstroComponentInput,
  props: AstroProps,
  slots: AstroSlots,
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
