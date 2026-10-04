export type Point = Readonly<{ id: string; group: 'a' | 'b'; x: number; y: number }>;

// Fixed illustrative samples make the effect of filtering and scaling easy to compare.
export const points: ReadonlyArray<Point> = [
  { id: 'a-01', group: 'a', x: 0, y: 0 },
  { id: 'a-02', group: 'a', x: 8, y: 15 },
  { id: 'a-03', group: 'a', x: 16, y: 12 },
  { id: 'a-04', group: 'a', x: 25, y: 32 },
  { id: 'a-05', group: 'a', x: 32, y: 28 },
  { id: 'a-06', group: 'a', x: 42, y: 50 },
  { id: 'a-07', group: 'a', x: 50, y: 42 },
  { id: 'a-08', group: 'a', x: 60, y: 65 },
  { id: 'a-09', group: 'a', x: 68, y: 58 },
  { id: 'a-10', group: 'a', x: 78, y: 78 },
  { id: 'a-11', group: 'a', x: 88, y: 85 },
  { id: 'a-12', group: 'a', x: 100, y: 100 },
  { id: 'b-01', group: 'b', x: 5, y: 92 },
  { id: 'b-02', group: 'b', x: 12, y: 80 },
  { id: 'b-03', group: 'b', x: 20, y: 86 },
  { id: 'b-04', group: 'b', x: 28, y: 68 },
  { id: 'b-05', group: 'b', x: 36, y: 72 },
  { id: 'b-06', group: 'b', x: 44, y: 58 },
  { id: 'b-07', group: 'b', x: 52, y: 50 },
  { id: 'b-08', group: 'b', x: 60, y: 48 },
  { id: 'b-09', group: 'b', x: 68, y: 32 },
  { id: 'b-10', group: 'b', x: 76, y: 28 },
  { id: 'b-11', group: 'b', x: 84, y: 18 },
  { id: 'b-12', group: 'b', x: 95, y: 8 },
];
