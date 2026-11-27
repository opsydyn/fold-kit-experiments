import type { View } from '@effect/ui';
import { Html, HtmlServer } from '@effect/ui/html';
import { Schema } from 'effect';

import { Message } from '../src/editor/message';
import type { Model } from '../src/editor/model';

export function renderNativeReview(
  model: Model,
  view: (
    model: Model,
    h: Html.H<Message>,
    send: (message: Message) => Message,
  ) => View.Content<Message>,
) {
  const Review = Html.component({
    name: 'ReviewTest',
    model: Schema.Null,
    message: Message,
  }).make({
    init: () => null,
    update: ($) => $.model,
    view: (h) => view(model, h, (message) => message),
  });
  return HtmlServer.renderToHtml(Review, {}, { static: true });
}
