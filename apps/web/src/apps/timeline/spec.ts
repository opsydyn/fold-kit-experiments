import type { PlotSpec } from '@opsydyn/foldkit-viz/plot';

// A product launch plan for the first half of 2025.
const TASKS = [
  { task: 'Discovery', start: '2025-01-06', end: '2025-01-24', phase: 'Plan' },
  { task: 'Design', start: '2025-01-20', end: '2025-02-14', phase: 'Plan' },
  { task: 'Backend API', start: '2025-02-03', end: '2025-03-14', phase: 'Build' },
  { task: 'Frontend', start: '2025-02-17', end: '2025-03-28', phase: 'Build' },
  { task: 'Integration', start: '2025-03-24', end: '2025-04-11', phase: 'Build' },
  { task: 'QA & Testing', start: '2025-04-07', end: '2025-04-25', phase: 'Ship' },
  { task: 'Launch', start: '2025-04-21', end: '2025-05-02', phase: 'Ship' },
];

export const spec: PlotSpec = {
  width: 440,
  height: 300,
  title: 'Launch plan',
  description: 'Seven project tasks from January to May 2025, each from its start to its end date.',
  margins: { left: 92 },
  data: TASKS.map((t) => ({ ...t, label: `${t.task}: ${t.start} to ${t.end}` })),
  x: { label: '', ticks: 5 },
  y: { label: '', padding: 0.3 },
  color: { domain: ['Plan', 'Build', 'Ship'], range: ['#8b5cf6', '#6366f1', '#10b981'] },
  marks: [{ mark: 'bar', x: 'end', x0: 'start', y: 'task', fill: 'phase', title: 'label' }],
};
