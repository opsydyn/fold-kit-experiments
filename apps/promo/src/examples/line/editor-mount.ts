import sdk from '@stackblitz/sdk';
import { Data, Effect, Schema } from 'effect';
import { Mount } from 'foldkit';

import { Message } from './message';
import { Settings } from './model';
import { projectFiles } from './project';

class EditorPreparationError extends Data.TaggedError('EditorPreparationError')<{
  readonly message: string;
}> {}

async function connectEditor(
  element: Element,
  target: HTMLElement,
  initialSettings: typeof Settings.Type,
  templateUrl: string,
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch(templateUrl, { signal });
  if (!response.ok)
    throw new EditorPreparationError({ message: 'Could not load the example project.' });
  const template = Schema.decodeUnknownSync(Schema.Record(Schema.String, Schema.String))(
    await response.json(),
  );
  if (signal.aborted || !element.isConnected)
    throw new EditorPreparationError({ message: 'Editor host was removed.' });
  const connection = sdk.embedProject(
    target,
    {
      title: 'Foldkit Viz — Live line',
      description: 'Edit the code and watch the FoldKit chart change.',
      template: 'node',
      files: projectFiles(template, initialSettings),
    },
    {
      openFile: 'src/settings.ts',
      height: 640,
      showSidebar: false,
      theme: 'dark',
      crossOriginIsolated: true,
    },
  );
  const frame = element.querySelector('iframe');
  // SDK-generated frames start at about:blank and navigate through a POST.
  // An explicit origin keeps the isolation delegation valid after navigation.
  frame?.setAttribute('allow', 'cross-origin-isolated https://stackblitz.com');
  frame?.setAttribute('title', 'Live line code editor and chart preview');
  await connection;
}

// FoldKit owns the host; StackBlitz owns only its children. The SDK replaces
// its target with an iframe, so it must never receive the renderer's host.
export const EmbedEditor = Mount.define('EmbedEditor', {
  args: { initialSettings: Settings, templateUrl: Schema.String, revision: Schema.Number },
  messages: [Message.SucceededEditor, Message.FailedEditor],
  execute: ({ element, initialSettings, templateUrl, revision }) =>
    Effect.gen(function* () {
      const target = yield* Effect.acquireRelease(
        Effect.sync(() => element.appendChild(document.createElement('div'))),
        () => Effect.sync(() => element.replaceChildren()),
      );
      yield* Effect.tryPromise({
        try: (signal) => connectEditor(element, target, initialSettings, templateUrl, signal),
        catch: () => 'The editor could not connect.',
      }).pipe(Effect.timeout('180 seconds'));
      return Message.SucceededEditor({ revision });
    }).pipe(
      Effect.catch(() =>
        Effect.gen(function* () {
          yield* Effect.sync(() => element.replaceChildren());
          return Message.FailedEditor({
            revision,
            error: 'The editor could not connect. Retry or open the example in StackBlitz below.',
          });
        }),
      ),
    ),
});
