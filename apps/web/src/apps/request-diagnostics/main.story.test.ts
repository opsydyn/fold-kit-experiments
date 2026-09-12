import { describe, expect, it } from 'vitest';

import { Message } from './message';
import { initModel } from './model';
import { update } from './update';

describe('request diagnostics navigation lifecycle', () => {
  it.each([
    ['coldLoad', '/', null],
    ['entered', '/request-diagnostics', '/'],
    ['stayed', '/request-diagnostics/acme/platform/docs/intro.md', '/request-diagnostics'],
    ['exited', '/request-diagnostics/acme/platform/docs/intro.md', '/request-diagnostics'],
  ] as const)('records %s navigation facts', (phase, path, previousPath) => {
    const { model } = update(initModel, Message.Navigated({ phase, path, previousPath }));

    expect(model.navigation).toEqual({ phase, path, previousPath });
    expect(model.lastTransition).toBe(`${phase} ${path}`);
  });

  it('keeps an active metrics request on retained-island navigation', () => {
    const { model: nextModel, commands } = update(
      initModel,
      Message.Navigated({
        phase: 'stayed',
        path: '/request-diagnostics/acme/platform/docs/intro.md',
        previousPath: '/request-diagnostics',
      }),
    );

    expect(nextModel.explorer).toBe(initModel.explorer);
    expect(nextModel.histogram).toBe(initModel.histogram);
    expect(nextModel.scatter).toBe(initModel.scatter);
    expect(commands).toEqual([]);
  });
});
