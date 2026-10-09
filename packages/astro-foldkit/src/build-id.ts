type FoldkitEnv = Readonly<{
  FOLDKIT_BUILD_ID?: string;
}>;

type ImportMetaWithEnv = ImportMeta &
  Readonly<{
    env?: FoldkitEnv;
  }>;

// Undefined delegates to FoldKit's compiled identity; explicit legacy overrides still work.
export function readFoldkitBuildId(
  // SAFETY: The surrounding package boundary establishes this value before the assertion.
  env: FoldkitEnv | undefined = (import.meta as ImportMetaWithEnv).env,
): string | undefined {
  const buildId = env?.FOLDKIT_BUILD_ID;
  if (buildId !== undefined && buildId.trim() === '')
    throw new Error(
      'FOLDKIT_BUILD_ID must be non-empty when configured. Omit it to use the generated build identity.',
    );
  return buildId;
}
