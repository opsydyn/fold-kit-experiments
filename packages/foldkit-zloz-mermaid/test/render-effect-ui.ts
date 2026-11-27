import type { View } from '@effect/ui';
import { Html, HtmlServer } from '@effect/ui/html';
import { Effect, Schema } from 'effect';
import { Window } from 'happy-dom';

export const observedRequest = 'ObservedRequest' as const;
export type Request = typeof observedRequest;

export async function render(view: (h: Html.H<Request>) => View.Content<Request>) {
  const Test = Html.component({
    name: 'MermaidReview',
    model: Schema.Null,
    message: Schema.Literal(observedRequest),
  }).make({
    init: () => null,
    update: ($) => $.model,
    view,
  });
  const result = await Effect.runPromise(HtmlServer.renderToHtml(Test, {}, { static: true }));
  const window = new Window();
  window.document.body.innerHTML = result.html;
  return window.document;
}
