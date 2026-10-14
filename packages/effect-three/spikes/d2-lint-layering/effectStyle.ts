// Effect style: written to satisfy the import-gated rules (no if/ternary/return-in-callback).
import { Arr, HashMap, HashSet, Option, pipe } from './effectImports.ts';
import type { Node, Op } from './model.ts';

const changed = (a: number, b: number): Option.Option<number> =>
  Option.filter(Option.some(b), (v) => v !== a);

const updateOp = (p: Node, n: Node): Option.Option<Op> =>
  pipe(
    { color: changed(p.color, n.color), x: changed(p.x, n.x) },
    (c) => Option.filter(Option.some(c), (v) => Option.isSome(v.color) || Option.isSome(v.x)),
    Option.map(
      (c): Op => ({
        _tag: 'Update',
        key: n.key,
        color: Option.getOrUndefined(c.color),
        x: Option.getOrUndefined(c.x),
      }),
    ),
  );

const opFor = (prevByKey: HashMap.HashMap<string, Node>, n: Node): Option.Option<Op> =>
  Option.match(HashMap.get(prevByKey, n.key), {
    onNone: () => Option.some<Op>({ _tag: 'Create', node: n }),
    onSome: (p) => updateOp(p, n),
  });

export const diffEffect = (prev: ReadonlyArray<Node>, next: ReadonlyArray<Node>): Array<Op> =>
  pipe(HashMap.fromIterable(Arr.map(prev, (p) => [p.key, p] as const)), (prevByKey) =>
    Arr.appendAll(
      Arr.getSomes(Arr.map(next, (n) => opFor(prevByKey, n))),
      pipe(HashSet.fromIterable(Arr.map(next, (n) => n.key)), (seen) =>
        Arr.getSomes(
          Arr.map(prev, (p) =>
            Option.map(
              Option.liftPredicate((k: string) => !HashSet.has(seen, k))(p.key),
              (key): Op => ({ _tag: 'Remove', key }),
            ),
          ),
        ),
      ),
    ),
  );
