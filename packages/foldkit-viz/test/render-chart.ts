import type { View } from '@effect/ui';
import { Html, HtmlServer } from '@effect/ui/html';
import { Effect, Option, Result, Schema } from 'effect';

/** Renders the chart through the real Effect UI server host. */
export async function renderChart(
  render: (h: Html.H<string>) => View.Content<string>,
): Promise<string> {
  let failure = Option.none<unknown>();
  function view(h: Html.H<string>) {
    const content = Result.try(() => render(h));
    return Result.match(content, {
      onFailure: (error) => {
        failure = Option.some(error);
        return h.div;
      },
      onSuccess: (result) => result,
    });
  }
  const Chart = Html.component({
    name: 'ChartTest',
    model: Schema.Null,
    message: Schema.String,
  }).make({
    init: () => null,
    update: () => null,
    view,
  });
  const rendered = HtmlServer.renderToHtml(Chart, {}, { static: true });
  const result = await Effect.runPromise(rendered);
  if (Option.isSome(failure)) throw failure.value;
  return result.html;
}
