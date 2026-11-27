import { describe, expect, it } from 'vitest';

import { isEnteringDiagnostics, parseDiagnosticsPath, type DiagnosticsRoute } from './navigation';

describe('request diagnostics navigation', () => {
  it('preserves nested repository and document path segments', () => {
    expect(parseDiagnosticsPath('/request-diagnostics/acme/platform/docs/intro.md')).toEqual({
      _tag: 'Document',
      repository: 'acme/platform',
      document: 'docs/intro.md',
    });
  });

  it('decodes URL segments and treats malformed escapes as the index', () => {
    expect(parseDiagnosticsPath('/request-diagnostics/acme%20team/docs/hello%20world.md')).toEqual({
      _tag: 'Document',
      repository: 'acme team',
      document: 'docs/hello world.md',
    });
    expect(parseDiagnosticsPath('/request-diagnostics/%E0/docs/intro.md')).toEqual({
      _tag: 'Index',
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
