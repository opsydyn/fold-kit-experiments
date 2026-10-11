import { EventType } from '@ag-ui/core';
import type {
  Event,
  StateDeltaEvent,
  StateSnapshotEvent,
  RunStartedEvent,
  RunFinishedEvent,
} from '@ag-ui/core';
import { Match, Result, Schema } from 'effect';
import jsonPatch from 'fast-json-patch';
import type { Return } from 'foldkit/update';

import { THREAD_ID, Wire } from './contract';
import type { NavigationValue, RunRequest, Scenario } from './contract';
import { decodeAgentEvent, Message } from './message';
import { activeRun, Model, Session, visibleServices } from './model';

const recordActivity = (model: Model, entry: string): Model => ({
  ...model,
  activity: [...model.activity, entry].slice(-12),
});

function reconcileSelection(model: Model): Model {
  const selectedId = Match.value(
    visibleServices(model).some(({ id }) => id === model.selectedId),
  ).pipe(
    Match.when(true, () => model.selectedId),
    Match.orElse(() => null),
  );
  return { ...model, selectedId };
}

const beginRun = (model: Model, scenario: Scenario): Model =>
  recordActivity(
    {
      ...model,
      generation: model.generation + 1,
      accepted: 0,
      rejection: null,
      session: Session.Connecting({ request: { runId: `run-${model.generation + 1}`, scenario } }),
    },
    'Connecting',
  );

const fail = (
  model: Model,
  request: RunRequest,
  failure: Extract<Session, { _tag: 'Failed' }>['failure'],
): Model =>
  recordActivity(
    { ...model, session: Session.Failed({ runId: request.runId, failure }) },
    failure.reason,
  );

const protocolFailure = (model: Model, request: RunRequest, reason: string): Model =>
  fail(model, request, { _tag: 'Protocol', reason });

function rejectUpdate(
  model: Model,
  request: RunRequest,
  kind: NonNullable<Model['rejection']>['kind'],
  reason: string,
  evidence: string,
): Model {
  return protocolFailure(
    {
      ...model,
      rejection: {
        kind,
        runId: request.runId,
        detail: `${evidence}\n${reason.slice(0, 400)}`.slice(0, 1200),
      },
    },
    request,
    `${kind} rejected; last valid measurements retained`,
  );
}

type ValueOperation = Extract<StateDeltaEvent['delta'][number], { op: 'add' | 'replace' | 'test' }>;
const evidenceValue = (operation: ValueOperation): string =>
  Match.value(operation.value).pipe(
    Match.when(Match.string, (value) => value.slice(0, 120)),
    Match.when(Match.number, String),
    Match.when(Match.boolean, String),
    Match.when(Match.null, () => 'null'),
    Match.orElse(() => '[structured value]'),
  );
const operationEvidence = (operation: StateDeltaEvent['delta'][number]): string =>
  Match.value(operation).pipe(
    Match.when(
      { op: Match.is('add', 'replace', 'test') },
      (operation) => `${operation.op} ${operation.path.slice(0, 160)}: ${evidenceValue(operation)}`,
    ),
    Match.orElse(({ op, path }) => `${op} ${path.slice(0, 160)}`),
  );
const deltaEvidence = (event: StateDeltaEvent): string =>
  event.delta.slice(0, 8).map(operationEvidence).join('\n');

function acceptWire(model: Model, request: RunRequest, wire: Wire, entry: string): Model {
  const baseline = Match.value(model.session).pipe(
    Match.when({ _tag: 'AwaitingSnapshot' }, () => wire),
    Match.orElse(() => model.baseline),
  );
  return recordActivity(
    reconcileSelection({
      ...model,
      wire,
      baseline,
      // Nested schema constructors copy records; preserve the already-validated connection descriptor.
      session: { _tag: 'Streaming', request },
      accepted: model.accepted + 1,
    }),
    entry,
  );
}

