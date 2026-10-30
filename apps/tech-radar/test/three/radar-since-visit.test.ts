import { describe, expect, test } from 'bun:test';

import { Option } from 'effect';

import { Message } from '../../src/radar/three/message';
import { editionsOf } from '../../src/radar/three/model';
import { init, update } from '../../src/radar/three/update';
import { demoRadar } from '../../src/test/fixture';

const start = init({ dataset: demoRadar }).model;
const editions = editionsOf(start);
const returning = (edition: string | null) =>
  update(start, Message.SucceededLoadLastVisit({ edition }));

describe('since your last visit', () => {
  test('a reader back from an earlier edition sees what changed since', () => {
    const { model, commands } = returning(editions[0]?.authoredOn ?? null);
    const since = Option.getOrThrow(model.sinceVisit);
    expect(since.label).toBe('First edition');
    expect(since.changes.length).toBeGreaterThan(0);
    expect(since.changes.map(({ text }) => text)).toContain('FoldKit moved from Assess to Adopt');
    expect(commands?.length).toBe(1);
  });

  test('a first visit, an unknown edition or the current one shows nothing', () => {
    expect(returning(null).model.sinceVisit).toEqual(Option.none());
    expect(returning('1999-01-01').model.sinceVisit).toEqual(Option.none());
    expect(returning(editions.at(-1)?.authoredOn ?? null).model.sinceVisit).toEqual(Option.none());
  });

  test('dismissing it clears it', () => {
    const shown = returning(editions[0]?.authoredOn ?? null).model;
    expect(update(shown, Message.ClickedDismissSinceVisit()).model.sinceVisit).toEqual(
      Option.none(),
    );
  });
});
