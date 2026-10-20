/**
 * The assets scenes ask for with `scene({ assets })` (ADR-015), held for the environment:
 * each loaded once however many scenes ask, lent to the store under its id, its load
 * cancelled when no scene asks for it any more, and withdrawn and disposed when the last
 * scene stops asking. Each scene hears whether what it asked for loaded or failed.
 *
 * An id names one asset at a time: a scene asking for an id another scene holds as
 * something else (another kind or URL) is told it failed, and gets it once the other lets
 * go.
 *
 * @module
 */
import { type Asset, assetsEqual } from '@opsydyn/effect-three';

/** An asset as loaded and lent: what a model offers, and how to withdraw and free it. */
export type Lent = {
  readonly parts: ReadonlyArray<string>;
  readonly clips: ReadonlyArray<string>;
  readonly release: () => void;
};

/** Loads one asset and lends it under its id; gives up (rejecting) when `signal` aborts. */
export type AssetLoader = (asset: Asset, signal: AbortSignal) => Promise<Lent>;

/** What a scene hears about an asset it asked for. */
export type AssetNotice =
  | ({ readonly _tag: 'Loaded' } & Asset & Pick<Lent, 'parts' | 'clips'>)
  | ({ readonly _tag: 'Failed'; readonly reason: string } & Asset);

/** Who asks: a mounted scene, by any object that stands for it. */
type Holder = object;

type Notify = (notice: AssetNotice) => void;

type State =
  | { readonly _tag: 'Loading'; readonly controller: AbortController }
  | { readonly _tag: 'Loaded'; readonly lent: Lent }
  | { readonly _tag: 'Failed'; readonly reason: string };

type Entry = { readonly asset: Asset; readonly holders: Set<Holder>; state: State };

const sameAsset = (a: Asset, b: Asset): boolean => a.kind === b.kind && a.url === b.url;

const reasonOf = (asset: Asset, cause: unknown): string =>
  cause instanceof Error && cause.message !== ''
    ? `Could not load ${asset.url}: ${cause.message}`
    : `Could not load ${asset.url}`;

const taken = (asset: Asset, holding: Asset): AssetNotice => ({
  _tag: 'Failed',
  ...asset,
  reason: `"${asset.id}" is already ${holding.url} for another scene`,
});

/** Creates the registry for one environment, loading with `load`. */
export const makeAssetRegistry = (load: AssetLoader) => {
  const entries = new Map<string, Entry>();
  /** What each scene asks for now, and how to tell it. */
  const asking = new Map<
    Holder,
    { readonly assets: ReadonlyArray<Asset>; readonly notify: Notify }
  >();

  const tellAll = (entry: Entry, notice: AssetNotice): void => {
    for (const holder of entry.holders) asking.get(holder)?.notify(notice);
  };

  const noticeOf = (entry: Entry): AssetNotice | undefined => {
    const { state, asset } = entry;
    if (state._tag === 'Loaded') {
      return { _tag: 'Loaded', ...asset, parts: state.lent.parts, clips: state.lent.clips };
    }
    if (state._tag === 'Failed') return { _tag: 'Failed', ...asset, reason: state.reason };
    return undefined;
  };

  /** Starts loading `asset`; what comes back after the entry has gone is freed unseen. */
  const start = (asset: Asset): Entry => {
    const controller = new AbortController();
    const entry: Entry = { asset, holders: new Set(), state: { _tag: 'Loading', controller } };
    entries.set(asset.id, entry);
    function current(): boolean {
      return entries.get(asset.id) === entry && !controller.signal.aborted;
    }
    function loaded(lent: Lent): void {
      if (!current()) {
        lent.release();
        return;
      }
      entry.state = { _tag: 'Loaded', lent };
      tellAll(entry, { _tag: 'Loaded', ...asset, parts: lent.parts, clips: lent.clips });
    }
    function failed(cause: unknown): void {
      if (!current()) return;
      const reason = reasonOf(asset, cause);
      entry.state = { _tag: 'Failed', reason };
      tellAll(entry, { _tag: 'Failed', ...asset, reason });
    }
    load(asset, controller.signal).then(loaded, failed);
    return entry;
  };

  /** Ends an entry: its load cancelled, or what it lent withdrawn and freed. */
  const end = (entry: Entry): void => {
    entries.delete(entry.asset.id);
    if (entry.state._tag === 'Loading') entry.state.controller.abort();
    if (entry.state._tag === 'Loaded') entry.state.lent.release();
  };

  /** `holder` lets go of `id`; the last to let go ends it, and whoever waited on it asks again. */
  const letGo = (holder: Holder, id: string): void => {
    const entry = entries.get(id);
    if (entry === undefined || !entry.holders.delete(holder) || entry.holders.size > 0) return;
    end(entry);
    for (const [waiting, { assets }] of asking) {
      if (assets.some((asset) => asset.id === id)) hold(waiting, assets);
    }
  };

  /** `holder` takes each of `assets` it does not hold yet. */
  const hold = (holder: Holder, assets: ReadonlyArray<Asset>): void => {
    for (const asset of assets) {
      const entry = entries.get(asset.id) ?? start(asset);
      if (!sameAsset(entry.asset, asset)) {
        asking.get(holder)?.notify(taken(asset, entry.asset));
        continue;
      }
      if (entry.holders.has(holder)) continue;
      entry.holders.add(holder);
      const notice = noticeOf(entry);
      if (notice !== undefined) asking.get(holder)?.notify(notice);
    }
  };

  /**
   * What `holder` asks for now: loads what is new, lets go of what it no longer asks for
   * (or asks for as something else), and tells it, through `notify`, when each asset it
   * holds has loaded or failed (at once, for one loaded already).
   */
  const want = (holder: Holder, assets: ReadonlyArray<Asset>, notify: Notify): void => {
    const before = asking.get(holder);
    asking.set(holder, { assets, notify });
    if (before !== undefined && assetsEqual(before.assets, assets)) return;
    for (const old of before?.assets ?? []) {
      const still = assets.find((asset) => asset.id === old.id);
      if (still === undefined || !sameAsset(still, old)) letGo(holder, old.id);
    }
    hold(holder, assets);
  };

  /** `holder` (a scene going away) asks for nothing any more. */
  const release = (holder: Holder): void => {
    want(holder, [], () => undefined);
    asking.delete(holder);
  };

  /** Ends every load and frees every asset (the environment going away). */
  const dispose = (): void => {
    asking.clear();
    for (const entry of [...entries.values()]) end(entry);
  };

  return { want, release, dispose };
};

export type AssetRegistry = ReturnType<typeof makeAssetRegistry>;