const cancel = (model: Model, cause: Extract<Session, { _tag: 'Cancelled' }>['cause']): Model =>
  Match.value(activeRun(model)).pipe(
    Match.when(Match.defined, (request) =>
      recordActivity(
        {
          ...model,
          session: Session.Cancelled({ runId: request.runId, cause }),
        },
        `Cancelled: ${cause}`,
      ),
    ),
    Match.orElse(() => model),
  );

const matchingLifecycle = (
  request: RunRequest,
  event: RunStartedEvent | RunFinishedEvent,
): boolean => event.runId === request.runId && event.threadId === THREAD_ID;

const receiveStarted = (model: Model, request: RunRequest, event: RunStartedEvent): Model =>
  Match.value({ session: model.session, matches: matchingLifecycle(request, event) }).pipe(
    Match.when({ session: { _tag: 'Connecting' }, matches: true }, () =>
      recordActivity(
        {
          ...model,
          session: { _tag: 'AwaitingSnapshot', request },
        },
        'Run started',
      ),
    ),
    Match.orElse(() => protocolFailure(model, request, 'Invalid run start identity or ordering')),
  );

const receiveSnapshot = (model: Model, request: RunRequest, event: StateSnapshotEvent): Model =>
  Match.value(model.session).pipe(
    Match.when({ _tag: Match.is('AwaitingSnapshot', 'Streaming') }, () =>
      Result.match(
        Result.try({
          try: () => Schema.decodeUnknownSync(Wire)(structuredClone(event.snapshot)),
          catch: (error) => String(error),
        }),
        {
          onSuccess: (wire) => acceptWire(model, request, wire, 'Snapshot accepted'),
          onFailure: (reason) =>
            rejectUpdate(model, request, 'Snapshot', reason, 'STATE_SNAPSHOT failed validation'),
        },
      ),
    ),
    Match.orElse(() => protocolFailure(model, request, 'Snapshot before run start')),
  );

const operationPaths = (operation: StateDeltaEvent['delta'][number]): readonly string[] =>
  Match.value(operation).pipe(
    Match.when({ op: Match.is('copy', 'move') }, ({ path, from }) => [path, from]),
    Match.orElse(({ path }) => [path]),
  );
const prototypePath = (path: string): boolean =>
  path
    .split('/')
    .some((part) =>
      ['__proto__', 'prototype', 'constructor'].includes(
        part.replace(/~1/g, '/').replace(/~0/g, '~'),
      ),
    );

const patchWire = (wire: Wire, event: StateDeltaEvent): Result.Result<Wire, string> =>
  Match.value(event.delta.some((operation) => operationPaths(operation).some(prototypePath))).pipe(
    Match.when(true, () => Result.fail('Prototype paths are forbidden')),
    Match.orElse(() =>
      Result.try({
        // Clone operations as well as state so copy/add cannot retain event-owned values.
        try: () =>
          Schema.decodeUnknownSync(Wire)(
            jsonPatch.applyPatch(
              structuredClone(wire),
              structuredClone(event.delta),
              true,
              true,
              true,
            ).newDocument,
          ),
        catch: (error) => String(error),
      }),
    ),
  );

const receiveDelta = (model: Model, request: RunRequest, event: StateDeltaEvent): Model =>
  Match.value(model).pipe(
    Match.when({ session: { _tag: 'Streaming' }, wire: Match.defined }, ({ wire }) =>
      Result.match(patchWire(wire, event), {
        onSuccess: (candidate) => acceptWire(model, request, candidate, 'Delta accepted'),
        onFailure: (reason) => rejectUpdate(model, request, 'Delta', reason, deltaEvidence(event)),
      }),
    ),
    Match.orElse(() =>
      protocolFailure(model, request, 'Delta requires this run snapshot baseline'),
    ),
  );

