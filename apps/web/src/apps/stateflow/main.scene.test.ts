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

describe('stateflow Port bridge', () => {
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
    expect(received).toHaveLength(2);
    expect(telemetry).toHaveLength(1);

    unsubscribe();
    handle.dispose();
    container.remove();
  });
});
