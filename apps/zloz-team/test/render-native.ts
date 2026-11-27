import type { View } from '@effect/ui';
import { Html, HtmlServer } from '@effect/ui/html';
import { Effect, Schema } from 'effect';

import { Message, view, type Model } from '../src/editor/main';

export async function renderStatic<S extends Schema.Codec<unknown>>(
  message: S,
  display: (h: Html.H<S['Type']>) => View.Content<S['Type']>,
) {
  const fixture = Html.component({ name: 'TeamsTestView', model: Schema.Null, message }).make({
    init: () => null,
    update: ($) => $.model,
    view: display,
  });
  const rendered = HtmlServer.renderToHtml(fixture, {}, { static: true });
  return await Effect.runPromise(rendered);
}

export const renderBoard = (model: Model) => renderStatic(Message, (h) => view(model, h).body);
