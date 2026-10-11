import { intervalSelection, SELECTION_NONE } from '@opsydyn/foldkit-viz/interaction/selection';
import { constrainDomain, panDomain, zoomDomain } from '@opsydyn/foldkit-viz/interaction/viewport';
import type { Return } from 'foldkit/update';

import { Baseline, captureBaseline } from './baseline';
import { FocusEventBrowser } from './command';
import { deriveSignalChart, nearestVisible, visibleRecords } from './derive';
import { EventFeed, EventInspection } from './events';
import { Message } from './message';
import { Model, Gesture, Inspection, init } from './model';
import type { ReadyModel, ChartRole } from './model';
import type { Props } from './quality';
const cancel = (m: ReadyModel): ReadyModel =>
  Gesture.match(m.gesture, {
    Idle: () => m,
    Brushing: (g) => ({
      ...m,
      viewport: g.startViewport,
      selection: g.startSelection,
      gesture: Gesture.Idle(),
    }),
    Panning: (g) => ({
      ...m,
      viewport: g.startViewport,
      selection: g.startSelection,
      gesture: Gesture.Idle(),
    }),
  });
const settleInspection = (m: ReadyModel): ReadyModel =>
  Inspection.match(m.inspection, {
    Pinned: () => m,
    Following: ({ key }) => ({
      ...m,
      inspection: Inspection.Following({
        key: visibleRecords(m).some((d) => d.id === key) ? key : null,
      }),
    }),
  });
const timeAt = (
  m: ReadyModel,
  role: ChartRole,
  x: number,
  domain?: readonly [number, number],
): number => {
  const { geometry } = deriveSignalChart(m, role);
  const { plot, xDomain } = geometry.layout;
  const d = domain ?? xDomain;
  return d[0] + Math.max(0, Math.min(1, (x - plot.left) / plot.width)) * (d[1] - d[0]);
};
const inspect = (m: ReadyModel, time: number): ReadyModel =>
  Inspection.match(m.inspection, {
    Pinned: () => m,
    Following: () => ({
      ...m,
      inspection: Inspection.Following({ key: nearestVisible(m, time)?.id ?? null }),
    }),
  });
