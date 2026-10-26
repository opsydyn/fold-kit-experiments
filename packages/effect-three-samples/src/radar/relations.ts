/**
 * The radar's relationships, read from one entry's side: "FoldKit · Inspired by · Elm"
 * from FoldKit, "Elm · Inspired · FoldKit" from Elm. Peer relationships read the same
 * both ways.
 */
import { Match } from 'effect';

import {
  isSymmetric,
  type RadarRelationship,
  relationshipLabels,
  type RelationshipType,
} from './data';

/** How a one-way relationship reads from the entry it points at. */
const incomingLabels = {
  'builds-on': 'Built on by',
  complements: relationshipLabels.complements,
  'inspired-by': 'Inspired',
  'guards-against': 'Guarded by',
  'alternative-to': relationshipLabels['alternative-to'],
} satisfies Readonly<Record<RelationshipType, string>>;

export type Relation = Readonly<{
  /** The entry at the other end. */
  other: string;
  type: RelationshipType;
  /** The relationship as read from this entry. */
  label: string;
  note: string;
}>;

/** A relationship's scene key: unique, as the dataset rejects duplicates. */
export const edgeKey = ({ from, to, type }: RadarRelationship): string =>
  `edge:${from}:${to}:${type}`;

export const touches = (relationship: RadarRelationship, id: string): boolean =>
  relationship.from === id || relationship.to === id;

/** Every relationship of `id`, read from its side. */
export const relationsOf = (
  relationships: ReadonlyArray<RadarRelationship>,
  id: string,
): ReadonlyArray<Relation> =>
  relationships
    .filter((relationship) => touches(relationship, id))
    .map(({ from, to, type, note }) =>
      Match.value(from === id || isSymmetric(type)).pipe(
        Match.when(true, () => ({
          other: [from, to].find((end) => end !== id) ?? to,
          type,
          label: relationshipLabels[type],
          note,
        })),
        Match.orElse(() => ({ other: from, type, label: incomingLabels[type], note })),
      ),
    );
