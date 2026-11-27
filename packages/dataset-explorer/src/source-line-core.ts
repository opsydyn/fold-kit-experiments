import { Match, Option, Result, Schema } from 'effect';
import type { Element, Root, Text } from 'hast';

export const SourceLine = Schema.Struct({ name: Schema.String, line: Schema.Number });
export type SourceLine = typeof SourceLine.Type;
export const sourceLineId = (name: string, line: number): string => `source-${name}-L${line}`;

export function parseSourceLine(hash: string): Option.Option<SourceLine> {
  return Option.fromNullishOr(/^#source-(.+)-L([1-9]\d*)$/.exec(hash)).pipe(
    Option.flatMap((match) =>
      Result.getSuccess(
        Result.try(() => ({
          name: decodeURIComponent(match[1] ?? ''),
          line: Number(match[2]),
        })),
      ),
    ),
    Option.filter(({ name, line }) => name.length > 0 && Number.isSafeInteger(line)),
  );
}

/** Split leaves while retaining every enclosing token span across newline boundaries. */
export function sourceLines(tree: Root): ReadonlyArray<Root> {
  // HAST traversal builds only local data; nested matches are exhaustive AST recursion.
  /* oxlint-disable linteffect/no-pipe-ladder, linteffect/no-render-side-effects */
  const lines: Root[] = [{ type: 'root', children: [] }];
  let current = lines[0];
  function visit(node: Root | Element | Text, parents: ReadonlyArray<Element>): void {
    return Match.value(node).pipe(
      Match.when({ type: 'text' }, ({ value }) => {
        value.split('\n').forEach((part, index) => {
          // Local AST construction keeps mutation confined to this pure transformation.
          // oxlint-disable-next-line linteffect/no-if-statement
          if (index > 0) {
            current = { type: 'root', children: [] };
            lines.push(current);
          }
          const leaf: Text = { type: 'text', value: part };
          const wrapped = parents.reduceRight<Element | Text>(
            (child, parent) => ({ ...parent, children: [child] }),
            leaf,
          );
          current?.children.push(wrapped);
        });
      }),
      Match.orElse((parent) => {
        const wrappers = Match.value(parent).pipe(
          Match.when({ type: 'element' }, (element) => [...parents, element]),
          Match.orElse(() => parents),
        );
        for (const child of parent.children) {
          Match.value(child).pipe(
            Match.when({ type: 'text' }, (text) => visit(text, wrappers)),
            Match.when({ type: 'element' }, (element) => visit(element, wrappers)),
            Match.orElse(() => {}),
          );
        }
      }),
    );
  }
  visit(tree, []);
  return lines;
  /* oxlint-enable linteffect/no-pipe-ladder, linteffect/no-render-side-effects */
}

export function linkedSourceTree(tree: Root, name: string): Root {
  function row(line: Root, index: number, lines: ReadonlyArray<Root>): Root['children'] {
    const number = index + 1;
    const id = sourceLineId(name, number);
    const row: Element = {
      type: 'element',
      tagName: 'span',
      properties: { className: ['source-line'], id, tabIndex: -1 },
      children: [
        {
          type: 'element',
          tagName: 'a',
          properties: {
            className: ['source-line-number'],
            href: '#' + encodeURIComponent(id),
            ariaLabel: `Link to ${name}, line ${number}`,
            dataLine: number,
          },
          children: [],
        },
        {
          type: 'element',
          tagName: 'span',
          properties: { className: ['source-line-text'] },
          // Only element/text leaves were retained by the HAST splitter.
          children: line.children.filter(
            // oxlint-disable-next-line linteffect/no-magic-domain-string
            (child): child is Element | Text => child.type === 'element' || child.type === 'text',
          ),
        },
      ],
    };
    return Match.value(index < lines.length - 1).pipe(
      Match.when(true, (): Root['children'] => [row, { type: 'text', value: '\n' }]),
      Match.orElse(() => [row]),
    );
  }
  const children = sourceLines(tree).flatMap(row);
  return { type: 'root', children };
}
