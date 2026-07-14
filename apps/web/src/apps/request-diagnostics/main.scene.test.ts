import { describe, expect, it } from 'vitest';

import { Navigated } from './message';
import { initModel } from './model';
import { update } from './update';

describe('request diagnostics navigation scene', () => {
  it('updates route metadata without rebuilding chart models', () => {
    const model = initModel;
    const [nextModel, commands] = update(
      model,
      Navigated({
        phase: 'entered',
        path: '/request-diagnostics/acme/platform/docs/intro.md',
        previousPath: '/request-diagnostics',
      }),
    );

    expect(commands).toEqual([]);
    expect(nextModel.histogram).toBe(model.histogram);
    expect(nextModel.scatter).toBe(model.scatter);
    expect(nextModel.route).toEqual({
      _tag: 'Document',
      repository: 'acme/platform',
      document: 'docs/intro.md',
    });
  });
});
