import { Component } from '@effect/ui';
import { HtmlServer } from '@effect/ui/html';
import type { AstroComponentMetadata, NamedSSRLoadedRendererValue } from 'astro';
import { Effect } from 'effect';

import { asIslandComponent, IslandRendererError, type IslandProps } from './component';

type RenderContext = Readonly<{
  result?: Readonly<{
    createAstro: (props: IslandProps, slots: null) => Readonly<{ isPrerendered: boolean }>;
  }>;
}>;

export default {
  name: 'astro-effect-ui',
  check: async (component) => Component.isComponent(component),
  async renderToStaticMarkup(
    this: RenderContext | void,
    component: Component.Any,
    props: IslandProps,
    slots: Record<string, string>,
    metadata?: AstroComponentMetadata,
  ) {
    if (Object.keys(slots).length > 0)
      throw new IslandRendererError({ message: 'Astro Effect UI slots are unsupported.' });
    const isPrerendered = this?.result?.createAstro({}, null).isPrerendered ?? false;
    const rendered = await Effect.runPromise(
      HtmlServer.renderToHtml(asIslandComponent(component), props, { static: isPrerendered }),
    );
    if (!metadata?.hydrate) return { html: rendered.html };
    const state = HtmlServer.serializeState(rendered.state);
    return {
      html: `<div data-effect-ui-root>${rendered.html}</div><script type="application/json" data-effect-ui-state>${state}</script>`,
    };
  },
} satisfies NamedSSRLoadedRendererValue;
