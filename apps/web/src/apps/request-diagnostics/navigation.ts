import { Schema, pipe } from 'effect';
import { literal, mapTo, oneOf, parseUrlWithFallback, r, rest, slash } from 'foldkit/route';
import { fromString } from 'foldkit/url';

export const NavigationValue = Schema.Struct({
  phase: Schema.Union([
    Schema.Literal('coldLoad'),
    Schema.Literal('entered'),
    Schema.Literal('exited'),
    Schema.Literal('stayed'),
  ]),
  path: Schema.String,
  previousPath: Schema.NullOr(Schema.String),
});
export type NavigationValue = typeof NavigationValue.Type;

export const IndexRoute = r('Index');
const NotFoundRoute = r('NotFound', { path: Schema.String });
const PathRoute = r('Path', { path: Schema.NonEmptyArray(Schema.String) });

const indexRouter = pipe(literal('request-diagnostics'), mapTo(IndexRoute));
const pathRouter = pipe(literal('request-diagnostics'), slash(rest('path')), mapTo(PathRoute));
const diagnosticsRouter = oneOf(pathRouter, indexRouter);

export type DiagnosticsRoute =
  | typeof IndexRoute.Type
  | { readonly _tag: 'Document'; readonly repository: string; readonly document: string };

const normalizePath = (path: ReadonlyArray<string>): DiagnosticsRoute => {
  const documentsIndex = path.indexOf('docs');
  if (documentsIndex > 0 && documentsIndex < path.length - 1) {
    return {
      _tag: 'Document',
      repository: path.slice(0, documentsIndex).join('/'),
      document: path.slice(documentsIndex).join('/'),
    };
  }
  return { _tag: 'Index' };
};

export const parseDiagnosticsPath = (pathname: string): DiagnosticsRoute => {
  const url = fromString(new URL(pathname, 'https://foldkit.invalid').href);
  if (url._tag === 'None') return { _tag: 'Index' };
  const route = parseUrlWithFallback(diagnosticsRouter, NotFoundRoute)(url.value);
  if (route._tag === 'NotFound') return { _tag: 'Index' };
  return route._tag === 'Path' ? normalizePath(route.path) : route;
};

export const toNavigationValue = (event: {
  readonly phase: 'coldLoad' | 'entered' | 'exited' | 'stayed';
  readonly path: string;
  readonly previousPath: string | null;
}): NavigationValue => event;
