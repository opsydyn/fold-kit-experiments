import type { CartesianLayout } from '@opsydyn/foldkit-viz/chart/cartesian';

import { EventFeed, EventInspection, type SignalEvent } from './events';
import type { ReadyModel, ChartRole } from './model';

export const EVENT_CELL_SIZE = 12;
export type EventGroup = Readonly<{ key: string; x: number; members: ReadonlyArray<SignalEvent> }>;
export type EventPosition = 'InView' | 'OutsideView' | 'OutsideBounds';
export type EventGuide = Readonly<{ x: number; top: number; bottom: number }>;
export function selectedEvent(model: ReadyModel): SignalEvent | null {
  return EventFeed.match(model.events, {
    NotSupplied: () => null,
    Invalid: () => null,
    Ready: (feed) =>
      EventInspection.match(feed.inspection, {
        None: () => null,
        Selected: ({ key }) => feed.records.find((event) => event.id === key) ?? null,
      }),
  });
}
export function eventPosition(model: ReadyModel, event: SignalEvent): EventPosition {
  if (event.time < model.bounds[0] || event.time > model.bounds[1]) return 'OutsideBounds';
  if (event.time < model.viewport[0] || event.time > model.viewport[1]) return 'OutsideView';
  return 'InView';
}
/** Same finite-output contract as Viz's internal layout guard; no scale/math policy is added. */
const projectedX = (layout: CartesianLayout, time: number): number => {
  const x = layout.x(time);
  if (!Number.isFinite(x)) throw new RangeError('Event coordinate must be finite.');
  return x;
};
export function visibleEventGroups(
  model: ReadyModel,
  layout: CartesianLayout,
): ReadonlyArray<EventGroup> {
  return EventFeed.match(model.events, {
    NotSupplied: () => [],
    Invalid: () => [],
    Ready: ({ records }) => {
      const cells = new Map<number, { x: number; members: SignalEvent[] }>();
      for (const event of records) {
        if (event.time < model.viewport[0] || event.time > model.viewport[1]) continue;
        const x = projectedX(layout, event.time);
        const cell = Math.floor((x - layout.plot.left) / EVENT_CELL_SIZE);
        const group = cells.get(cell);
        if (group) group.members.push(event);
        else cells.set(cell, { x, members: [event] });
      }
      return Array.from(cells.values(), (group) => ({
        ...group,
        key: JSON.stringify(group.members.map((event) => event.id)),
      }));
    },
  });
}
export function selectedEventGuide(
  model: ReadyModel,
  role: ChartRole,
  layout: CartesianLayout,
): EventGuide | null {
  const event = selectedEvent(model);
  if (event === null || (role === 'overview' && eventPosition(model, event) === 'OutsideBounds'))
    return null;
  return { x: projectedX(layout, event.time), top: layout.plot.top, bottom: layout.plot.bottom };
}