const complete = (model: Model, request: RunRequest, event: RunFinishedEvent): Model =>
  Match.value(event.outcome?.type).pipe(
    Match.whenOr(Match.undefined, 'success', () =>
      recordActivity(
        {
          ...model,
          session: Session.Completed({ runId: request.runId }),
        },
        'Run completed',
      ),
    ),
    Match.orElse(() => protocolFailure(model, request, 'Unsupported non-completing run outcome')),
  );

const receiveFinished = (model: Model, request: RunRequest, event: RunFinishedEvent): Model =>
  Match.value({ session: model.session, matches: matchingLifecycle(request, event) }).pipe(
    Match.when({ session: { _tag: 'Streaming' }, matches: true }, () =>
      complete(model, request, event),
    ),
    Match.orElse(() => protocolFailure(model, request, 'Invalid completion identity or ordering')),
  );

const receiveEvent = (model: Model, request: RunRequest, event: Event): Model =>
  Match.value(event).pipe(
    Match.when({ type: EventType.RUN_STARTED }, (event) => receiveStarted(model, request, event)),
    Match.when({ type: EventType.STATE_SNAPSHOT }, (event) =>
      receiveSnapshot(model, request, event),
    ),
    Match.when({ type: EventType.STATE_DELTA }, (event) => receiveDelta(model, request, event)),
    Match.when({ type: EventType.RUN_FINISHED }, (event) => receiveFinished(model, request, event)),
    Match.when({ type: EventType.RUN_ERROR }, ({ message }) =>
      protocolFailure(model, request, message),
    ),
    Match.orElse(() => model),
  );

const receive = (
  model: Model,
  request: RunRequest,
  message: typeof Message.ReceivedAgentEvent.Type,
): Model =>
  Match.value(decodeAgentEvent(message)).pipe(
    Match.when({ success: false }, ({ error }) => protocolFailure(model, request, error.message)),
    Match.when({ success: true }, ({ data }) => receiveEvent(model, request, data)),
    Match.exhaustive,
  );

const recover = (model: Model): Model =>
  Match.value(model.session).pipe(
    Match.when({ _tag: 'Failed' }, () => beginRun(model, 'normal')),
    Match.orElse(() => model),
  );

const selectService = (model: Model, id: string): Model =>
  Match.value(visibleServices(model).some((service) => service.id === id)).pipe(
    Match.when(true, () => ({ ...model, selectedId: id })),
    Match.orElse(() => model),
  );

const receiveCurrent = (model: Model, message: typeof Message.ReceivedAgentEvent.Type): Model =>
  Match.value(activeRun(model)).pipe(
    Match.when({ runId: message.runId }, (request) => receive(model, request, message)),
    Match.orElse(() => model),
  );

const failCurrent = (model: Model, message: typeof Message.FailedStream.Type): Model =>
  Match.value(activeRun(model)).pipe(
    Match.when({ runId: message.runId }, (request) =>
      fail(model, request, { _tag: 'Transport', reason: message.error }),
    ),
    Match.orElse(() => model),
  );

const navigate = (model: Model, phase: NavigationValue['phase']): Model =>
  Match.value(phase).pipe(
    Match.when('exited', () => cancel(model, 'RouteExit')),
    Match.orElse(() => model),
  );

export function update(model: Model, message: Message): Return<Model, Message> {
  const nextModel = Message.match<Model>(message, {
    ClickedRun: () => beginRun(model, model.scenario),
    ClickedCancel: () => cancel(model, 'User'),
    ClickedRecover: () => recover(model),
    SelectedScenario: ({ scenario }) => ({ ...model, scenario }),
    ClickedFilter: ({ filter }) => reconcileSelection({ ...model, filter }),
    ClickedService: ({ id }) => selectService(model, id),
    ChangedCompactView: ({ isCompact }) => ({ ...model, isCompact }),
    ReceivedAgentEvent: (eventMessage) => receiveCurrent(model, eventMessage),
    FailedStream: (failureMessage) => failCurrent(model, failureMessage),
    Navigated: ({ phase }) => navigate(model, phase),
  });
  return { model: nextModel };
}
