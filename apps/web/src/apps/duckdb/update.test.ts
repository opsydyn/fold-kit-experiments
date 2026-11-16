import { describe, expect, it } from 'vitest';

import { Message } from './message';
import { init } from './model';
import type { Ran } from './model';
import { update } from './update';

const { model } = init({});
const ran = (bins: number, kind: Ran['kind']): Ran => ({
  bins,
  kind,
  histogram: {},
  grid: {},
  ms: 12,
  statements: ['SELECT 1'],
});
const names = (result: ReturnType<typeof update>) =>
  result.commands?.map((command) => command.name);

describe('duckdb page', () => {
  it('starts DuckDB only when asked, then queries both charts once it is ready', () => {
    expect(model.engine).toBe('off');
    const starting = update(model, Message.ClickedLoad());
    expect(starting.model.engine).toBe('starting');
    expect(names(starting)).toBeUndefined();
    const ready = update(starting.model, Message.AcquiredDuckDB());
    expect(ready.model.engine).toBe('ready');
    expect(ready.model.querying).toBe(true);
    expect(names(ready)).toEqual(['RunQueries']);
  });

  it('queries again when the bins or kind change, but only once DuckDB is ready', () => {
    expect(names(update(model, Message.SelectedBins({ bins: 20 })))).toBeUndefined();
    const ready = update(
      update(model, Message.ClickedLoad()).model,
      Message.AcquiredDuckDB(),
    ).model;
    const binned = update(ready, Message.SelectedBins({ bins: 20 }));
    expect(binned.model.bins).toBe(20);
    expect(names(binned)).toEqual(['RunQueries']);
    expect(names(update(ready, Message.SelectedKind({ kind: 'read' })))).toEqual(['RunQueries']);
  });

  it('keeps an answer only for the bins and kind still chosen', () => {
    const ready = update(
      update(model, Message.ClickedLoad()).model,
      Message.AcquiredDuckDB(),
    ).model;
    const chosen = update(ready, Message.SelectedBins({ bins: 20 })).model;
    const stale = update(chosen, Message.RanQueries({ ran: ran(40, 'all') })).model;
    expect(stale.ran).toBeNull();
    expect(stale.querying).toBe(true);
    const fresh = update(chosen, Message.RanQueries({ ran: ran(20, 'all') })).model;
    expect(fresh.ran?.bins).toBe(20);
    expect(fresh.querying).toBe(false);
  });

  it('reports a failure to start, and lets the visitor try again', () => {
    const failed = update(
      update(model, Message.ClickedLoad()).model,
      Message.FailedDuckDB({ reason: 'no WebAssembly' }),
    ).model;
    expect(failed.engine).toBe('failed');
    expect(failed.failure).toBe('no WebAssembly');
    expect(update(failed, Message.ClickedLoad()).model.engine).toBe('starting');
  });
});
