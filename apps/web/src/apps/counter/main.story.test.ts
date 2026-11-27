import { Effect, Newtype } from 'effect';
import { expect, test } from 'vitest';

import { SpawnParticle } from './command';
import {
  BURST_COUNT,
  DECREMENT_HUE,
  INCREMENT_HUE,
  LIFESPAN_MAX_MS,
  LIFESPAN_MIN_MS,
  RESET_HUE,
  SPAWN_X,
  SPAWN_Y,
  UP_ANGLE,
} from './constant';
import { Message } from './message';
import { init } from './model';
import { Count, Milliseconds, ParticleId, PixelsPerSec } from './types';
import { update } from './update';

test.each([
  [Message.ClickedIncrement(), 1, INCREMENT_HUE],
  [Message.ClickedDecrement(), -1, DECREMENT_HUE],
  [Message.ClickedReset(), 0, RESET_HUE],
] as const)(
  'applies $0._tag and issues a full burst with the matching hue',
  (message, count, hue) => {
    const result = update(init, message);
    expect(Newtype.value(result.model.count)).toBe(count);
    expect(result.commands).toHaveLength(BURST_COUNT);
    for (const command of result.commands ?? []) {
      expect(command).toMatchObject({
        name: 'SpawnParticle',
        args: { x: SPAWN_X, y: SPAWN_Y, hue },
      });
    }
  },
);

const spawned = Message.SpawnedParticle({
  x: SPAWN_X,
  y: SPAWN_Y,
  vx: PixelsPerSec(0),
  vy: PixelsPerSec(-200),
  hue: INCREMENT_HUE,
  lifespanMs: Milliseconds(1000),
});

const modelWithParticle = update(init, spawned).model;

test('spawned particles receive consecutive IDs and start at the origin of the burst', () => {
  const { particles } = update(modelWithParticle, spawned).model;
  expect(particles.map(({ id }) => id)).toEqual([ParticleId(0), ParticleId(1)]);
  expect(particles[0]).toMatchObject({ hue: INCREMENT_HUE, trail: [{ x: SPAWN_X, y: SPAWN_Y }] });
});

test('the particle command generates a particle within its configured lifetime', async () => {
  const command = SpawnParticle.make({
    x: SPAWN_X,
    y: SPAWN_Y,
    hue: INCREMENT_HUE,
    angleBase: UP_ANGLE,
  });
  const message = await Effect.runPromise(command.effect);
  expect(message).toMatchObject({ _tag: 'SpawnedParticle', x: SPAWN_X, y: SPAWN_Y });
  expect(Newtype.value(message.lifespanMs)).toBeGreaterThanOrEqual(Newtype.value(LIFESPAN_MIN_MS));
  expect(Newtype.value(message.lifespanMs)).toBeLessThan(Newtype.value(LIFESPAN_MAX_MS));
});

test('a frame advances age and position, applies gravity, and issues no commands', () => {
  const { model, commands } = update(
    modelWithParticle,
    Message.TickedFrame({ deltaTimeMs: Milliseconds(16) }),
  );
  const particle = model.particles[0];
  expect(Newtype.value(model.elapsedSeconds)).toBeCloseTo(0.016);
  expect(particle?.ageMs).toBe(16);
  expect(particle?.vy).toBeGreaterThan(-200);
  expect(particle?.trail).toHaveLength(2);
  expect(particle?.trail[1]?.y).toBeLessThan(Newtype.value(SPAWN_Y));
  expect(commands).toBeUndefined();
});

test('a frame removes expired particles and Reset clears a live burst immediately', () => {
  const { x, y, vx, vy, hue, lifespanMs } = spawned;
  const expiring = {
    id: ParticleId(0),
    trail: [{ x, y }],
    vx,
    vy,
    hue,
    lifespanMs,
    ageMs: Milliseconds(990),
  };
  const tick = Message.TickedFrame({ deltaTimeMs: Milliseconds(16) });
  expect(update({ ...modelWithParticle, particles: [expiring] }, tick).model.particles).toEqual([]);
  expect(
    update({ ...modelWithParticle, count: Count(3) }, Message.ClickedReset()).model,
  ).toMatchObject({ count: Count(0), particles: [] });
});
