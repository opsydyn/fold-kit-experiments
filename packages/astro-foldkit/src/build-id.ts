type FoldkitEnv = Readonly<{
  FOLDKIT_BUILD_ID?: string;
}>;

type ImportMetaWithEnv = ImportMeta &
  Readonly<{
    env?: FoldkitEnv;
  }>;

export function readFoldkitBuildId(
  env: FoldkitEnv | undefined = (import.meta as ImportMetaWithEnv).env,
): string {
  const buildId = env?.FOLDKIT_BUILD_ID;
  if (buildId === undefined || buildId === '')
    throw new Error(
      'FoldKit server rendering requires import.meta.env.FOLDKIT_BUILD_ID. Configure foldkit({ server: { buildId } }).',
    );
  return buildId;
}
