import { describe, expect, it } from 'vitest';

import {
  isEnteringDiagnostics,
  parseDiagnosticsPath,
  toNavigationValue,
  type DiagnosticsRoute,
} from './navigation';

describe('request diagnostics navigation', () => {
  it('preserves nested repository and document path segments', () => {
    expect(parseDiagnosticsPath('/request-diagnostics/acme/platform/docs/intro.md')).toEqual({
      _tag: 'Document',
      repository: 'acme/platform',
      document: 'docs/intro.md',
    });
  });

  it('maps a navigation event to the port value', () => {
    expect(
      toNavigationValue({ phase: 'entered', path: '/request-diagnostics', previousPath: '/' }),
    ).toEqual({
      phase: 'entered',
      path: '/request-diagnostics',
      previousPath: '/',
    });
  });

  it('uses an index state for the base diagnostics route', () => {
    expect(parseDiagnosticsPath('/request-diagnostics')).toEqual({ _tag: 'Index' });
  });

  it('recognizes an entered document route without treating stayed navigation as entry', () => {
    const index: DiagnosticsRoute = { _tag: 'Index' };
    const document = {
      _tag: 'Document',
      repository: 'acme/platform',
      document: 'docs/intro.md',
    } satisfies DiagnosticsRoute;

    expect(isEnteringDiagnostics('entered', index, document)).toBe(true);
    expect(isEnteringDiagnostics('stayed', index, document)).toBe(false);
  });
});
