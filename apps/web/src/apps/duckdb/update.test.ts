import { describe, expect, it } from 'vitest';

import { Message } from './message';
import { init, type Ran } from './model';
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
const ready = update(update(model, Message.ClickedLoad()), Message.AcquiredDuckDB());

describe('duckdb page', () => {
  it('starts DuckDB only when asked, then queries both charts once it is ready', () => {
    expect(model.engine).toBe('off');
    expect(model.revision).toBe(0);
    const starting = update(model, Message.ClickedLoad());
    expect(starting.engine).toBe('starting');
    expect(starting.revision).toBe(1);
    expect(update(starting, Message.ClickedLoad())).toBe(starting);
    expect(ready.engine).toBe('ready');
    expect(ready.querying).toBe(true);
    expect(ready.revision).toBe(starting.revision);
  });

  it('requests a new revision for the bins or kind only once DuckDB is ready', () => {
    expect(update(model, Message.SelectedBins({ bins: 20 })).revision).toBe(0);
    const binned = update(ready, Message.SelectedBins({ bins: 20 }));
    expect(binned.bins).toBe(20);
    expect(binned.revision).toBe(ready.revision + 1);
    const read = update(binned, Message.SelectedKind({ kind: 'read' }));
    expect(read.kind).toBe('read');
    expect(read.revision).toBe(binned.revision + 1);
  });

  it('ignores stale results and errors even when a later request has the same arguments', () => {
    const rerun = update(ready, Message.SelectedBins({ bins: ready.bins }));
    expect(
      update(rerun, Message.RanQueries({ revision: ready.revision, ran: ran(40, 'all') })),
    ).toBe(rerun);
    expect(
      update(rerun, Message.FailedQueries({ revision: ready.revision, reason: 'old error' })),
    ).toBe(rerun);
    expect(
      update(rerun, Message.RanQueries({ revision: rerun.revision, ran: ran(20, 'all') })),
    ).toBe(rerun);
    const fresh = update(
      rerun,
      Message.RanQueries({ revision: rerun.revision, ran: ran(40, 'all') }),
    );
    expect(fresh.ran?.bins).toBe(40);
    expect(fresh.querying).toBe(false);
  });

  it('reports a failure to start, and lets the visitor try again', () => {
    const failed = update(
      update(model, Message.ClickedLoad()),
      Message.FailedDuckDB({ reason: 'no WebAssembly' }),
    );
    expect(failed.engine).toBe('failed');
    expect(failed.failure).toBe('no WebAssembly');
    expect(update(failed, Message.ClickedLoad()).engine).toBe('starting');
  });
});
