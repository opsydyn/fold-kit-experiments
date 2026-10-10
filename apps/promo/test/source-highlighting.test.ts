import { expect, test } from 'bun:test';

import { Match } from 'effect';
import { toHtml } from 'hast-util-to-html';

import {
  highlightedTree,
  highlightingResources,
} from '../../../packages/dataset-explorer/src/highlighting';
import { createHighlighter } from '../../../packages/dataset-explorer/src/highlighting-engine';

const highlighter = await createHighlighter();
const text = (node: import('hast').Root | import('hast').Element): string =>
  node.children
    .map((child) =>
      Match.value(child).pipe(
        Match.when({ type: 'text' }, (node) => node.value),
        Match.when({ type: 'element' }, text),
        Match.orElse(() => ''),
      ),
    )
    .join('');

test('tokens preserve source exactly and escape HTML', () => {
  const source = 'const greeting = "<script>alert(1)</script>";\n\t// hello\n';
  const tree = highlightedTree(source, 'sample.ts', highlighter);
  expect(text(tree)).toBe(source);
  expect(toHtml(tree)).toContain('class="pl-');
  expect(toHtml(tree)).not.toContain('<script>');
});

test('required grammars are complete and theme-independent', () => {
  expect(highlighter.missingScopes()).toEqual([]);
  for (const [name, source] of [
    ['sample.css', 'p { color: red; }'],
    ['snapshot.json', '{"count": 3}'],
    ['sh', 'echo "$HOME"'],
    ['sample.astro', '---\nconst x = 1;\n---\n<h1>{x}</h1>'],
  ] as const) {
    const tree = highlightedTree(source, name, highlighter);
    expect(text(tree)).toBe(source);
    expect(toHtml(tree)).toContain('class="pl-');
    expect(toHtml(tree)).not.toContain('style=');
  }
});

test('unknown language and unavailable highlighter retain readable source', () => {
  expect(text(highlightedTree('<x>\n', 'unknown.xyz', highlighter))).toBe('<x>\n');
  expect(toHtml(highlightedTree('<x>\n', 'sample.ts', null))).toBe('&#x3C;x>\n');
});

test('native tokens survive Model JSON preservation and refresh only for changed source', async () => {
  const [
    { init, Model },
    { Message },
    { update, currentSource },
    { view },
    { renderToString },
    { Effect, Schema },
  ] = await Promise.all([
    import('../src/examples/line/model'),
    import('../src/examples/line/message'),
    import('../src/examples/line/update'),
    import('../src/examples/line/view'),
    import('foldkit/experimental/server'),
    import('effect'),
  ]);
  const started = init({
    sources: [{ name: 'view.ts', content: 'const tag = "<script>unsafe</script>";' }],
    templateUrl: null,
    embeddedEditor: false,
  }).model;
  const requested = update(started, Message.AcquiredHighlighter());
  expect(requested.commands).toHaveLength(1);
  const source = currentSource(requested.model);
  const ready = update(
    requested.model,
    Message.SettledHighlightedSource({
      highlightedSource: {
        source,
        language: 'settings.ts',
        tree: highlightedTree(source, 'settings.ts', highlighter),
      },
    }),
  ).model;
  expect(update(ready, Message.RecordedChartWidth({ width: 500 })).commands).toBeUndefined();
  const codec = Schema.toCodecJson(Model);
  const restored = Schema.decodeUnknownSync(codec)(Schema.encodeSync(codec)(ready));
  expect(restored.highlightedSource).toEqual(ready.highlightedSource);
  expect(restored.settings).toEqual(ready.settings);
  const reacquired = update(restored, Message.AcquiredHighlighter());
  expect(reacquired.model.highlightedSource).toBeUndefined();
  expect(reacquired.commands).toHaveLength(1);
  const changed = update(restored, Message.ChangedDomain({ value: '150' }));
  expect(changed.commands).toHaveLength(1);
  expect(changed.model.requestedSource?.source).toBe(currentSource(changed.model));
  const selected = update(changed.model, Message.SelectedFile({ name: 'view.ts' })).model;
  const settled = update(
    selected,
    Message.SettledHighlightedSource({
      highlightedSource: {
        source: currentSource(selected),
        language: 'view.ts',
        tree: highlightedTree(currentSource(selected), 'view.ts', highlighter),
      },
    }),
  ).model;
  const rendered = await Effect.runPromise(
    renderToString(
      { Flags: Schema.Struct({}), init: () => ({ model: settled }), view },
      { flags: {}, isHydratable: false },
    ),
  );
  expect(rendered.html).toContain('class="pl-');
  expect(rendered.html).not.toContain('<script>unsafe</script>');
  expect(currentSource(settled)).toBe('const tag = "<script>unsafe</script>";');
  // A delayed settings result must not overwrite the newly selected file's tokens.
  expect(
    update(
      settled,
      Message.SettledHighlightedSource({
        highlightedSource: ready.highlightedSource ?? {
          source: '',
          language: '',
          tree: { type: 'root', children: [] },
        },
      }),
    ).model.highlightedSource,
  ).toBe(settled.highlightedSource);
});

test('stateflow replay frames reuse the selected event tokens', async () => {
  const [{ initModel }, { Message }, { update }, { selectedEventSource }] = await Promise.all([
    import('../../web/src/apps/stateflow/model'),
    import('../../web/src/apps/stateflow/message'),
    import('../../web/src/apps/stateflow/update'),
    import('../../web/src/apps/stateflow/source'),
  ]);
  const acquired = update(initModel, Message.AcquiredHighlighter()).model;
  const stepped = update(acquired, Message.ClickedStep()).model;
  const source = selectedEventSource(stepped);
  const settled = update(
    stepped,
    Message.SettledHighlightedSource({
      highlightedSource: {
        source,
        language: 'json',
        tree: highlightedTree(source, 'json', highlighter),
      },
    }),
  ).model;
  const playing = update(settled, Message.ClickedPlay()).model;
  const frame = update(playing, Message.AdvancedReplay({ deltaTimeMs: 16 }));
  expect(frame.model.highlightedSource).toBe(settled.highlightedSource);
  expect(frame.commands).toBeUndefined();
});

test('resource lifecycle messages discard opaque engine and error values', async () => {
  const [{ Message }, { init }, { Schema }] = await Promise.all([
    import('../src/examples/line/message'),
    import('../src/examples/line/model'),
    import('effect'),
  ]);
  type Model = ReturnType<typeof init>['model'];
  const resources = highlightingResources<Model, typeof Message.Type>({
    acquired: Message.AcquiredHighlighter,
    failed: Message.FailedHighlighter,
    released: Message.ReleasedHighlighter,
  });
  const entry: import('foldkit/managedResource').ManagedResourceConfig<Model, typeof Message.Type> =
    resources.sourceHighlighter;
  expect(entry.onAcquired(highlighter)).toEqual(Message.AcquiredHighlighter());
  const failed = entry.onAcquireError({ _tag: 'OpaqueEngineFailure', method: () => {} });
  expect(failed).toEqual(Message.FailedHighlighter());
  const codec = Schema.toCodecJson(Message);
  expect(Schema.decodeUnknownSync(codec)(Schema.encodeSync(codec)(failed))).toEqual(failed);
});
