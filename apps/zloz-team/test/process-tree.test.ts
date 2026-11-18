import { expect, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Data, Result, Schema } from 'effect';

import { stopLocalStack } from '../tools/stop-local-stack';

class ProcessFixtureUnavailable extends Data.TaggedError('ProcessFixtureUnavailable') {}

function alive(pid: number): boolean {
  const result = Result.try({ try: () => process.kill(pid, 0), catch: (cause) => cause });
  return Result.match(result, {
    onSuccess: (active) => active,
    onFailure: (cause) => {
      if (Schema.is(Schema.Struct({ code: Schema.Literal('ESRCH') }))(cause)) return false;
      throw cause;
    },
  });
}
const Pid = Schema.fromJsonString(
  Schema.Struct({ pid: Schema.Number.pipe(Schema.check(Schema.isInt(), Schema.isGreaterThan(0))) }),
);

test.each(['SIGINT', 'SIGKILL'] as const)(
  '%s stops every owned descendant, including detached native process groups',
  async (signal) => {
    const directory = await mkdtemp(join(tmpdir(), 'zloz-owned-process-tree-'));
    const child = Bun.spawn(
      [
        process.execPath,
        new URL('./fixtures/process-tree.ts', import.meta.url).pathname,
        directory,
        'parent',
      ],
      { detached: true, stdout: 'ignore', stderr: 'inherit' },
    );
    const unrelated = Bun.spawn(
      [
        process.execPath,
        new URL('./fixtures/process-tree.ts', import.meta.url).pathname,
        directory,
        'sibling',
      ],
      { detached: true, stdout: 'ignore', stderr: 'inherit' },
    );
    const pids: number[] = [child.pid];
    await using _cleanup = {
      async [Symbol.asyncDispose]() {
        for (const pid of pids) if (alive(pid)) process.kill(pid, 'SIGKILL');
        if (alive(unrelated.pid)) unrelated.kill('SIGKILL');
        await unrelated.exited;
        await child.exited;
        await rm(directory, { recursive: true, force: true });
      },
    };
    const deadline = Date.now() + 5000;
    for (const role of ['child', 'leaf']) {
      while (true) {
        const value = await readFile(join(directory, `${role}.json`), 'utf8').catch(() => null);
        if (value) {
          pids.push(Schema.decodeUnknownSync(Pid)(value).pid);
          break;
        }
        if (Date.now() > deadline) throw new ProcessFixtureUnavailable();
        await Bun.sleep(20);
      }
    }
    expect(pids.every(alive)).toBe(true);
    await stopLocalStack(child, signal);
    const stopped = Date.now() + 2000;
    while (pids.some(alive) && Date.now() < stopped) await Bun.sleep(20);
    expect(pids.filter(alive)).toEqual([]);
    expect(alive(unrelated.pid)).toBe(true);
    await stopLocalStack(child, signal);
  },
  10_000,
);
