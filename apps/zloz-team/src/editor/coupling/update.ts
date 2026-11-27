import type { DiagramFrame } from '@opsydyn/foldkit-zloz-alchemy/session';

import { projectCoupling, type CouplingRow } from '../coupling-projection';
import { Message, OutMessage } from './message';
import { Model, PAGE_SIZE } from './model';

export const currentRows = (model: Model): readonly CouplingRow[] => {
  const projection = model.projection;
  if (projection.status === 'waiting') return [];
  return model.cohort === null
    ? projection.rows
    : (projection.cohorts.find((group) => group.cohort.key === model.cohort)?.rows ?? []);
};
const clamp = (page: number, length: number) =>
  Math.max(0, Math.min(page, Math.max(0, Math.ceil(length / PAGE_SIZE) - 1)));
export const pageRows = (model: Model) =>
  currentRows(model).slice(model.page * PAGE_SIZE, (model.page + 1) * PAGE_SIZE);
export function observe(model: Model, frame: DiagramFrame | null): Model {
  if (frame === model.source) return model;
  if (!frame)
    return {
      ...model,
      source: null,
      projection: { status: 'waiting' },
      cohort: null,
      page: 0,
      removedPage: 0,
    };
  const sameTarget =
    model.source?.target.teamId === frame.target.teamId &&
    model.source.target.diagramId === frame.target.diagramId;
  const reusable =
    sameTarget &&
    model.source?.document === frame.document &&
    model.source.assessments === frame.assessments &&
    model.projection.status === 'ready';
  const projection =
    reusable && model.projection.status === 'ready'
      ? {
          ...model.projection,
          stamp: {
            target: frame.target,
            sourceVersion: frame.sourceVersion,
            graphVersion: frame.document.version,
          },
        }
      : projectCoupling(frame);
  if (projection.status === 'waiting') return model;
  const cohort =
    !model.source || !sameTarget
      ? projection.cohorts.length === 1
        ? projection.cohorts[0]!.cohort.key
        : null
      : projection.cohorts.some((group) => group.cohort.key === model.cohort)
        ? model.cohort
        : null;
  const next = {
    ...model,
    source: frame,
    projection,
    cohort,
    page: cohort === model.cohort && sameTarget ? model.page : 0,
  };
  return {
    ...next,
    page: clamp(next.page, currentRows(next).length),
    removedPage: clamp(sameTarget ? next.removedPage : 0, projection.removed.length),
  };
}
type CouplingUpdate = Readonly<{ model: Model; outMessage?: OutMessage }>;

export function update(model: Model, message: Message): CouplingUpdate {
  return Message.match(message, {
    SelectedCohort: ({ key }) => {
      if (
        model.projection.status !== 'ready' ||
        (key && !model.projection.cohorts.some((group) => group.cohort.key === key))
      )
        return { model };
      return {
        model: {
          ...model,
          cohort: key || null,
          page: 0,
          announcement: key
            ? 'Scope and horizon selected. Page 1.'
            : 'All scopes selected. Page 1.',
        },
      };
    },
    ClickedPage: ({ delta }) => ({
      model: {
        ...model,
        page: clamp(model.page + delta, currentRows(model).length),
        announcement: `Relationship page ${clamp(model.page + delta, currentRows(model).length) + 1}.`,
      },
    }),
    ClickedRemovedPage: ({ delta }) => {
      const count = model.projection.status === 'ready' ? model.projection.removed.length : 0;
      const page = clamp(model.removedPage + delta, count);
      return {
        model: {
          ...model,
          removedPage: page,
          announcement: `Retained assessment page ${page + 1}.`,
        },
      };
    },
    ClickedRelationship: ({ id }) =>
      model.projection.status === 'ready' &&
      model.projection.rows.some((row) => row.relationshipId === id)
        ? {
            model: { ...model, announcement: `Selected relationship ${id}.` },
            outMessage: OutMessage.SelectedRelationship({ id }),
          }
        : { model },
    ClickedReview: ({ id }) =>
      model.projection.status === 'ready' &&
      [...model.projection.rows, ...model.projection.removed].some(
        (row) => row.relationshipId === id,
      )
        ? { model, outMessage: OutMessage.RequestedAssessmentReview({ id }) }
        : { model },
    RecordedWidth: ({ width }) =>
      !Number.isFinite(width) || width < 0 || Math.floor(width) === model.width
        ? { model }
        : { model: { ...model, width: Math.floor(width) } },
  });
}
