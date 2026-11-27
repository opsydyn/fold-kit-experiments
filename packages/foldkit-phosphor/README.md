# FoldKit Phosphor

Private workspace adapter for Phosphor Core. The root prepares SVG attributes
and artwork as plain data. The Effect UI entry renders that artwork inside its
parent component tree.

## Compile selected artwork at build time

Core 2.1.1 supplies six weights: regular, thin, light, bold, fill and duotone.
Select only the assets the application uses. The separate compiler entry parses
pinned official SVGs into readonly static data; the rendering entry imports
neither SAX nor the Core catalog.

```ts
// build-icons.ts (Bun/Node build tool; not a view or Command)
import { readFile, writeFile } from 'node:fs/promises';
import { compilePhosphorIcon } from '@opsydyn/foldkit-phosphor/compile';

const svg = await readFile(
  new URL(import.meta.resolve('@phosphor-icons/core/assets/duotone/cube-duotone.svg')),
  'utf8',
);
const definition = compilePhosphorIcon(svg);
await writeFile('cube.ts', `export const cubeIcon = ${JSON.stringify(definition)} as const;`);
```

`examples/generate-c4.ts` generates the five C4 Board defaults as typed modules.
Run it with Bun from this workspace after building the adapter. Retain Phosphor's
MIT copyright and permission notice with generated artwork; `PHOSPHOR-LICENSE`
contains the upstream notice. Core is a development dependency of the generating
application, not an imported browser catalog.

## Render in the parent view

```ts
import { phosphorIcon } from '@opsydyn/foldkit-phosphor/effect-ui';
import type { Html } from '@effect/ui/html';
import { cubeIcon } from './cube';

type Message = { readonly _tag: 'ClickedAddSystem' };
export const addSystem = (h: Html.H<Message>) =>
  h.button
    .attr('aria-label', 'Add system')
    .on('click', { _tag: 'ClickedAddSystem' })
    .children(phosphorIcon(h, cubeIcon, { size: 20, attributes: { class: 'tool-icon' } }));
```

Options: `size` (positive number, default 24, or CSS length such as `1em`),
`colour` (CSS colour including variables), `mirrored` (explicit, default false),
`label`, and SVG `attributes`. Artwork inherits currentColor and
preserves Core's duotone opacity. Use CSS colour variables for light/dark themes.
No global defaults: shared preferences belong to the app's Model and can be
spread into options.

Icons are decorative and unfocusable by default. Their containing button/link
owns its accessible name and interactions. For independently meaningful artwork,
pass a nonempty `label`; this renders role=img with aria-label without title IDs.
Caller attributes compose on the SVG; adapter geometry, size, focusability and
label/decorative semantics are applied after them. The adapter adds no event
listeners or commands. The icon uses the parent component's Message type.

Compilation rejects unsupported/active elements and attributes, resources,
declarations, malformed XML, unexpected viewBoxes, empty artwork and excessive
size/nesting. This is an intentionally narrow compiler for trusted pinned Core
assets, **not an uploaded-SVG sanitizer**. It returns deeply frozen definitions;
generated literal modules retain their readonly type. Do not pass arbitrary
uploaded definitions directly to the renderer.

## Verify

```sh
bun run --filter @opsydyn/foldkit-phosphor build
bun run --filter @opsydyn/foldkit-phosphor typecheck
bun run --filter @opsydyn/foldkit-phosphor test
```

Tests compile all official assets/weights, exercise actual FoldKit server output
and equivalent DOM attributes, reject active input, check render bundle isolation,
and install a real tarball for Node/Bun and Bundler/NodeNext public type checks.
Qualified on FoldKit 0.171.0 and Effect 4.1.0. The package remains private; no npm
publication, Zloz integration, shared icon assignment or upload service is included.
