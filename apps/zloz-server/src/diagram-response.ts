import { HttpServerResponse } from 'effect/http';

/**
 * Diagram routes finish their reads and construct finite JSON/export bodies.
 * Keep them native: fromWeb turns them into Effect streams whose EOF awaits
 * request finalizers. The Worker bridge owns that cleanup through waitUntil.
 * I/O-backed streams must keep their own scope and must not use this adapter.
 */
export const diagramHttpResponse = (response: Response) =>
  HttpServerResponse.raw(response, { status: response.status });
