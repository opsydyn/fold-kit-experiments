import type { D1Database } from '@cloudflare/workers-types';

import { BootstrapCommand, normalizeEmail } from './team-contract';

type Existing = { id: string; name: string; slug: string; ownerUserId: string | null };

const existingTeam = (db: D1Database, slug: string, ownerId: string) =>
  db
    .prepare(`
  SELECT organization.id, organization.name, organization.slug, member.userId AS ownerUserId
  FROM organization LEFT JOIN member ON member.organizationId = organization.id AND member.userId = ? AND member.role = 'owner'
  WHERE organization.slug = ?
`)
    .bind(ownerId, slug)
    .first<Existing>();

export const problem = (status: number, code: string, message: string) =>
  Response.json({ code, message }, { status, headers: { 'cache-control': 'private, no-store' } });

/** ADR 0037: trusted operator only; never provisions or verifies an identity. */
export async function bootstrapTeam(db: D1Database, command: typeof BootstrapCommand.Type) {
  const email = normalizeEmail(command.ownerEmail);
  const owner = await db
    .prepare(`SELECT user.id FROM user WHERE lower(user.email) = ? AND user.emailVerified = 1
    AND EXISTS (SELECT 1 FROM account WHERE account.userId = user.id AND account.providerId = 'google')`)
    .bind(email)
    .first<{ id: string }>();
  if (!owner)
    return problem(
      422,
      'OwnerNotEligible',
      'The owner must first sign in with a verified Google account.',
    );
  const existing = await existingTeam(db, command.slug, owner.id);
  if (existing) {
    if (existing.ownerUserId !== owner.id || existing.name !== command.name)
      return problem(
        409,
        'BootstrapConflict',
        'This slug already belongs to a different team or owner.',
      );
    return Response.json({
      _tag: 'Applied',
      status: 'existing',
      team: { id: existing.id, name: existing.name, slug: existing.slug },
    });
  }
  if (!command.apply)
    return Response.json({
      _tag: 'Ready',
      status: 'ready',
      name: command.name,
      slug: command.slug,
    });
  const id = crypto.randomUUID();
  const now = Date.now();
  try {
    await db.batch([
      db
        .prepare(`INSERT INTO organization (id, name, slug, createdAt)
        SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM user WHERE id = ? AND emailVerified = 1
          AND EXISTS (SELECT 1 FROM account WHERE account.userId = user.id AND account.providerId = 'google'))`)
        .bind(id, command.name, command.slug, now, owner.id),
      db
        .prepare(`INSERT INTO member (id, organizationId, userId, role, createdAt)
        SELECT ?, ?, ?, 'owner', ? WHERE EXISTS (SELECT 1 FROM organization WHERE id = ?)`)
        .bind(crypto.randomUUID(), id, owner.id, now, id),
    ]);
  } catch (error) {
    const raced = await existingTeam(db, command.slug, owner.id);
    if (raced?.ownerUserId === owner.id && raced.name === command.name)
      return Response.json({
        _tag: 'Applied',
        status: 'existing',
        team: { id: raced.id, name: raced.name, slug: raced.slug },
      });
    if (raced)
      return problem(
        409,
        'BootstrapConflict',
        'This slug already belongs to a different team or owner.',
      );
    throw error;
  }
  const created = await existingTeam(db, command.slug, owner.id);
  if (!created || created.id !== id || created.ownerUserId !== owner.id)
    return problem(422, 'OwnerNotEligible', 'Owner eligibility changed; no team was created.');
  return Response.json({
    _tag: 'Applied',
    status: 'created',
    team: { id, name: command.name, slug: command.slug },
  });
}
