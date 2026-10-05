import { lineGeometry } from '@opsydyn/foldkit-viz/chart/cartesian';
import { nearestByX } from '@opsydyn/foldkit-viz/interaction/inspection';

import type { ReadyModel, ChartRole } from './model';
export const deriveSignalChart = (model: ReadyModel, role: ChartRole) => {
  const domain = role === 'overview' ? model.bounds : model.viewport;
  const frame = {
    width: model.widths[role],
    height: role === 'overview' ? 140 : 260,
    margins: { top: 24, right: 20, bottom: 36, left: 56 },
  };
  const value = (d: ReadyModel['records'][number]) =>
    role === 'errors' ? d.errorPercent : d.latencyMs;
  const upper = Math.max(1, ...model.records.map(value)) * 1.1;
  const visible = model.records.filter((d) => d.time >= domain[0] && d.time <= domain[1]);
  const geometry = lineGeometry(
    visible,
    { datumKey: (d) => d.id, seriesKey: () => role, x: (d) => d.time, y: value },
    { frame, xDomain: domain, yDomain: [0, upper], xTickCount: 4, yTickCount: 4 },
  );
  const inspected = model.records.find((d) => d.id === model.inspection.key) ?? null;
  return { frame, geometry, visible, inspected };
};
export const visibleRecords = (model: ReadyModel) =>
  model.records.filter((d) => d.time >= model.viewport[0] && d.time <= model.viewport[1]);
export const nearestVisible = (model: ReadyModel, time: number) =>
  nearestByX(visibleRecords(model), { key: (d) => d.id, x: (d) => d.time }, time);
export const utc = (time: number) => new Date(time).toISOString();
export const inspectionNotice = (model: ReadyModel): string => {
  const record = model.records.find((d) => d.id === model.inspection.key);
  if (record)
    return `${model.inspection._tag === 'Pinned' ? 'Pinned' : 'Following'} ${record.id}${record.time < model.viewport[0] || record.time > model.viewport[1] ? ' — outside current view' : ''}`;
  return visibleRecords(model).length === 0
    ? 'No observation in current view. Zoom out to find a signal.'
    : 'Hover or focus a detail chart to inspect an observation.';
};
export const currentSignalSource = (
  model: ReadyModel,
): string => `// Controlled state; all timestamps are UTC milliseconds.
import { zoomDomain, panDomain } from '@opsydyn/foldkit-viz/interaction/viewport';
import { nearestByX } from '@opsydyn/foldkit-viz/interaction/inspection';
const bounds = ${JSON.stringify(model.bounds)};
const viewport = ${JSON.stringify(model.viewport)};
const selection = ${JSON.stringify(model.selection)};
const inspection = ${JSON.stringify(model.inspection)};
const minimumSpan = 1000;
// Use viewport to derive both charts; selection and inspection remain independent.
`;
