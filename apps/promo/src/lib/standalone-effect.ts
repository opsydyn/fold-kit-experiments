import type { SourceFile } from './example-project';

export function effectUiEntry(
  sources: ReadonlyArray<SourceFile>,
  component: 'DatasetExplorer' | 'Histogram' | 'Line' | 'Scatter' | 'PromoComparison',
  source: { readonly module: string; readonly stylesheet?: string },
  props: string,
): string {
  const imports = sources
    .map(({ name }, index) => `import source${index} from './${name}?raw';`)
    .join('\n');
  const sourceList = sources
    .map(({ name }, index) => `{ name: '${name}', content: source${index} }`)
    .join(',\n');
  return `import { Renderer } from '@effect/ui';
import { BrowserHost, Html } from '@effect/ui/html';
import { Effect, Fiber } from 'effect';
import { ${component} } from '${source.module}';
${source.stylesheet === undefined ? '' : `import './${source.stylesheet}';\n`}import './standalone.css';
${imports}
const container = document.getElementById('app');
if (!container) throw new Error('Missing example container');
const sources = [
${sourceList}
] as const;

// The pinned preview cannot infer the namespace of SVG metadata during DOM creation.
const native = BrowserHost.makeHost(document);
const host = {
  ...native,
  createElement: (tag: string) => tag === 'title' || tag === 'desc'
    ? document.createElementNS('http://www.w3.org/2000/svg', tag)
    : native.createElement(tag),
};
const run = Renderer.mount(${component}, ${props}, container, { head: false }).pipe(
  Effect.provide(Renderer.layer(host)),
  Effect.provideService(Html.Host, BrowserHost.htmlHost),
  Effect.andThen(Effect.never),
  Effect.ensuring(Effect.sync(native.dispose)),
  Effect.scoped,
);
const fiber = Effect.runFork(run);
import.meta.hot?.dispose(() => Effect.runFork(Fiber.interrupt(fiber)));
`;
}
