import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import type { Auth as BetterAuth } from 'better-auth';

import type { authOptions } from './auth-options';
import { epochSql } from './date-sql';

const maxIconBytes = 64 * 1024;
const maxTeamIcons = 64;
const mimeTypes = ['image/png', 'image/webp'] as const;
type MediaType = (typeof mimeTypes)[number];
type Icon = { id: string; name: string; mediaType: MediaType; archived: number };
type NativeAuth = { api: Pick<BetterAuth<ReturnType<typeof authOptions>>['api'], 'getSession'> };
const idPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const builtin = new Set(['user', 'package', 'cloud', 'stack', 'cube']);
const error = (status: number, reason: string) => Response.json({ error: reason }, { status });
const keyFor = (teamId: string, id: string) => `${teamId}/${id}`;

const readIcon = (db: D1Database, teamId: string, id: string) =>
  db
    .prepare(
      'SELECT id, name, mediaType, archived FROM teamIcon WHERE organizationId = ? AND id = ?',
    )
    .bind(teamId, id)
    .first<Icon>();

export function usableNodeIcon(db: D1Database, teamId: string, icon: string | null | undefined) {
  if (icon == null) return Promise.resolve(true);
  if (icon.startsWith('builtin:')) return Promise.resolve(builtin.has(icon.slice(8)));
  const id = icon.slice(5);
  return icon.startsWith('team:') && idPattern.test(id)
    ? readIcon(db, teamId, id).then(Boolean)
    : Promise.resolve(false);
}

async function boundedBytes(request: Request) {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const bytes = new Uint8Array(maxIconBytes);
  let length = 0;
  // oxlint-disable-next-line linteffect/no-try-catch -- Release the native request reader on every exit.
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) return bytes.slice(0, length);
      if (length + next.value.byteLength > bytes.byteLength) {
        await reader.cancel();
        return null;
      }
      bytes.set(next.value, length);
      length += next.value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
}

function boundedDimensions(width: number, height: number) {
  return width >= 1 && width <= 512 && height >= 1 && height <= 512;
}

function validIcon(bytes: Uint8Array, mediaType: MediaType) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (mediaType === 'image/png') {
    if (
      bytes.length < 45 ||
      view.getUint32(0) !== 0x89504e47 ||
      view.getUint32(4) !== 0x0d0a1a0a ||
      view.getUint32(8) !== 13 ||
      view.getUint32(12) !== 0x49484452 ||
      !boundedDimensions(view.getUint32(16), view.getUint32(20))
    )
      return false;
    let imageData = false;
    for (let offset = 8; offset + 12 <= bytes.length; ) {
      const length = view.getUint32(offset);
      const chunk = view.getUint32(offset + 4);
      const next = offset + length + 12;
      if (next > bytes.length || chunk === 0x6163544c) return false;
      if (chunk === 0x49444154 && length > 0) imageData = true;
      if (chunk === 0x49454e44) return imageData && length === 0 && next === bytes.length;
      offset = next;
    }
    return false;
  }
  if (
    bytes.length < 25 ||
    view.getUint32(0) !== 0x52494646 ||
    view.getUint32(8) !== 0x57454250 ||
    view.getUint32(4, true) !== bytes.length - 8
  )
    return false;
  let picture = false;
  let offset = 12;
  for (; offset + 8 <= bytes.length; ) {
    const chunk = view.getUint32(offset);
    const length = view.getUint32(offset + 4, true);
    const start = offset + 8;
    const next = start + length + (length % 2);
    if (next > bytes.length || chunk === 0x414e494d || chunk === 0x414e4d46) return false;
    if (chunk === 0x56503820) {
      if (
        length < 10 ||
        view.getUint16(start + 3) !== 0x9d01 ||
        bytes[start + 5] !== 0x2a ||
        !boundedDimensions(
          view.getUint16(start + 6, true) & 0x3fff,
          view.getUint16(start + 8, true) & 0x3fff,
        )
      )
        return false;
      picture = true;
    } else if (chunk === 0x5650384c) {
      if (length < 5 || bytes[start] !== 0x2f) return false;
      const dimensions = view.getUint32(start + 1, true);
      if (!boundedDimensions(1 + (dimensions & 0x3fff), 1 + ((dimensions >>> 14) & 0x3fff)))
        return false;
      picture = true;
    } else if (chunk === 0x56503858) {
      if (
        length !== 10 ||
        (bytes[start]! & 2) !== 0 ||
        !boundedDimensions(
          1 + (view.getUint32(start + 4, true) & 0xffffff),
          1 + (view.getUint32(start + 6, true) >>> 8),
        )
      )
        return false;
    }
    offset = next;
  }
  return picture && offset === bytes.length;
}

