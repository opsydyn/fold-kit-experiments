import type { APIRoute } from 'astro';

const points = [
  { x: 22, y: 0.1, label: '' },
  { x: 45, y: 0.5, label: '' },
  { x: 75, y: 0.9, label: '' },
  { x: 105, y: 1.4, label: '' },
  { x: 135, y: 2, label: '' },
  { x: 175, y: 2.9, label: '' },
  { x: 217, y: 3.8, label: '' },
  { x: 260, y: 4.7, label: '' },
  { x: 306, y: 5.6, label: '' },
  { x: 350, y: 5.8, label: '' },
  { x: 403, y: 6.9, label: '' },
  { x: 457, y: 8.4, label: '' },
  { x: 520, y: 9.7, label: '' },
  { x: 592, y: 10.3, label: '' },
  { x: 655, y: 13, label: '' },
];

export const GET: APIRoute = () =>
  new Response(JSON.stringify(points), {
    headers: { 'Content-Type': 'application/json' },
  });
