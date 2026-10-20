// A still of a saved scene, as SVG, without a browser: for a pull request, a gallery or a
// page's placeholder.
//
//   bun run scene:preview scene.json preview.svg [--width 640] [--height 400] [--at 0]
//                                                [--background f4f1ea]
//
// Exits 1 when the file cannot be read or the scene is invalid.
import { parseArgs } from 'node:util';

import { previewSvg } from '../src/kernel/index.ts';
import { SceneFile } from '../src/runtime/index.ts';

const fail = (reason: string): never => {
  console.error(reason);
  process.exit(1);
};

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: {
    width: { type: 'string', default: '640' },
    height: { type: 'string', default: '400' },
    at: { type: 'string', default: '0' },
    background: { type: 'string' },
  },
});

const [scenePath, outPath] = positionals;
if (scenePath === undefined || outPath === undefined) {
  fail(
    'usage: bun run scene:preview <scene.json> <preview.svg> [--width] [--height] [--at] [--background]',
  );
} else {
  const read = SceneFile.read(await Bun.file(scenePath).text());
  const description =
    read._tag === 'Success'
      ? read.success
      : fail(`${scenePath} cannot be read as a scene:\n${read.failure.issue}`);
  const result = previewSvg(description, {
    width: Number(values.width),
    height: Number(values.height),
    at: Number(values.at),
    background:
      values.background === undefined
        ? null
        : Number.parseInt(values.background.replace('#', ''), 16),
  });
  if (result._tag === 'Invalid') fail(`${scenePath} is not a valid scene: ${result.error._tag}.`);
  else {
    await Bun.write(outPath, result.svg);
    console.log(`wrote ${outPath}`);
  }
}
