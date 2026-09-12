import { Schema, pipe } from 'effect';
import { inbound } from 'foldkit/port';
import {
  Transition,
  defineRouteUnion,
  literal,
  mapTo,
  oneOf,
  parseUrlWithFallback,
  rest,
  slash,
} from 'foldkit/route';
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
export const NavigationPort = inbound(NavigationValue);

export const ParsedRoute = defineRouteUnion({
  Index: {},
  NotFound: { path: Schema.String },
  Path: { path: Schema.NonEmptyArray(Schema.String) },
});
export type ParsedRoute = typeof ParsedRoute.Type;

export const DiagnosticsRoute = defineRouteUnion({
  Index: {},
  Document: { repository: Schema.String, document: Schema.String },
});
export type DiagnosticsRoute = typeof DiagnosticsRoute.Type;

const indexRouter = pipe(literal('request-diagnostics'), mapTo(ParsedRoute.Index));
const pathRouter = pipe(
  literal('request-diagnostics'),
  slash(rest('path')),
  mapTo(ParsedRoute.Path),
);
const diagnosticsRouter = oneOf(pathRouter, indexRouter);

const normalizePath = (path: ReadonlyArray<string>): DiagnosticsRoute => {
  const documentsIndex = path.indexOf('docs');
  if (documentsIndex > 0 && documentsIndex < path.length - 1) {
    return DiagnosticsRoute.Document({
      repository: path.slice(0, documentsIndex).join('/'),
      document: path.slice(documentsIndex).join('/'),
    });
  }
  return DiagnosticsRoute.Index();
};

export const parseDiagnosticsPath = (pathname: string): DiagnosticsRoute => {
  const url = fromString(new URL(pathname, 'https://foldkit.invalid').href);
  if (url._tag === 'None') return DiagnosticsRoute.Index();
  const route = parseUrlWithFallback(diagnosticsRouter, ParsedRoute.NotFound)(url.value);
  if (route._tag === 'NotFound') return DiagnosticsRoute.Index();
  return route._tag === 'Path' ? normalizePath(route.path) : route;
};

export const toNavigationValue = (event: {
  readonly phase: 'coldLoad' | 'entered' | 'exited' | 'stayed';
  readonly path: string;
  readonly previousPath: string | null;
}): NavigationValue => event;

export const isEnteringDiagnostics = (
  phase: NavigationValue['phase'],
  previousRoute: DiagnosticsRoute,
  nextRoute: DiagnosticsRoute,
): boolean =>
  phase === 'coldLoad'
    ? Transition.isEntering(Transition.coldLoad(nextRoute), 'Document')
    : phase === 'entered'
      ? Transition.isEntering(Transition.make(previousRoute, nextRoute), 'Document')
      : false;
