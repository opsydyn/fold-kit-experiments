import { Schema } from 'effect';
import { Port, Runtime, Subscription } from 'foldkit';
import { describe, expect, it, vi } from 'vitest';

import { update } from './main';
import { Message } from './message';
import type { Message as AppMessage } from './message';
import { initModel } from './model';
import { NavigationPort, NavigationValue } from './navigation';

describe('request diagnostics navigation scene', () => {
  it('updates route metadata without rebuilding chart models', () => {
    const model = initModel;
    const { model: nextModel, commands } = update(
      model,
      Message.Navigated({
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

  it('delivers an inbound port value through the subscription as Navigated', async () => {
    const TestModel = Schema.Struct({ navigation: NavigationValue });
    type TestModel = typeof TestModel.Type;
    const received: AppMessage[] = [];
    const testSubscriptions = Subscription.make<TestModel, AppMessage>()(() => ({
      navigation: Port.subscription(NavigationPort, (value) => Message.Navigated(value)),
    }));
    const container = document.createElement('div');
    container.id = 'request-diagnostics-port-test';
    document.body.appendChild(container);
    const handle = Runtime.embed(
      Runtime.makeElement({
        Model: TestModel,
        init: () => ({ model: { navigation: initModel.navigation } }),
        update: (model, message) => {
          received.push(message);
          return { model };
        },
        view: (model, h) => h.div([], [model.navigation.path]),
        subscriptions: testSubscriptions,
        ports: { inbound: { navigation: NavigationPort } },
        container,
      }),
    );

    handle.ports.navigation.send({
      phase: 'stayed',
      path: '/request-diagnostics/acme/platform/docs/intro.md',
      previousPath: '/request-diagnostics',
    });

    await vi.waitFor(() => {
      expect(received).toEqual([
        Message.Navigated({
          phase: 'stayed',
          path: '/request-diagnostics/acme/platform/docs/intro.md',
          previousPath: '/request-diagnostics',
        }),
      ]);
    });
    handle.dispose();
    container.remove();
  });
});
