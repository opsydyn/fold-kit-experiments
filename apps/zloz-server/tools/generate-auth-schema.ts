import { Database } from 'bun:sqlite';

import { getMigrations } from 'better-auth/db/migration';

import { authOptions } from '../src/auth-options';

// Generate only: the app applies this reviewed SQL through Alchemy D1 migrations.
using database = new Database(':memory:');
const migration = await getMigrations({
  ...authOptions('https://schema.invalid', 'schema-only', 'schema-only'),
  database,
});
const sql = await migration.compileMigrations();
await Bun.write(
  new URL('../migrations/0001_auth.sql', import.meta.url),
  `-- Generated from Better Auth 1.7.5 and auth-options.ts. Review before applying.\n${sql}\n`,
);
