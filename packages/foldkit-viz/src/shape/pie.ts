const tau = 2 * Math.PI;

export type PieArcDatum<T> = Readonly<{
  data: T;
  value: number;
  index: number;
  startAngle: number;
  endAngle: number;
  padAngle: number;
}>;

export type PieConfig<T> = Readonly<{
  value?: (d: T, i: number) => number;
  sort?: ((a: T, b: T) => number) | null;
  sortValues?: ((a: number, b: number) => number) | null;
  startAngle?: number;
  endAngle?: number;
  padAngle?: number;
}>;

const defaultSortValues = (a: number, b: number) => b - a;

export function pie<T>(
  data: ReadonlyArray<T>,
  config: PieConfig<T> = {},
): ReadonlyArray<PieArcDatum<T>> {
  const getValue = config.value ?? ((d) => d as unknown as number);
  const startAngle = config.startAngle ?? 0;
  const endAngle = config.endAngle ?? tau;
  const padAngle = config.padAngle ?? 0;

  const sortValues =
    'sortValues' in config ? config.sortValues : defaultSortValues;
  const sort = 'sort' in config ? config.sort : null;

  const n = data.length;
  const values = Array.from({ length: n }, (_, i) => getValue(data[i] as T, i));

  // build index array, then sort it
  const indices = Array.from({ length: n }, (_, i) => i);
  if (sort != null) {
    indices.sort((a, b) => sort(data[a] as T, data[b] as T));
  } else if (sortValues != null) {
    indices.sort((a, b) => sortValues(values[a] as number, values[b] as number));
  }

  const sum = values.reduce((acc, v) => acc + Math.max(0, v), 0);
  const da = Math.min(tau, Math.max(-tau, endAngle - startAngle));
  const effectivePad = Math.min(Math.abs(da) / n, padAngle);
  // angle available for arc bodies
  const k = sum > 0 ? (Math.abs(da) - effectivePad * n) / sum : 0;

  let a = startAngle;
  const arcs: PieArcDatum<T>[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const j = indices[i] as number;
    const v = Math.max(0, values[j] as number);
    const arcEnd = a + (v > 0 ? v * k + effectivePad : 0) * Math.sign(da);
    arcs[j] = {
      data: data[j] as T,
      value: v,
      index: i,
      startAngle: a,
      endAngle: arcEnd,
      padAngle: effectivePad,
    };
    a = arcEnd;
  }

  return arcs;
}
