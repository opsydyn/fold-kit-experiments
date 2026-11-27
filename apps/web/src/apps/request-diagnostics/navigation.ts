import { UiSchema } from '@effect/ui';
import { Result, Schema } from 'effect';

export const NavigationValue = Schema.Struct({
  phase: Schema.Literals(['coldLoad', 'entered', 'exited', 'stayed']),
  path: Schema.String,
  previousPath: Schema.NullOr(Schema.String),
});
export type NavigationValue = typeof NavigationValue.Type;

export const DiagnosticsRoute = UiSchema.TaggedEnum({
  Index: {},
  Document: { repository: Schema.String, document: Schema.String },
});
export type DiagnosticsRoute = typeof DiagnosticsRoute.Type;

export const isDiagnosticsPath = (path: string): boolean =>
  /^\/request-diagnostics(\/|$)/.test(path);

export function parseDiagnosticsPath(pathname: string): DiagnosticsRoute {
  const path = new URL(pathname, 'https://diagnostics.invalid').pathname;
  if (!isDiagnosticsPath(path)) return DiagnosticsRoute.Index();
  const segments = path.split('/').slice(2).filter(Boolean);
  const decoded = Result.try(() => segments.map(decodeURIComponent));
  if (decoded._tag === 'Failure') return DiagnosticsRoute.Index();
  const parts = decoded.success;
  const docs = parts.indexOf('docs');
  return docs > 0 && docs < parts.length - 1
    ? DiagnosticsRoute.Document({
        repository: parts.slice(0, docs).join('/'),
        document: parts.slice(docs).join('/'),
      })
    : DiagnosticsRoute.Index();
}

export const isEnteringDiagnostics = (
  phase: NavigationValue['phase'],
  previousRoute: DiagnosticsRoute,
  nextRoute: DiagnosticsRoute,
): boolean =>
  nextRoute._tag === 'Document' &&
  (phase === 'coldLoad' || (phase === 'entered' && previousRoute._tag !== 'Document'));