export async function handleTeamIcons(
  request: Request,
  db: D1Database,
  auth: NativeAuth,
  bucket: R2Bucket,
) {
  const url = new URL(request.url);
  const match = /^\/api\/zloz\/teams\/([A-Za-z0-9_-]{1,128})\/icons(?:\/([0-9a-f-]{36}))?$/.exec(
    url.pathname,
  );
  if (!match) return error(404, 'Missing');
  const teamId = match[1]!;
  const id = match[2];
  if (id && !idPattern.test(id)) return error(404, 'Missing');
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return error(401, 'SignInRequired');
  const membership = () =>
    db
      .prepare(`SELECT member.role FROM member JOIN session ON session.userId = member.userId
      WHERE member.organizationId = ? AND member.userId = ? AND session.id = ? AND ${epochSql('session.expiresAt')} > ?`)
      .bind(teamId, session.user.id, session.session.id, Date.now())
      .first<{ role: string }>();
  const member = await membership();
  if (!member || !['owner', 'editor', 'viewer'].includes(member.role))
    return error(403, 'AccessDenied');
  if (request.method === 'GET') {
    if (!id) {
      const { results } = await db
        .prepare(
          'SELECT id, name, mediaType, archived FROM teamIcon WHERE organizationId = ? AND archived = 0 ORDER BY name, id',
        )
        .bind(teamId)
        .all<Icon>();
      return Response.json(results);
    }
    const icon = await readIcon(db, teamId, id);
    const image = icon && (await bucket.get(keyFor(teamId, id)));
    if (!image) return error(404, 'Missing');
    return new Response(await image.arrayBuffer(), {
      headers: {
        'content-type': icon.mediaType,
        'x-content-type-options': 'nosniff',
        'cache-control': 'private, no-store',
        'cross-origin-resource-policy': 'same-origin',
      },
    });
  }
  if (request.method === 'DELETE' && id) {
    if (member.role !== 'owner') return error(403, 'AccessDenied');
    if (!(await readIcon(db, teamId, id))) return error(404, 'Missing');
    await db
      .prepare('UPDATE teamIcon SET archived = 1 WHERE organizationId = ? AND id = ?')
      .bind(teamId, id)
      .run();
    return new Response(null, { status: 204 });
  }
  if (request.method !== 'POST' || id) return error(405, 'MethodNotAllowed');
  if (member.role === 'viewer') return error(403, 'AccessDenied');
  const mediaType = mimeTypes.find((type) => type === request.headers.get('content-type'));
  const name = url.searchParams.get('name')?.trim();
  if (!name || name.length > 60 || /[\u0000-\u001f\u007f]/u.test(name))
    return error(400, 'InvalidIconName');
  if (!mediaType) return error(415, 'UnsupportedIconFormat');
  const bytes = await boundedBytes(request);
  if (!bytes) return error(413, 'IconTooLarge');
  if (!validIcon(bytes, mediaType)) return error(415, 'InvalidIconImage');
  const current = await membership();
  if (!current || !['editor', 'owner'].includes(current.role)) return error(403, 'AccessDenied');
  const data = new Uint8Array([
    ...new TextEncoder().encode(JSON.stringify([name, mediaType])),
    ...bytes,
  ]);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(digest, 0, 16), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  const newId = [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
  const existing = await readIcon(db, teamId, newId);
  if (existing) return existing.archived ? error(409, 'IconArchived') : Response.json(existing);
  const key = keyFor(teamId, newId);
  await bucket.put(key, bytes);
  await db
    .prepare(`INSERT OR IGNORE INTO teamIcon (organizationId, id, name, mediaType)
      SELECT ?, ?, ?, ? WHERE (SELECT count(*) FROM teamIcon WHERE organizationId = ?) < ?`)
    .bind(teamId, newId, name, mediaType, teamId, maxTeamIcons)
    .run();
  const inserted = await readIcon(db, teamId, newId);
  if (inserted)
    return inserted.archived
      ? error(409, 'IconArchived')
      : Response.json(inserted, { status: 201 });
  await bucket.delete(key);
  return error(409, 'IconLibraryFull');
}
