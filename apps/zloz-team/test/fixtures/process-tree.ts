import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const [directory, role] = process.argv.slice(2);
if (!directory || !role) throw new Error('Missing isolated process fixture arguments');
const next = role === 'parent' ? 'child' : role === 'child' ? 'leaf' : null;
if (next)
  Bun.spawn([process.execPath, import.meta.path, directory, next], {
    detached: true,
    stdout: 'ignore',
    stderr: 'inherit',
  });
await writeFile(join(directory, `${role}.json`), JSON.stringify({ pid: process.pid }));
setInterval(() => {}, 1000);
