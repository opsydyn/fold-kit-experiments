import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { Html, HtmlBuilder } from 'foldkit/html';

/** Real FoldKit render frame; Effects run only at this test I/O boundary. */
export async function renderChart<M>(render: (h: HtmlBuilder<M>) => Html): Promise<string> {
  const result = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({ test: Schema.Boolean }),
        init: () => ({ model: 0 }),
        view: (_model: number, h: HtmlBuilder<M>) => ({ title: 'Chart test', body: render(h) }),
      },
      { flags: { test: true }, isHydratable: false },
    ),
  );
  return result.html;
}
