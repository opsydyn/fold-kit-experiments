import * as Domain from '@alchemy.run/domain';
import { Effect, Schema } from 'effect';
import { RpcMiddleware } from 'effect/rpc';

export class AccessDenied extends Domain.Rejection('AccessDenied') {}
export class CurrentActor extends Domain.RequestContext<CurrentActor>()(
  'Zloz/CurrentActor',
  Schema.Struct({ userId: Schema.String, sessionId: Schema.String }),
) {}
export class Session extends RpcMiddleware.Service<Session, { provides: CurrentActor }>()(
  'Zloz/Session',
  { error: AccessDenied },
) {}

export interface AccessPolicy {
  readonly check: (
    actor: typeof CurrentActor.Service,
    organizationId: string,
    edit: boolean,
  ) => Effect.Effect<void, AccessDenied>;
}

/** App-private M0 probe, not the future reusable diagram operation contract. */
export const qualification = (access: AccessPolicy) => {
  class TitleChanged extends Domain.Event('TitleChanged', { title: Schema.NonEmptyString }) {}
  class RenameProbe extends Domain.Command('RenameProbe', {
    target: Schema.String,
    middleware: [Session],
    input: { title: Schema.NonEmptyString },
    events: [TitleChanged],
    rejects: [AccessDenied],
  }) {}
  class DiagramProbe extends Domain.Aggregate('DiagramProbe', {
    id: Schema.String,
    state: Schema.Struct({ title: Schema.String }),
    initial: { title: 'Untitled' },
    commands: [RenameProbe],
    decide: {
      RenameProbe: (_state, command, target) =>
        CurrentActor.pipe(
          Effect.flatMap((actor) => access.check(actor, target.id, true)),
          Effect.map(() => [new TitleChanged({ title: command.title })]),
        ),
    },
    evolve: { TitleChanged: (_state, event) => ({ title: event.title }) },
    read: {
      middleware: [Session],
      rejects: [AccessDenied],
      validate: (request) =>
        CurrentActor.pipe(Effect.flatMap((actor) => access.check(actor, request.key.id, false))),
    },
  }) {}
  class Qualification extends Domain.Model('ZlozQualification', { aggregates: [DiagramProbe] }) {}
  class QualificationApi extends Domain.Api('ZlozQualificationApi', {
    model: Qualification,
    commands: ['RenameProbe'],
    aggregates: ['DiagramProbe'],
  }) {}
  return { model: Qualification, api: QualificationApi };
};
