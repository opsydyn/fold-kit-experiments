import { Component } from '@effect/ui';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { samplePoints } from '../request-diagnostics/model';
import { mountStateflow } from './host.test-helper';
import { Message } from './message';
import page from './page';
import { ReplayEvent, replayEventName, transitionTelemetryName } from './ports';

import { pulse } from './stateflow.css';

describe('Stateflow Effect UI host', () => {
  it('uses the native Effect UI Astro component', () => {
    expect(Component.isComponent(page)).toBe(true);
  });

  it('bridges initial and changed media values and releases both listeners', async () => {
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
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true, addEventListener, removeEventListener })),
    );
    const { host, root, dispose } = await mountStateflow();
    await vi.waitFor(() => expect(addEventListener).toHaveBeenCalledTimes(2));
    const graph = host.querySelector<SVGSVGElement>('svg[role="application"]');
    await vi.waitFor(() => expect(graph?.style.minWidth).toBe(''));
    root.send(Message.ClickedStep());
    await vi.waitFor(() => expect(host.textContent).toContain('Current state: Ready'));
    expect(graph?.querySelector(`.${pulse}`)).toBeNull();
    // SAFETY: The subscription only reads the synthetic event's matches field.
    const change = { matches: false } as MediaQueryListEvent;
    for (const listener of listeners) listener(change);
    await vi.waitFor(() => expect(graph?.style.minWidth).toMatch(/px$/));
    await vi.waitFor(() => expect(graph?.querySelector(`.${pulse}`)).not.toBeNull());
    await dispose();
    expect(removeEventListener).toHaveBeenCalledTimes(2);
    expect(listeners.size).toBe(0);
  });

  it('validates inbound events and emits the typed transition record', async () => {
    const { host } = await mountStateflow();
    const target = host.querySelector('stateflow-observatory');
    expect(target).not.toBeNull();
    const telemetry = vi.fn();
    const listener = new AbortController();
    window.addEventListener(transitionTelemetryName, telemetry, { signal: listener.signal });
    onTestFinished(() => listener.abort());
    target?.dispatchEvent(
      new CustomEvent(replayEventName, {
        detail: ReplayEvent.LoadedMetrics({ points: samplePoints }),
      }),
    );
    await vi.waitFor(() => expect(host.textContent).toContain('Current state: Ready'));
    await vi.waitFor(() => expect(telemetry).toHaveBeenCalledTimes(1));
    expect(telemetry.mock.calls[0]?.[0]?.detail).toMatchObject({
      messageTag: 'LoadedMetrics',
      outcome: 'transitioned',
      target: 'Ready',
    });
    target?.dispatchEvent(new CustomEvent(replayEventName, { detail: null }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(telemetry).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('Event 1 of 1');
  });
});
