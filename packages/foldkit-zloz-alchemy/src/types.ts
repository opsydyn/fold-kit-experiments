import type { ZlozGraph } from '@opsydyn/foldkit-zloz';
export const supportedAlchemyDomainVersion = '2.0.0-beta.85';
export type AlchemyDeclarationKind =
  | 'model'
  | 'aggregate'
  | 'command'
  | 'event'
  | 'view'
  | 'policy'
  | 'stream'
  | 'projection';
export type AlchemyDeclaration = Readonly<{
  id: string;
  locator: string;
  kind: AlchemyDeclarationKind;
  name: string;
}> &
  (
    | Readonly<{ kind: 'view'; viewState: 'declared' | 'absent' }>
    | Readonly<{ kind: Exclude<AlchemyDeclarationKind, 'view'> }>
  );
export type AlchemyRelationKind =
  | 'contains'
  | 'handles'
  | 'may-emit'
  | 'feeds'
  | 'observes-source'
  | 'reacts-to'
  | 'entry-type'
  | 'writes';
export type AlchemyRelation = Readonly<{
  id: string;
  kind: AlchemyRelationKind;
  source: string;
  target: string;
}>;
/** Source metadata and state-presence fields are declarations, not authenticated proof. */
export type AlchemyDescriptor = Readonly<{
  format: 'foldkit-zloz-alchemy';
  version: 1;
  source: Readonly<{
    packageVersion: typeof supportedAlchemyDomainVersion;
    namespace: string;
    modelName: string;
    revision: string;
  }>;
  declarations: readonly AlchemyDeclaration[];
  relations: readonly AlchemyRelation[];
}>;
export type AlchemyIssue = Readonly<{ code: string; path: string; reason: string }>;
export type AlchemyFinding = Readonly<{
  code: string;
  sourceId: string | null;
  severity: 'unverified' | 'loss' | 'unsupported';
  reason: string;
}>;
export type AlchemyProjection = Readonly<{ findings: readonly AlchemyFinding[] }> &
  (
    | Readonly<{ type: 'blocked'; source: AlchemyDescriptor | null }>
    | Readonly<{
        type: 'reviewable';
        source: AlchemyDescriptor;
        graph: ZlozGraph;
        coverage: readonly Readonly<{
          sourceId: string;
          representation: 'node' | 'parent' | 'edge';
        }>[];
        nativeReadModels: readonly Readonly<{ sourceId: string; basis: 'declared-state-schema' }>[];
        nativeConsumption: readonly string[];
      }>
  );
