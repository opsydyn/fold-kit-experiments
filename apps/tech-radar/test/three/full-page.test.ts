import { describe, expect, test } from 'bun:test';

import { Option } from 'effect';

import { Message } from '../../src/radar/three/message';
import { fullPageOf, type Model } from '../../src/radar/three/model';
import { init, update } from '../../src/radar/three/update';
import { demoRadar } from '../../src/test/fixture';

const pages = { entry: '/blip/{id}/', editionEntry: '/edition/{edition}/blip/{id}/' };
const hosted = init({ dataset: demoRadar, title: 'Our radar', pages }).model;
const inEdition = (model: Model, index: number): Model =>
  update(model, Message.ChangedEdition({ index })).model;

describe('the host page', () => {
  test('names the radar, or it is the Tech radar', () => {
    expect(hosted.title).toBe('Our radar');
    expect(init({ dataset: demoRadar }).model.title).toBe('Tech radar');
  });

  test('hands over the data: a dataset that does not decode shows why', () => {
    expect(hosted.data._tag).toBe('Ready');
    const broken = { ...demoRadar, authoredOn: 'someday' };
    expect(init({ dataset: broken }).model.data).toEqual({
      _tag: 'Failure',
      reason: 'Invalid radar authored date',
    });
  });
});

describe("an entry's full page", () => {
  test('is the current page in the current edition', () => {
    expect(fullPageOf(hosted, 'foldkit')).toEqual(Option.some('/blip/foldkit/'));
  });

  test("is the edition's page while the radar shows an earlier edition", () => {
    expect(fullPageOf(inEdition(hosted, 1), 'foldkit')).toEqual(
      Option.some('/edition/2026-02-14/blip/foldkit/'),
    );
  });

  test('is the current page when the entry was not on that edition', () => {
    // Codex joined in the third edition.
    expect(fullPageOf(inEdition(hosted, 1), 'codex')).toEqual(Option.some('/blip/codex/'));
  });

  test('is none when the host site has no full pages', () => {
    expect(fullPageOf(init({ dataset: demoRadar }).model, 'foldkit')).toEqual(Option.none());
  });
});
