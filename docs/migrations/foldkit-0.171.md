# Upgrading to FoldKit 0.171

For applications using `@opsydyn/astro-foldkit`, `@opsydyn/foldkit-viz`,
`@opsydyn/effect-three-foldkit` or the Zloz family on FoldKit 0.170. It follows the
[0.170 guide](foldkit-0.170.md); the workspace's own notes are in
[releases/foldkit-0.171.md](../releases/foldkit-0.171.md).

Effect does not move: 0.171 stays on `~4.1.0`. If you are coming from the 0.167 line, do the
[0.170 upgrade](foldkit-0.170.md) first, because that one carries Effect 4.0 to 4.1.

## What to install

Every package here widened its FoldKit peer range to `<0.172.0`, so one range now admits both
0.170 and 0.171 and the package and FoldKit no longer have to move together.

| Package                         | First version admitting FoldKit 0.171 | On npm today |
| ------------------------------- | ------------------------------------- | ------------ |
| `@opsydyn/astro-foldkit`        | `0.13.1`                              | `0.13.0`     |
| `@opsydyn/foldkit-viz`          | `0.19.1`                              | `0.19.0`     |
| `@opsydyn/effect-three-foldkit` | `0.6.5`                               | `0.6.4`      |
| `@opsydyn/foldkit-zloz`         | `0.8.0`                               | `0.7.0`      |
| `@opsydyn/foldkit-zloz-elk`     | `0.8.0`                               | `0.6.2`      |
| `@opsydyn/foldkit-zloz-force`   | `0.8.0`                               | `0.6.2`      |
| `@opsydyn/foldkit-zloz-mermaid` | `0.8.0`                               | `0.6.2`      |

**Check the right-hand column before upgrading FoldKit.** A version still on the left of it
has not reached the registry, and installing FoldKit 0.171 beside it fails with `ERESOLVE`,
because the published manifest of an already-released version cannot be rewritten. The
registry state and how each release ships are in
[releases/foldkit-0.171.md](../releases/foldkit-0.171.md#releasing).

```sh
bun add foldkit@~0.171.0 effect@~4.1.0 @opsydyn/astro-foldkit@latest @opsydyn/foldkit-viz@latest
```

## Breaking changes that can reach application code

### A define must declare at least one result Message

`Command.define`, `Mount.define` and `Mount.defineStream` narrowed `messages` to a non-empty
tuple. A define that declared an empty list, or `Schema.Never`, no longer compiles:

```ts
// ✗ no longer compiles
const Ping = Command.define('Ping', { messages: [], execute: ... });
const Ping = Command.define('Ping', { messages: [Schema.Never], execute: ... });

// ✓ a fire-and-forget Command acknowledges with a Message of its own
const Ping = Command.define('Ping', { messages: [Message.CompletedPing], execute: ... });
```

This is the `Completed*` convention: a Command that produced nothing observable still tells
`update` that it finished, and the Model can act on that or ignore it.

A **generic factory** that forwards its caller's Messages cannot name the tuple itself. Use
the exported helper rather than a bare array type:

```ts
// ✗ widens back to a possibly-empty array
const make = <Messages extends ReadonlyArray<Schema.Schema.Any>>(messages: Messages) => ...

// ✓ carries the non-empty constraint through
const make = <Messages extends Command.ResultMessageSchemas<Messages>>(messages: Messages) => ...
```

`Mount.ResultMessageSchemas` is the equivalent for the two Mount factories.

### `createKeyedLazy` releases unused keys by default

`evict` now defaults to `AbsentFromRender`: after a completed render, entries whose keys were
not used are released. That bounds the cache to the latest render, including entries beneath a
cached parent, and cache writes roll back if view construction fails.

If you relied on entries surviving renders where their key is absent, pass the old behaviour
explicitly:

```ts
const keyed = createKeyedLazy({ evict: 'None' });
```

Use `'None'` **only for a bounded key set** — an entity registry, a route table, fixed call
sites. Every retained entry holds its VNode, and that VNode holds its DOM element, after the
element has left the document.

## New APIs worth adopting

### `createKeyedLazy` in place of a hand-rolled slot map

A `Map` of `createLazy` slots plus a pass that deletes the keys absent from the render is now
the library default. One `createKeyedLazy` replaces both:

```ts
// before: a slot map and its own eviction
const slots = new Map<string, ReturnType<typeof createLazy>>();
const present = new Set(entries.map(({ edge }) => edge.id));
for (const id of slots.keys()) if (!present.has(id)) slots.delete(id);
const slot = slots.get(entry.edge.id) ?? createLazy();
slots.set(entry.edge.id, slot);
return slot(row, [h, entry.edge.id, entry.label]);

// after
const keyed = createKeyedLazy();
return keyed(entry.edge.id, row, [h, entry.edge.id, entry.label]);
```

Key by the identifier that already gives the thing its DOM identity — the same value passed to
`h.Key` — so the memo and the DOM invalidate together.

**Do not convert a `WeakMap` keyed by an object.** A cache keyed by a node or entity _object_
dies with that object; `createKeyedLazy` takes a `PropertyKey` and holds it strongly, so
converting one reintroduces a registry of deleted ids. Keep the `WeakMap`.

### Three improvements that need no code change

- **Rendering is no longer postponed indefinitely under sustained Message traffic.** A stream
  of Messages arriving faster than frames — a `pointermove` listener dispatching one Message
  per event, say — could previously starve the render. If you worked around this by throttling
  input before dispatch, that workaround may no longer be needed; measure before removing it.
- **`Subscription.animationFrameEntry` dispatches in the frame it was scheduled in**, not the
  next one, so every animation loop loses a frame of latency.
- **`EmbedHandle.disposeAsync`** lets a host await runtime shutdown and container restoration
  instead of firing `dispose` and hoping. Await it before embedding a different program in the
  same container. Mount finalizers may still finish after it resolves.

## Checking an upgrade

- **Types:** run your type checker. Both breaking changes fail at compile time, so a clean
  typecheck is most of the upgrade.
- **Production build:** build the site. `astro-foldkit` checks the build identity and adds
  module preloads for islands at build time.
- **The packages' contracts:** the packages publish their API surface in `etc/api-surface.md`,
  so an upgrade's surface changes show in its diff.
