import { Newtype, Schema } from 'effect';

// --- Newtype declarations ---

export interface Count extends Newtype.Newtype<'Count', number> {}
export interface Milliseconds extends Newtype.Newtype<'Milliseconds', number> {}
export interface Seconds extends Newtype.Newtype<'Seconds', number> {}
export interface Hue extends Newtype.Newtype<'Hue', number> {}
export interface Pixels extends Newtype.Newtype<'Pixels', number> {}
export interface PixelsPerSec extends Newtype.Newtype<'PixelsPerSec', number> {}
export interface ParticleId extends Newtype.Newtype<'ParticleId', number> {}

// --- Isos (wrap / unwrap via optics) ---

export const countIso = Newtype.makeIso<Count>();
export const millisecondsIso = Newtype.makeIso<Milliseconds>();
export const secondsIso = Newtype.makeIso<Seconds>();
export const hueIso = Newtype.makeIso<Hue>();
export const pixelsIso = Newtype.makeIso<Pixels>();
export const pixelsPerSecIso = Newtype.makeIso<PixelsPerSec>();
export const particleIdIso = Newtype.makeIso<ParticleId>();

// --- Constructor shorthands (iso.set aliased to the type name) ---

export const Count = countIso.set;
export const Milliseconds = millisecondsIso.set;
export const Seconds = secondsIso.set;
export const Hue = hueIso.set;
export const Pixels = pixelsIso.set;
export const PixelsPerSec = pixelsPerSecIso.set;
export const ParticleId = particleIdIso.set;

// --- Schema field types ---

const finite = (u: unknown): u is number => typeof u === 'number' && Number.isFinite(u);

export const CountSchema = Schema.declare(
  (u: unknown): u is Count => finite(u) && Number.isInteger(u),
);
export const MillisecondsSchema = Schema.declare(
  (u: unknown): u is Milliseconds => finite(u) && u >= 0,
);
export const SecondsSchema = Schema.declare((u: unknown): u is Seconds => finite(u) && u >= 0);
export const HueSchema = Schema.declare((u: unknown): u is Hue => finite(u) && u >= 0 && u < 360);
export const PixelsSchema = Schema.declare((u: unknown): u is Pixels => finite(u));
export const PixelsPerSecSchema = Schema.declare((u: unknown): u is PixelsPerSec => finite(u));
export const ParticleIdSchema = Schema.declare(
  (u: unknown): u is ParticleId => finite(u) && Number.isInteger(u) && u >= 0,
);
