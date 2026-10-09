import sdk from '@stackblitz/sdk';
import { Data, Effect, Schema } from 'effect';
import { Mount } from 'foldkit';

import { Message } from './message';

class EditorPreparationError extends Data.TaggedError('EditorPreparationError')<{
  readonly message: string;
}> {}

async function connectEditor(
  element: Element,
  target: HTMLElement,
  templateUrl: string,
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch(templateUrl, { signal });
  if (!response.ok) throw new EditorPreparationError({ message: 'Project download failed' });
  const files = Schema.decodeUnknownSync(Schema.Record(Schema.String, Schema.String))(
    await response.json(),
  );
  if (signal.aborted || !element.isConnected)
    throw new EditorPreparationError({ message: 'Editor host was removed' });
  const connection = sdk.embedProject(
    target,
    {
      title: 'Foldkit Viz — Dataset explorer',
      description: 'Edit the native FoldKit chart and preview the result.',
      template: 'node',
      files,
    },
    {
      openFile: 'src/chart.ts',
      height: 760,
      showSidebar: false,
      theme: 'dark',
      crossOriginIsolated: true,
    },
  );
  const frame = element.querySelector('iframe');
  // The SDK starts at about:blank, then POSTs to StackBlitz. Delegate isolation
  // to that explicit origin so WebContainers can start after navigation.
  frame?.setAttribute('allow', 'cross-origin-isolated https://stackblitz.com');
  frame?.setAttribute('title', 'Dataset code editor and chart preview');
  await connection;
}

// FoldKit retains the host; StackBlitz only owns its children. Mount's scope
// cleans the frame and aborts pending preparation when the host is removed.
export const EmbedDatasetEditor = Mount.define('EmbedDatasetEditor', {
  args: { templateUrl: Schema.String, revision: Schema.Number },
  messages: [Message.SucceededEditor, Message.FailedEditor],
  execute: ({ element, templateUrl, revision }) =>
    Effect.gen(function* () {
      const target = yield* Effect.acquireRelease(
        Effect.sync(() => element.appendChild(document.createElement('div'))),
        () => Effect.sync(() => element.replaceChildren()),
      );
      yield* Effect.tryPromise({
        try: (signal) => connectEditor(element, target, templateUrl, signal),
        catch: () => 'The editor could not connect.',
      }).pipe(Effect.timeout('180 seconds'));
      return Message.SucceededEditor({ revision });
    }).pipe(
      Effect.catch(() =>
        Effect.gen(function* () {
          yield* Effect.sync(() => element.replaceChildren());
          return Message.FailedEditor({
            revision,
            error: 'The editor could not connect. Retry or open the starter in StackBlitz.',
          });
        }),
      ),
    ),
});
