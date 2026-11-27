import { Html, HtmlServer } from '@effect/ui/html';
import { Effect } from 'effect';

import { Message } from '../src/examples/signals/message';
import { Model } from '../src/examples/signals/model';
import { view } from '../src/examples/signals/view';

export async function render(model: Model): Promise<string> {
  const component = Html.component({
    name: 'SignalViewFixture',
    model: Model,
    message: Message,
  }).make({
    init: () => model,
    update: ($) => $.model,
    view,
  });
  const result = await Effect.runPromise(HtmlServer.renderToHtml(component, {}));
  return result.html;
}
