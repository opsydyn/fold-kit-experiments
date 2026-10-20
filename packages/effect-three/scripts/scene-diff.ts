// Scene diffs for review: what changed between two saved scene files, one line per change.
//
//   bun run scene:diff before.json after.json
//
// Exits 1 when a file cannot be read or the second scene is invalid.
import { formatChanges, type SceneDescription, sceneChanges } from '../src/kernel/index.ts';
import { SceneFile } from '../src/runtime/index.ts';

const fail = (reason: string): never => {
  console.error(reason);
  process.exit(1);
};

/** The scene in the file at `path`, or the reason it cannot be read, and out. */
const sceneAt = async (path: string): Promise<SceneDescription> => {
  const read = SceneFile.read(await Bun.file(path).text());
  return read._tag === 'Success'
    ? read.success
    : fail(`${path} cannot be read as a scene:\n${read.failure.issue}`);
};

const [beforePath, afterPath] = process.argv.slice(2);
if (beforePath === undefined || afterPath === undefined) {
  fail('usage: bun run scene:diff <before.json> <after.json>');
} else {
  const result = sceneChanges(await sceneAt(beforePath), await sceneAt(afterPath));
  console.log(
    result._tag === 'Changes'
      ? formatChanges(result.changes)
      : fail(`${afterPath} is not a valid scene: ${result.error._tag}.`),
  );
}
