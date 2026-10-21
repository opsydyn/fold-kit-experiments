/**
 * A snapshot of one of this package's worlds: Rapier's own (`World.takeSnapshot`), and an
 * index of which of its bodies, colliders and joints are which, by the keys the scene
 * graph knows them by. Nothing here needs Rapier, so the page side of a worker
 * (`remotePhysics`) can read the index of a snapshot the worker took.
 *
 * The layout: a format byte; the bodies (each its key, handle, and colliders with their
 * handles and parts); the joints (each its id, handle and bodies); then Rapier's bytes.
 * Counts and string lengths are 32-bit, handles 64-bit floats (Rapier's own numbers),
 * all little-endian.
 *
 * @module
 */

/** A body in a snapshot: its key, Rapier handle, and its colliders'. */
export type IndexedBody = {
  readonly key: string;
  readonly handle: number;
  readonly colliders: ReadonlyArray<{ readonly handle: number; readonly part?: string }>;
};

/** A joint in a snapshot: its id, Rapier handle, and the keys of its bodies. */
export type IndexedJoint = {
  readonly id: string;
  readonly handle: number;
  readonly a: string;
  readonly b: string;
};

export type SnapshotIndex = {
  readonly bodies: ReadonlyArray<IndexedBody>;
  readonly joints: ReadonlyArray<IndexedJoint>;
};

/** The format byte this version writes and reads. */
const format = 1;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Writes `index` and Rapier's `world` bytes as one snapshot. */
export const writeSnapshot = (index: SnapshotIndex, world: Uint8Array): Uint8Array => {
  const parts: Array<Uint8Array> = [Uint8Array.of(format)];
  const count = (value: number): void => {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, value, true);
    parts.push(bytes);
  };
  const handle = (value: number): void => {
    const bytes = new Uint8Array(8);
    new DataView(bytes.buffer).setFloat64(0, value, true);
    parts.push(bytes);
  };
  const text = (value: string): void => {
    const bytes = encoder.encode(value);
    count(bytes.length);
    parts.push(bytes);
  };
  count(index.bodies.length);
  for (const body of index.bodies) {
    text(body.key);
    handle(body.handle);
    count(body.colliders.length);
    for (const collider of body.colliders) {
      handle(collider.handle);
      // A part is written with a leading mark, so that no part and an empty one differ.
      text(collider.part === undefined ? '' : `:${collider.part}`);
    }
  }
  count(index.joints.length);
  for (const joint of index.joints) {
    text(joint.id);
    handle(joint.handle);
    text(joint.a);
    text(joint.b);
  }
  parts.push(world);
  const out = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

/** Reads a snapshot written by `writeSnapshot`: its index, and Rapier's bytes. */
export const readSnapshot = (
  snapshot: Uint8Array,
): { readonly index: SnapshotIndex; readonly world: Uint8Array } => {
  if (snapshot[0] !== format) throw new Error('Not a snapshot of an effect-three Rapier world');
  const view = new DataView(snapshot.buffer, snapshot.byteOffset, snapshot.byteLength);
  let at = 1;
  const count = (): number => {
    const value = view.getUint32(at, true);
    at += 4;
    return value;
  };
  const handle = (): number => {
    const value = view.getFloat64(at, true);
    at += 8;
    return value;
  };
  const text = (): string => {
    const length = count();
    const value = decoder.decode(snapshot.subarray(at, at + length));
    at += length;
    return value;
  };
  function collider(): IndexedBody['colliders'][number] {
    const colliderHandle = handle();
    const part = text();
    return part === ''
      ? { handle: colliderHandle }
      : { handle: colliderHandle, part: part.slice(1) };
  }
  function body(): IndexedBody {
    const key = text();
    const bodyHandle = handle();
    return { key, handle: bodyHandle, colliders: Array.from({ length: count() }, collider) };
  }
  const bodies: Array<IndexedBody> = Array.from({ length: count() }, body);
  const joints: Array<IndexedJoint> = Array.from({ length: count() }, () => ({
    id: text(),
    handle: handle(),
    a: text(),
    b: text(),
  }));
  return { index: { bodies, joints }, world: snapshot.subarray(at) };
};
