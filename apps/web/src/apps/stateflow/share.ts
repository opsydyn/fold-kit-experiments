/**
 * A recording as a link: the specimen, its encoded events and where the scrubber stands,
 * as base64url JSON in one query parameter. Opening the link replays the same session.
 */
import { Option, Schema } from 'effect';

export const SharedSession = Schema.Struct({
  specimen: Schema.String,
  events: Schema.Array(Schema.String),
  at: Schema.Number,
});
export type SharedSession = typeof SharedSession.Type;

export const sessionParam = 'session';

const json = Schema.fromJsonString(SharedSession);
const encodeJson = Schema.encodeSync(json);
const decodeJson = Schema.decodeUnknownOption(json);

const toBase64Url = (text: string): string =>
  btoa(String.fromCodePoint(...new TextEncoder().encode(text)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');

const fromBase64Url = (text: string): Option.Option<string> =>
  Option.liftThrowable(() =>
    new TextDecoder().decode(
      Uint8Array.from(atob(text.replaceAll('-', '+').replaceAll('_', '/')), (character) =>
        character.charCodeAt(0),
      ),
    ),
  )();

/** `href` with the session in its query. */
export const linkFor = (href: string, session: SharedSession): string => {
  const url = new URL(href);
  url.searchParams.set(sessionParam, toBase64Url(encodeJson(session)));
  return url.toString();
};

/** The session a link carries, when it carries a valid one. */
export const sessionFrom = (href: string): Option.Option<SharedSession> =>
  Option.liftThrowable(() => new URL(href))().pipe(
    Option.flatMap((url) => Option.fromNullishOr(url.searchParams.get(sessionParam))),
    Option.flatMap(fromBase64Url),
    Option.flatMap(decodeJson),
  );
