import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { Data, Schema } from 'effect';

class PublicationIdentityError extends Data.TaggedError('PublicationIdentityError')<{
  readonly message: string;
}> {}

const PackageManifest = Schema.Struct({ name: Schema.String });

/** Reject obsolete branding even when a manual publication selects an older ref. */
export function assertPackageIdentity(
  requested: string,
  manifest: typeof PackageManifest.Type,
): void {
  if (!/^[a-z][a-z0-9-]*$/.test(requested) || requested.startsWith('foldkit-flow'))
    throw new PublicationIdentityError({
      message: 'Flow package publication is forbidden; use the Zloz package family.',
    });
  if (manifest.name !== `@opsydyn/${requested}`)
    throw new PublicationIdentityError({
      message: 'Selected package and manifest identity do not match the approved name.',
    });
}

if (import.meta.main) {
  const requested = process.env.REQUESTED_PACKAGE ?? '';
  // Validate before constructing a path from an external workflow input.
  assertPackageIdentity(requested, { name: `@opsydyn/${requested}` });
  const manifest = Schema.decodeUnknownSync(PackageManifest)(
    JSON.parse(await readFile(path.join('packages', requested, 'package.json'), 'utf8')),
  );
  assertPackageIdentity(requested, manifest);
}
