import { expect, test } from 'bun:test';
import { init, Message, update } from './main';
import * as islandModule from './main';
import * as pageModule from './page-main';

test('initialises from public flags and increments without mutating the old model', () => {
  const initial = init({ title: 'Counter' }).model;
  const next = update(initial, Message.ClickedIncrement());
  expect(next.model).toEqual({ title: 'Counter', count: 1 });
  expect(initial.count).toBe(0);
});

test('rejects invalid serialized flags', () => {
  expect(() => init({ title: 42 } as never)).toThrow();
});

test('only the page module exposes the runtime Flags contract', () => {
  expect('Flags' in islandModule).toBe(false);
  expect(pageModule.Flags).toBeDefined();
});
