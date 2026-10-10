import { Effect, Match, Option, Result, Schema, Stream } from 'effect';
import { Dom, Subscription } from 'foldkit';
import type { Command } from 'foldkit';
import type { Return } from 'foldkit/update';
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

export function sourceLineSubscriptions<Model, Message>(toMessage: (line: SourceLine) => Message) {
  // The browser event stream is acquired lazily by the subscription runtime.
  // oxlint-disable-next-line linteffect/no-effect-wrapper-alias
  const locations = Stream.suspend(() =>
    Stream.concat(
      Stream.fromEffect(Effect.sync(() => window.location.hash)),
      Dom.streamFromEvent({
        target: window,
        type: 'hashchange',
        mapEvent: () => window.location.hash,
      }),
    ),
  ).pipe(
    Stream.flatMap((hash) =>
      Option.match(parseSourceLine(hash), {
        onNone: () => Stream.empty,
        onSome: Stream.make,
      }),
    ),
    Stream.map(toMessage),
  );
  return Subscription.make<Model, Message>()(() => ({
    sourceLine: Subscription.persistentEntry(locations),
  }));
}

export function focusSourceLine({ name, line }: SourceLine) {
  const selector = `[id="${CSS.escape(sourceLineId(name, line))}"]`;
  return Dom.scrollIntoViewAfterPaint(selector, { block: 'start' }).pipe(
    Effect.andThen(Dom.focus(selector, { preventScroll: true })),
    Effect.catch(() => Effect.void),
  );
}

export function navigateSourceLine<Model extends { readonly activeFile: string }, Message>(
  model: Model,
  location: SourceLine,
  names: ReadonlyArray<Model['activeFile']>,
  source: (model: Model) => string,
  focus: (line: SourceLine) => Command.Command<Message>,
  reveal: (next: Model) => Model = (next) => next,
): Return<Model, Message> {
  return Option.fromNullishOr(names.find((name) => name === location.name)).pipe(
    Option.map((name) => ({ ...model, activeFile: name })),
    Option.filter(
      (next) =>
        Number.isSafeInteger(location.line) &&
        location.line > 0 &&
        location.line <= source(next).split('\n').length,
    ),
    Option.match({
      onNone: () => ({ model }),
      onSome: (next) => ({ model: reveal(next), commands: [focus(location)] }),
    }),
  );
}
