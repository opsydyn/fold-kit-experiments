import { expect, it } from 'vitest';

import { renderChart } from '../../ui/shared/render-chart.test-helper';
import type { Message } from './message';
import { initModel, Session } from './model';
import type { Model } from './model';
import { body } from './view';

const wire = {
  services: [
    { id: 'api', name: 'API', series: 'Core' as const, volume: 1200, latency: 60 },
    { id: 'queue', name: 'Queue', series: 'Platform' as const, volume: 1700, latency: 90 },
  ],
} as const;

async function rendered(model: Model) {
  const node = document.createElement('div');
  node.innerHTML = await renderChart<Message>((h) => body(model, h));
  return node;
}

it('shows validated incident comparisons, fixed axes, budget and baseline outlines', async () => {
  const current = {
    services: [
      { ...wire.services[0], latency: 145 },
      wire.services[1],
      { id: 'events', name: 'Events', series: 'Platform' as const, volume: 2100, latency: 170 },
    ],
  };
  const model = {
    ...initModel,
    wire: current,
    baseline: wire,
    selectedId: 'api',
    accepted: 2,
    session: Session.Completed({ runId: 'run-1' }),
  };
  const node = await rendered(model);
  expect(node.querySelector('[data-testid="summary-headline"]')?.textContent).toContain('above');
  expect(node.querySelector('[data-testid="above-budget-count"]')?.textContent).toBe('2');
  expect(node.querySelector('[data-testid="current-latency"]')?.textContent).toContain('145');
  expect(node.querySelector('[data-testid="baseline-latency"]')?.textContent).toContain('60');
  expect(node.querySelector('[aria-label="Selected service"]')?.textContent).toContain('+85ms');
  expect(node.querySelector('tr[data-service-id="events"]')?.textContent).toContain('New');
  expect(node.querySelector('svg [data-budget="true"]')).not.toBeNull();
  expect(node.querySelector('svg [data-baseline="true"]')).not.toBeNull();
  expect(node.querySelector('svg [data-latency="145"]')).not.toBeNull();
  expect(node.querySelector('svg')?.textContent).toContain('2400');
  expect(node.querySelector('svg')?.textContent).toContain('200');
  const filtered = await rendered({ ...model, filter: 'Core' });
  expect(filtered.querySelector('svg [data-latency="145"]')?.innerHTML).toBe(
    node.querySelector('svg [data-latency="145"]')?.innerHTML,
  );
  const compact = await rendered({ ...model, isCompact: true });
  expect(compact.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 390 330');
});

it('does not invent a baseline for new services or a default selection', async () => {
  const newService = {
    id: 'new',
    name: 'New worker',
    series: 'Core' as const,
    volume: 100,
    latency: 90,
  };
  const node = await rendered({
    ...initModel,
    wire: { services: [newService] },
    baseline: wire,
    selectedId: 'new',
  });
  expect(node.querySelector('[data-testid="baseline-latency"]')?.textContent).toBe('New');
  expect(node.querySelector('[aria-label="Selected service"]')?.textContent).toContain(
    'Within demo budget',
  );
  expect(node.querySelector('[aria-label="Selected service"] dd')?.getAttribute('aria-label')).toBe(
    '100 requests/minute',
  );
  const empty = await rendered({ ...initModel, wire, baseline: wire });
  expect(empty.querySelector('[aria-label="Selected service"]')?.textContent).toContain(
    'No service selected',
  );
  expect(empty.querySelector('[data-testid="current-latency"]')).toBeNull();
});

it('renders rejection evidence as bounded text, never current chart or inspector values', async () => {
  const current = { services: [{ ...wire.services[0], latency: 145 }] };
  const node = await rendered({
    ...initModel,
    wire: current,
    baseline: wire,
    selectedId: 'api',
    session: Session.Failed({
      runId: 'run-1',
      failure: { _tag: 'Protocol', reason: 'Invalid patch' },
    }),
    rejection: {
      kind: 'Delta',
      runId: 'run-1',
      detail: '<script>999</script> remove /services/99',
    },
  });
  expect(node.querySelector('[data-testid="rejected-update"]')?.textContent).toContain('999');
  expect(node.querySelector('[data-testid="rejected-update"] script')).toBeNull();
  expect(node.querySelector('svg [data-latency="999"]')).toBeNull();
  expect(node.querySelector('[data-testid="current-latency"]')?.textContent).toContain('145');
  expect(node.querySelector('#agent-recover')?.textContent).toBe('Restart analysis');
  expect(node.querySelector('details')?.hasAttribute('open')).toBe(false);
});

it('starts empty with accessible scenario, status and disabled invalid actions', async () => {
  const node = await rendered(initModel);
  expect(node.textContent).toContain('Synthetic service measurements');
  expect(node.textContent).toContain('No service measurements');
  expect(node.querySelectorAll('tbody tr')).toHaveLength(0);
  expect(node.querySelectorAll('select option')).toHaveLength(3);
  expect(node.querySelector('label[for="agent-scenario"]')?.textContent).toBe('Scenario');
  expect(node.querySelector('[data-testid="status"]')?.getAttribute('aria-live')).toBe('polite');
  expect(node.querySelector('[data-testid="status"]')?.textContent).toBe('Idle');
  expect(node.querySelector('#agent-run')?.hasAttribute('disabled')).toBe(false);
  expect(node.querySelector('#agent-recover')?.hasAttribute('disabled')).toBe(true);
  expect(node.querySelector('#agent-cancel')?.hasAttribute('disabled')).toBe(true);
});

it.each([
  Session.Connecting({ request: { runId: 'run-1', scenario: 'normal' } }),
  Session.AwaitingSnapshot({ request: { runId: 'run-1', scenario: 'normal' } }),
  Session.Streaming({ request: { runId: 'run-1', scenario: 'normal' } }),
])('allows only cancellation during $ _tag', async (session) => {
  const node = await rendered({ ...initModel, session, wire });
  expect(node.querySelector('#agent-run')?.hasAttribute('disabled')).toBe(true);
  expect(node.querySelector('#agent-recover')?.hasAttribute('disabled')).toBe(true);
  expect(node.querySelector('#agent-cancel')?.hasAttribute('disabled')).toBe(false);
  expect(node.querySelectorAll('tbody tr')).toHaveLength(2);
});

it.each([
  Session.Failed({ runId: 'run-1', failure: { _tag: 'Protocol', reason: 'Invalid patch' } }),
  Session.Cancelled({ runId: 'run-1', cause: 'User' }),
  Session.Completed({ runId: 'run-1' }),
])('retains valid rows and derives recovery availability in $ _tag', async (session) => {
  const node = await rendered({ ...initModel, wire, session });
  expect(node.querySelectorAll('tbody tr')).toHaveLength(2);
  expect(node.querySelector('#agent-recover')?.hasAttribute('disabled')).toBe(
    session._tag !== 'Failed',
  );
  expect(node.querySelector('#agent-run')?.hasAttribute('disabled')).toBe(false);
  expect(node.querySelector('#agent-cancel')?.hasAttribute('disabled')).toBe(true);
});

it('uses stable IDs, pressed filter/table semantics, raw units and non-colour chart selection', async () => {
  const node = await rendered({ ...initModel, wire, selectedId: 'api', accepted: 4 });
  expect(node.querySelector('[data-filter="All"]')?.getAttribute('aria-pressed')).toBe('true');
  expect(node.querySelector('button[data-service-id="api"]')?.getAttribute('aria-pressed')).toBe(
    'true',
  );
  expect(node.querySelector('button[data-service-id="queue"]')?.getAttribute('aria-pressed')).toBe(
    'false',
  );
  expect(node.querySelector('[data-testid="accepted"]')?.textContent).toBe('4');
  expect(node.querySelector('table abbr[title="requests/minute"]')?.textContent).toBe('Req/min');
  expect(node.querySelector('table abbr[title="p95 milliseconds"]')?.textContent).toBe('p95');
  expect(node.querySelector('tr[data-service-id="api"]')?.textContent).toContain('1200');
  expect(node.querySelector('tr[data-service-id="api"]')?.textContent).toContain('60');
  expect(node.querySelector('svg [data-selected="true"]')?.getAttribute('stroke-dasharray')).toBe(
    '3 2',
  );
  const filtered = await rendered({ ...initModel, wire, filter: 'Core' });
  expect(filtered.querySelectorAll('tbody tr')).toHaveLength(1);
  expect(filtered.querySelector('[data-filter="Core"]')?.getAttribute('aria-pressed')).toBe('true');
});

it('discloses no more than twelve activity entries', async () => {
  const node = await rendered({
    ...initModel,
    activity: Array.from({ length: 14 }, (_, i) => `Event ${i}`),
  });
  expect(node.querySelector('details summary')?.textContent).toBe('Protocol details');
  expect(node.querySelectorAll('[aria-label="Run evidence"] li')).toHaveLength(12);
  expect(node.querySelector('[aria-label="Run evidence"] li')?.textContent).toBe('Event 2');
});
