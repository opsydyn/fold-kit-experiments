import { execFileSync } from 'node:child_process';

import type { Subprocess } from 'bun';
import { Data, Effect, Schema } from 'effect';

class LocalStackSignalFailed extends Data.TaggedError('LocalStackSignalFailed')<{
  readonly cause: unknown;
}> {}

type ProcessEntry = { pid: number; parent: number; state: string };
const processes = (): ProcessEntry[] =>
  execFileSync('ps', ['-axo', 'pid=,ppid=,stat='], { encoding: 'utf8' })
    .trim()
    .split('\n')
    .map((line) => {
      const [pid, parent, state] = line.trim().split(/\s+/);
      return { pid: Number(pid), parent: Number(parent), state: state ?? '' };
    });

const descendants = (roots: ReadonlySet<number>, entries: readonly ProcessEntry[]) => {
  const owned = new Set(roots);
  let size: number;
  do {
    size = owned.size;
    for (const entry of entries) if (owned.has(entry.parent)) owned.add(entry.pid);
  } while (owned.size !== size);
  return owned;
};
function signalProcess(pid: number, signal: NodeJS.Signals) {
  Effect.runSync(
    Effect.try({
      try: () => process.kill(pid, signal),
      catch: (cause) => new LocalStackSignalFailed({ cause }),
    }).pipe(
      Effect.catchIf(
        ({ cause }) => Schema.is(Schema.Struct({ code: Schema.Literal('ESRCH') }))(cause),
        () => Effect.succeed(false),
      ),
    ),
  );
}
const surviving = (owned: ReadonlySet<number>) =>
  processes().filter((entry) => owned.has(entry.pid) && !entry.state.startsWith('Z'));

/** POSIX test stacks only: discover descendants before reparenting destroys ownership. */
export async function stopLocalStack(
  child: Pick<Subprocess, 'pid' | 'exitCode' | 'exited'>,
  signal: 'SIGINT' | 'SIGKILL' = 'SIGINT',
): Promise<void> {
  if (child.exitCode !== null) {
    await child.exited;
    return;
  }
  let owned = descendants(new Set([child.pid]), processes());
  if (signal === 'SIGINT') {
    signalProcess(child.pid, signal);
    const deadline = Date.now() + 5000;
    while (surviving(owned).length && Date.now() < deadline) await Bun.sleep(25);
  }
  if (surviving(owned).length) {
    // Freeze known parents before re-scanning so no new native child can escape
    // between discovering the tree and abruptly stopping its independent groups.
    Effect.runSync(
      Effect.sync(() => {
        let frozen = new Set<number>();
        while (true) {
          const fresh = [...owned].filter((pid) => !frozen.has(pid));
          if (!fresh.length) break;
          for (const pid of fresh) signalProcess(pid, 'SIGSTOP');
          frozen = new Set(owned);
          owned = descendants(owned, processes());
        }
        for (const pid of owned) signalProcess(pid, 'SIGKILL');
      }).pipe(
        Effect.onError(() =>
          Effect.sync(() => {
            for (const pid of owned) signalProcess(pid, 'SIGCONT');
          }),
        ),
      ),
    );
  }
  await child.exited;
  const deadline = Date.now() + 5000;
  while (surviving(owned).length && Date.now() < deadline) await Bun.sleep(25);
  if (surviving(owned).length)
    throw new LocalStackSignalFailed({
      cause: 'Owned native qualification processes survived stop',
    });
}
