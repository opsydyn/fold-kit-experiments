import type { View } from '@effect/ui';
import { Html, HtmlServer } from '@effect/ui/html';
import { Effect, Schema } from 'effect';

import { graphSurface, type GraphSurfaceOptions } from '../src/effect-ui';
import type { EditorState } from '../src/index';

export function renderEffectUi(view: (h: Html.H<string>) => View.Content<string>) {
  const Fixture = Html.component({
    name: 'ZlozTest',
    model: Schema.Null,
    message: Schema.String,
  }).make({
    init: () => null,
    update: () => null,
    view,
  });
  const rendered = Effect.runPromise(HtmlServer.renderToHtml(Fixture, {}, { static: true }));
  return rendered;
}

export function renderCanvas(
  state: EditorState,
  options: Partial<GraphSurfaceOptions<string>> = {},
) {
  return renderEffectUi((h) =>
    graphSurface(h, state, {
      id: 'zloz-test',
      label: 'Diagram',
      onInput: ({ type }) => type,
      ...options,
    }),
  );
}
