import { Schema } from 'effect';

const Destination = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(
      /^\/(?:app(?:\/[A-Za-z0-9_-]{1,128}(?:\/diagrams\/[A-Za-z0-9_-]{1,128}(?:\/recovery)?|\/questmancer(?:\/(?:table|preview))?)?)?|join\/[A-Za-z0-9_-]{1,128})$/,
    ),
  ),
);

export const continuation = (path: string | null) => (Schema.is(Destination)(path) ? path : '/app');
export const loginPath = (path: string) =>
  `/login?returnTo=${encodeURIComponent(continuation(path))}`;
