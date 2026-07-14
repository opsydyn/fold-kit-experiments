import { Schema } from 'effect';
import { Port, Runtime, Subscription } from 'foldkit';
import { html } from 'foldkit/html';
import { describe, expect, it, vi } from 'vitest';

import { update } from './main';
import { Navigated } from './message';
import type { Message } from './message';
import { initModel } from './model';
import { NavigationPort, NavigationValue } from './navigation';

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

  it('delivers an inbound port value through the subscription as Navigated', async () => {
    const h = html<Message>();
    const TestModel = Schema.Struct({ navigation: NavigationValue });
    type TestModel = typeof TestModel.Type;
    const received: Message[] = [];
    const testSubscriptions = Subscription.make<TestModel, Message>()(() => ({
      navigation: Port.subscription(NavigationPort, (value) => Navigated(value)),
    }));
    const container = document.createElement('div');
    container.id = 'request-diagnostics-port-test';
    document.body.appendChild(container);
    const handle = Runtime.embed(
      Runtime.makeElement({
        Model: TestModel,
        init: () => [{ navigation: initModel.navigation }, []],
        update: (model, message) => {
          received.push(message);
          return [model, []];
        },
        view: (model) => h.div([], [model.navigation.path]),
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
        Navigated({
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
