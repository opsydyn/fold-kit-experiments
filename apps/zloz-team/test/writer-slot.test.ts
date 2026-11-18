import { expect, test } from 'bun:test';

import { completeLoadEdit } from './load';

test.each(['HTTP receipt', 'writer DOM'])(
  'a writer stays pending for %s, then releases independently of all-peer clock sampling',
  async (pending) => {
    const http = Promise.withResolvers<void>();
    const ownDom = Promise.withResolvers<void>();
    const clock = Promise.withResolvers<void>();
    const measuring = Promise.withResolvers<void>();
    let released = false;
    let finished = false;
    const completion = completeLoadEdit(
      async () => {
        await http.promise;
        await ownDom.promise;
      },
      async () => {
        measuring.resolve();
        await clock.promise;
      },
      () => {
        released = true;
      },
    ).then(() => {
      finished = true;
    });
    await using _cleanup = {
      async [Symbol.asyncDispose]() {
        http.resolve();
        ownDom.resolve();
        clock.resolve();
        await completion;
      },
    };
    const prerequisite = pending === 'HTTP receipt' ? http : ownDom;
    const other = pending === 'HTTP receipt' ? ownDom : http;
    other.resolve();
    await Promise.resolve();
    expect(released).toBe(false);
    prerequisite.resolve();
    await measuring.promise;
    expect(released).toBe(true);
    expect(finished).toBe(false);
    clock.resolve();
    await completion;
    expect(finished).toBe(true);
  },
);
