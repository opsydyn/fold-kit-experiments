export type Node = { readonly key: string; readonly color: number; readonly x: number };
export type Op =
  | { readonly _tag: 'Create'; readonly node: Node }
  | {
      readonly _tag: 'Update';
      readonly key: string;
      readonly color: number | undefined;
      readonly x: number | undefined;
    }
  | { readonly _tag: 'Remove'; readonly key: string };

export const makeNodes = (n: number, seed: number): ReadonlyArray<Node> =>
  Array.from({ length: n }, (_, i) => ({ key: `k${i}`, color: (i * 7 + seed) % 255, x: i }));
