import { Newtype, Schema } from 'effect'

// --- Newtype declarations ---

export interface Count extends Newtype.Newtype<'Count', number> {}
export interface Milliseconds extends Newtype.Newtype<'Milliseconds', number> {}
export interface Seconds extends Newtype.Newtype<'Seconds', number> {}
export interface Hue extends Newtype.Newtype<'Hue', number> {}
export interface Pixels extends Newtype.Newtype<'Pixels', number> {}
export interface PixelsPerSec extends Newtype.Newtype<'PixelsPerSec', number> {}
export interface ParticleId extends Newtype.Newtype<'ParticleId', number> {}

// --- Isos (wrap / unwrap via optics) ---

export const countIso = Newtype.makeIso<Count>()
export const millisecondsIso = Newtype.makeIso<Milliseconds>()
export const secondsIso = Newtype.makeIso<Seconds>()
export const hueIso = Newtype.makeIso<Hue>()
export const pixelsIso = Newtype.makeIso<Pixels>()
export const pixelsPerSecIso = Newtype.makeIso<PixelsPerSec>()
export const particleIdIso = Newtype.makeIso<ParticleId>()

// --- Constructor shorthands (iso.set aliased to the type name) ---

export const Count = countIso.set
export const Milliseconds = millisecondsIso.set
export const Seconds = secondsIso.set
export const Hue = hueIso.set
export const Pixels = pixelsIso.set
export const PixelsPerSec = pixelsPerSecIso.set
export const ParticleId = particleIdIso.set

// --- Schema field types ---

export const CountSchema = Schema.declare((u: unknown): u is Count => typeof u === 'number')
export const MillisecondsSchema = Schema.declare((u: unknown): u is Milliseconds => typeof u === 'number')
export const SecondsSchema = Schema.declare((u: unknown): u is Seconds => typeof u === 'number')
export const HueSchema = Schema.declare((u: unknown): u is Hue => typeof u === 'number')
export const PixelsSchema = Schema.declare((u: unknown): u is Pixels => typeof u === 'number')
export const PixelsPerSecSchema = Schema.declare((u: unknown): u is PixelsPerSec => typeof u === 'number')
export const ParticleIdSchema = Schema.declare((u: unknown): u is ParticleId => typeof u === 'number')
