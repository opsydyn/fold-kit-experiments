import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { Schema } from 'effect';

import workspace from '../../../package.json';
import manifest from '../package.json';

const exec = promisify(execFile);
const packageName = '@opsydyn/foldkit-zloz';
const version = manifest.peerDependencies[packageName];
const readPacked = Schema.decodeUnknownSync(
  Schema.fromJsonString(
    Schema.Tuple([
      Schema.Struct({
        name: Schema.Literal(packageName),
        version: Schema.Literal(version),
        filename: Schema.Literal(`opsydyn-foldkit-zloz-${version}.tgz`),
      }),
    ]),
  ),
);

export async function packReleasedCore(directory: string): Promise<string> {
  const { stdout } = await exec(
    'npm',
    [
      'pack',
      '--ignore-scripts',
      '--json',
      '--pack-destination',
      directory,
      workspace.workspaces.catalogs.published[packageName],
    ],
    { cwd: directory },
  );
  const [packed] = readPacked(stdout);
  return join(directory, packed.filename);
}
