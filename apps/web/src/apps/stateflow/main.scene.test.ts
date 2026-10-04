import { Runtime } from 'foldkit';
import { describe, expect, it, vi } from 'vitest';

import { fixture } from './fixture';
import { Message } from './message';
import type { Message as AppMessage } from './message';
import { initModel, Model } from './model';
import type { Model as AppModel } from './model';
import { ReplayEventPort, TransitionTelemetryPort } from './ports';
import { subscriptions } from './subscription';
import { update } from './update';

function recordUpdate(
  model: AppModel,
  message: AppMessage,
  received: AppMessage[],
  models: AppModel[],
): ReturnType<typeof update> {
  const result = update(model, message);
  received.push(message);
  models.push(result.model);
  return result;
}

describe('stateflow Port bridge', () => {
  it('bridges the current and changed reduced-motion media query values into the model', async () => {
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    const addEventListener = vi.fn(
      (_type: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.add(listener);
      },
    );
    const removeEventListener = vi.fn(
      (_type: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.delete(listener);
      },
    );
    const mediaQueryList = {
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addEventListener,
      removeEventListener,
    };
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => mediaQueryList),
    );

    const received: AppMessage[] = [];
    const models: AppModel[] = [];
    const container = document.createElement('div');
    container.id = 'stateflow-motion-preference-test';
    document.body.appendChild(container);
    const handle = Runtime.embed(
      Runtime.makeElement({
        Model,
        init: () => ({ model: initModel }),
        update: (model: AppModel, message: AppMessage) =>
          recordUpdate(model, message, received, models),
        view: (_model, h) => h.div([], []),
        subscriptions,
        ports: {
          inbound: { replay: ReplayEventPort },
          outbound: { transitionTelemetry: TransitionTelemetryPort },
        },
        container,
      }),
    );

    const reducedMotionMessage = (isReducedMotion: boolean): AppMessage =>
      Message.ChangedReducedMotion({ isReducedMotion });

    await vi.waitFor(() => {
      expect(received).toContainEqual(reducedMotionMessage(true));
    });
    expect(models.at(-1)?.reducedMotion).toBe(true);

    // SAFETY: The subscription reads only the `matches` field from this synthetic event.
    const changedEvent = { matches: false } as MediaQueryListEvent;
    for (const listener of listeners) {
      listener(changedEvent);
    }
    await vi.waitFor(() => {
      expect(received).toContainEqual(reducedMotionMessage(false));
    });
    expect(models.at(-1)?.reducedMotion).toBe(false);

    handle.dispose();
    expect(removeEventListener).toHaveBeenCalledOnce();
    container.remove();
    vi.unstubAllGlobals();
  });

  it('processes an inbound replay event sent during runtime boot', async () => {
    const received: AppMessage[] = [];
    const container = document.createElement('div');
    container.id = 'stateflow-boot-port-test';
    document.body.appendChild(container);
    const ports = {
      inbound: { replay: ReplayEventPort },
      outbound: { transitionTelemetry: TransitionTelemetryPort },
    } as const;
    const handle = Runtime.embed(
      Runtime.makeElement<AppModel, AppMessage, never, never, typeof ports>({
        Model,
        init: () => ({ model: initModel }),
        update: (model, message) => (received.push(message), update(model, message)),
        view: (_model, h) => h.div([], []),
        subscriptions,
        ports,
        container,
      }),
    );

    handle.ports.replay.send(fixture[0]);

    await vi.waitFor(() => {
      expect(received).toContainEqual(Message.ReceivedReplayEvent({ event: fixture[0] }));
    });

    handle.dispose();
    container.remove();
  });

  it('replays valid inbound events and rejects malformed values at the boundary', async () => {
    const received: AppMessage[] = [];
    const telemetry: unknown[] = [];
    const container = document.createElement('div');
    container.id = 'stateflow-port-test';
    document.body.appendChild(container);
    const recordAndUpdate = (model: AppModel, message: AppMessage) => (
      received.push(message),
      update(model, message)
    );
    const handle = Runtime.embed(
      Runtime.makeElement({
        Model,
        init: () => ({ model: initModel }),
        update: recordAndUpdate,
        view: (_model, h) => h.div([], []),
        subscriptions,
        ports: {
          inbound: { replay: ReplayEventPort },
          outbound: { transitionTelemetry: TransitionTelemetryPort },
        },
        container,
      }),
    );
    const unsubscribe = handle.ports.transitionTelemetry.subscribe((record) =>
      telemetry.push(record),
    );

    handle.ports.replay.send(fixture[0]);

    await vi.waitFor(() => {
      expect(received).toContainEqual(Message.ReceivedReplayEvent({ event: fixture[0] }));
      expect(telemetry).toEqual([
        expect.objectContaining({ messageTag: 'LoadedMetrics', outcome: 'transitioned' }),
      ]);
    });

    // SAFETY: This test deliberately bypasses the host's static type to exercise Port decoding.
    const invalid = handle.ports.replay.send(null as never);
    expect(invalid._tag).toBe('Failure');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(received.filter(({ _tag }) => _tag === 'ReceivedReplayEvent')).toHaveLength(1);
    expect(telemetry).toHaveLength(1);

    unsubscribe();
    handle.dispose();
    container.remove();
  });
});
