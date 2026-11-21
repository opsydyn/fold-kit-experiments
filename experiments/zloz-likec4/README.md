# LikeC4 static-view import qualification

The private fixture exercises the same import projection used by Teams. The
pinned LikeC4 CLI validates the source and generates the laid-out JSON.

## Run the qualification

From the repository root after installing the root workspace dependencies:

```sh
bun run --filter @opsydyn/foldkit-zloz build
npm --prefix experiments/zloz-likec4 ci --ignore-scripts
npm --prefix experiments/zloz-likec4 test
```

## Import one static view

Validate and export one project with LikeC4 1.61.0. Use the normal layout pass
so the JSON contains the selected view's positions and dimensions.

```sh
cd experiments/zloz-likec4
./node_modules/.bin/likec4 validate /path/to/project --max-warnings 0
./node_modules/.bin/likec4 export json /path/to/project --project my-project -o /tmp/likec4.json
```

```js
import { readFile } from 'node:fs/promises';
import { importLikeC4 } from './import.mjs';

const result = importLikeC4(await readFile('/tmp/likec4.json', 'utf8'), 'context');
if (result.status === 'converted') {
  console.table(result.value.diagnostics);
  // Serialize result.value.document with the core v3 document codec.
} else {
  console.table(result.diagnostics);
}
```

The detached document contains the selected view's visible authored elements,
their world positions and dimensions, and their view containment. It uses
LikeC4's authored IDs and resolves rendered edges to their original relationship
IDs, endpoints and labels. Parallel relationships stay separate. A relationship
that connects to a hidden element is reported and omitted. View-only groups and
edges are reported too. Other views and elements outside the chosen view stay
in the source project.

Each connected node receives a shared midpoint port per needed direction, with
group ports enabled when needed. Generated ports appear as informational
findings. Loss findings cover view styling and routing, unsupported element
kinds and metadata, and bidirectional arrowheads. The result uses one directed
edge per supported authored relationship. Treat the source JSON as the record
for omitted data. The caller owns any later editor or Teams apply operation.

The import test validates a DSL fixture and obtains its JSON from the pinned
LikeC4 CLI. Independent checks cover nested geometry, authored group endpoints
and aggregated parallel relationships. Reopening the result exercises the
native v3 document codec.