type Pointer = Readonly<{ role: ChartRole; pointerId: number; x: number; y: number }>;
const validPointer = (p: Pointer) => [p.x, p.y, p.pointerId].every(Number.isFinite);
const move = (m: ReadyModel, p: Pointer): ReadyModel => {
  if (!validPointer(p)) return m;
  return Gesture.match(m.gesture, {
    Idle: () => inspect(m, timeAt(m, p.role, p.x)),
    Brushing: (g) =>
      g.pointerId === p.pointerId && g.role === p.role
        ? { ...m, gesture: { ...g, currentTime: timeAt(m, p.role, p.x) } }
        : m,
    Panning: (g) => {
      if (g.pointerId !== p.pointerId || g.role !== p.role) return m;
      const currentTime = timeAt(m, p.role, p.x, g.startViewport);
      return {
        ...m,
        viewport: panDomain(g.startViewport, g.anchorTime - currentTime, m.bounds, 1000),
        gesture: { ...g, currentTime },
      };
    },
  });
};
const range = (m: ReadyModel, index: number, end: boolean): ReadyModel => {
  if (!Number.isInteger(index) || index < 0 || index >= m.records.length || m.records.length < 2)
    return m;
  const base = cancel(m);
  const selected = base.selection._tag === 'Interval' ? base.selection.domain : base.bounds;
  let lo = Math.max(
    0,
    base.records.findIndex((d) => d.time >= selected[0]),
  );
  let hi = base.records.findLastIndex((d) => d.time <= selected[1]);
  if (hi < 0) hi = base.records.length - 1;
  if (end) hi = Math.max(lo + 1, index);
  else lo = Math.min(hi - 1, index);
  const first = base.records[lo],
    last = base.records[hi];
  if (!first || !last || first.time === last.time) return base;
  return settleInspection({
    ...base,
    selection: intervalSelection('x', [first.time, last.time]),
    viewport: constrainDomain([first.time, last.time], base.bounds, 1000),
  });
};
const zoom = (m: ReadyModel, factor: number): ReadyModel => {
  const base = cancel(m);
  const record = visibleRecords(base).find((d) => d.id === base.inspection.key);
  return settleInspection({
    ...base,
    viewport: zoomDomain(
      base.viewport,
      factor,
      record?.time ?? base.viewport[0] + (base.viewport[1] - base.viewport[0]) / 2,
      base.bounds,
      1000,
    ),
  });
};
const readyUpdate = (m: ReadyModel, message: Message): ReadyModel =>
  Message.match(message, {
    CompletedEventBrowserFocus: () => m,
    ClickedEvent: ({ key }) =>
      EventFeed.match(m.events, {
        NotSupplied: () => m,
        Invalid: () => m,
        Ready: (feed) => {
          const event = feed.records.find((record) => record.id === key);
          return event === undefined
            ? m
            : {
                ...cancel(m),
                events: { ...feed, inspection: EventInspection.Selected({ key: event.id }) },
              };
        },
      }),
    ClickedClearEvent: () =>
      EventFeed.match(m.events, {
        NotSupplied: () => m,
        Invalid: () => m,
        Ready: (feed) =>
          EventInspection.match(feed.inspection, {
            None: () => m,
            Selected: () => ({
              ...cancel(m),
              events: { ...feed, inspection: EventInspection.None() },
            }),
          }),
      }),
    ClickedCentreEvent: () =>
      EventFeed.match(m.events, {
        NotSupplied: () => m,
        Invalid: () => m,
        Ready: (feed) =>
          EventInspection.match(feed.inspection, {
            None: () => m,
            Selected: ({ key }) => {
              const event = feed.records.find((record) => record.id === key);
              if (event === undefined || event.time < m.bounds[0] || event.time > m.bounds[1])
                return m;
              const base = cancel(m);
              const midpoint = base.viewport[0] + (base.viewport[1] - base.viewport[0]) / 2;
              return settleInspection({
                ...base,
                viewport: panDomain(base.viewport, event.time - midpoint, base.bounds, 1000),
              });
            },
          }),
      }),
    ClickedCaptureBaseline: () => {
      const record = m.records.find((d) => d.id === m.inspection.key);
      return record === undefined
        ? m
        : { ...cancel(m), baseline: captureBaseline(record, m.snapshot) };
    },
    ClickedClearBaseline: () => ({ ...cancel(m), baseline: Baseline.None() }),
    ClickedFreshnessScenario: ({ scenario }) => ({
      ...m,
      snapshot: { ...m.snapshot, asOf: m.scenarioAsOf[scenario] },
    }),
    ChangedSignalDataset: () => m,
    RecordedChartWidth: ({ role, width }) => {
      if (!Number.isFinite(width) || width <= 76)
        return { ...cancel(m), inputStatus: { ...m.inputStatus, [role]: 'Unavailable' } };
      if (width === m.widths[role]) return m;
      return { ...cancel(m), widths: { ...m.widths, [role]: width } };
    },
    RecordedInputAvailability: ({ role, status }) => ({
      ...(status === 'Unavailable' ? cancel(m) : m),
      inputStatus: { ...m.inputStatus, [role]: status },
    }),
    RecordedPointerPosition: (p) => (m.gesture._tag === 'Idle' ? move(m, p) : m),
    StartedChartPointer: (p) => {
      if (!validPointer(p)) return m;
      if (m.gesture._tag !== 'Idle') return m.gesture.pointerId !== p.pointerId ? cancel(m) : m;
      const time = timeAt(m, p.role, p.x);
      const active = {
        pointerId: p.pointerId,
        role: p.role,
        anchorX: p.x,
        anchorTime: time,
        currentTime: time,
        startViewport: m.viewport,
        startSelection: m.selection,
      };
      return {
        ...m,
        gesture: p.role === 'overview' ? Gesture.Brushing(active) : Gesture.Panning(active),
      };
    },
    MovedChartPointer: (p) => move(m, p),
    EndedChartPointer: (p) => {
      if (
        !validPointer(p) ||
        m.gesture._tag === 'Idle' ||
        m.gesture.pointerId !== p.pointerId ||
        m.gesture.role !== p.role
      )
        return m;
      const g = m.gesture;
      const moved = move(m, p);
      if (g._tag === 'Brushing' && Math.abs(p.x - g.anchorX) >= 4) {
        const time = timeAt(m, p.role, p.x);
        const selection = intervalSelection('x', [g.anchorTime, time]);
        if (selection._tag === 'Interval')
          return settleInspection({
            ...m,
            selection,
            viewport: constrainDomain(selection.domain, m.bounds, 1000),
            gesture: Gesture.Idle(),
          });
      }
      return settleInspection(
        inspect({ ...moved, gesture: Gesture.Idle() }, timeAt(moved, p.role, p.x)),
      );
    },
    CancelledChartPointer: ({ role, pointerId }) =>
      m.gesture._tag !== 'Idle' && m.gesture.role === role && m.gesture.pointerId === pointerId
        ? cancel(m)
        : m,
    ChangedRangeStart: ({ index }) => range(m, index, false),
    ChangedRangeEnd: ({ index }) => range(m, index, true),
    ClickedZoomIn: () => zoom(m, 0.5),
    ClickedZoomOut: () => zoom(m, 2),
    ClickedResetView: () => settleInspection({ ...cancel(m), viewport: m.bounds }),
    ClickedClearSelection: () => ({ ...cancel(m), selection: SELECTION_NONE }),
    ClickedPinInspection: () =>
      m.inspection.key === null
        ? m
        : { ...cancel(m), inspection: Inspection.Pinned({ key: m.inspection.key }) },
    ClickedResumeInspection: () =>
      settleInspection({
        ...cancel(m),
        inspection: Inspection.Following({ key: m.inspection.key }),
      }),
    PressedInspectionKey: ({ key }) => {
      if (key === 'Escape') return cancel(m);
      const base = cancel(m);
      const records = visibleRecords(base);
      if (records.length === 0) return base;
      const index = records.findIndex((d) => d.id === base.inspection.key);
      const next =
        key === 'Home'
          ? 0
          : key === 'End'
            ? records.length - 1
            : key === 'ArrowLeft'
              ? Math.max(0, index - 1)
              : Math.min(records.length - 1, index + 1);
      const record = records[next];
      if (!record) return base;
      return {
        ...base,
        inspection: Inspection.match(base.inspection, {
          Pinned: () => Inspection.Pinned({ key: record.id }),
          Following: () => Inspection.Following({ key: record.id }),
        }),
      };
    },
  });
export const update = (model: Model, message: Message): Return<Model, Message> => {
  if (message._tag === 'ChangedSignalDataset') {
    // SAFETY: init schema-decodes and validates the payload before accessing any fields.
    const props = message.props as Props;
    return init(props);
  }
  const next = Model.match(model, {
    Empty: () => model,
    Invalid: () => model,
    Ready: (m) => readyUpdate(m, message),
  });
  if (message._tag === 'ClickedClearEvent' && next !== model)
    return { model: next, commands: [FocusEventBrowser()] };
  return { model: next };
};
