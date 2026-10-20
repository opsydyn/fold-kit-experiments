/**
 * The assets scenes ask for with `scene({ assets })` (ADR-015), held for the environment:
 * each loaded once however many scenes ask, lent to the store under its id, its load
 * cancelled when no scene asks for it any more, and withdrawn and disposed when the last
 * scene stops asking. Each scene hears whether what it asked for loaded or failed.
 *
 * An asset with coarser `levels` streams in: every level loads at once, each is lent as it
 * arrives if it is finer than what is shown (replacing it), and once the finest is shown
 * the coarser loads still under way are cancelled. Only the finest failing fails it.
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

/**
 * What a scene hears about an asset it asked for: a level of detail shown (0 for the
 * coarsest of its levels, `levels.length` for its URL, the finest), or its finest failed.
 */
export type AssetNotice =
  | ({
      readonly _tag: 'Loaded';
      readonly level: number;
      readonly final: boolean;
    } & Asset &
      Pick<Lent, 'parts' | 'clips'>)
  | ({ readonly _tag: 'Failed'; readonly reason: string } & Asset);

/** Who asks: a mounted scene, by any object that stands for it. */
type Holder = object;

type Notify = (notice: AssetNotice) => void;

type Entry = {
  readonly asset: Asset;
  readonly holders: Set<Holder>;
  /** One a level, coarsest first: aborted once a finer level is shown, or the entry ends. */
  readonly controllers: ReadonlyArray<AbortController>;
  /** The finest level lent so far. */
  shown: { readonly level: number; readonly lent: Lent } | undefined;
  /** Why the finest level could not be loaded, once it could not. */
  failure: string | undefined;
};

const sameAsset = (a: Asset, b: Asset): boolean =>
  a.kind === b.kind &&
  a.url === b.url &&
  a.levels.length === b.levels.length &&
  a.levels.every((level, i) => level === b.levels[i]);

/** Every level's URL, coarsest first: the asset's own URL is the last, and finest. */
const urlsOf = (asset: Asset): ReadonlyArray<string> => [...asset.levels, asset.url];

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

  const loadedNotice = (entry: Entry, level: number, lent: Lent): AssetNotice => ({
    _tag: 'Loaded',
    ...entry.asset,
    level,
    final: level === entry.asset.levels.length,
    parts: lent.parts,
    clips: lent.clips,
  });

  /** What a scene that starts holding an entry hears at once: what is shown, and a failure. */
  const noticesOf = (entry: Entry): ReadonlyArray<AssetNotice> => [
    ...(entry.shown === undefined
      ? []
      : [loadedNotice(entry, entry.shown.level, entry.shown.lent)]),
    ...(entry.failure === undefined
      ? []
      : [{ _tag: 'Failed' as const, ...entry.asset, reason: entry.failure }]),
  ];

  /** Starts loading every level of `asset`; what comes back too late is freed unseen. */
  const start = (asset: Asset): Entry => {
    const urls = urlsOf(asset);
    const finest = urls.length - 1;
    const entry: Entry = {
      asset,
      holders: new Set(),
      controllers: urls.map(() => new AbortController()),
      shown: undefined,
      failure: undefined,
    };
    entries.set(asset.id, entry);
    function current(level: number): boolean {
      return entries.get(asset.id) === entry && entry.controllers[level]?.signal.aborted === false;
    }
    function loaded(level: number) {
      return (lent: Lent): void => {
        if (!current(level) || (entry.shown !== undefined && entry.shown.level >= level)) {
          lent.release();
          return;
        }
        // Lent first, then the coarser one freed: its withdrawal leaves the new loan.
        const before = entry.shown;
        entry.shown = { level, lent };
        before?.lent.release();
        if (level === finest)
          for (const coarser of entry.controllers.slice(0, level)) coarser.abort();
        tellAll(entry, loadedNotice(entry, level, lent));
      };
    }
    function failed(level: number) {
      return (cause: unknown): void => {
        // A coarser level that fails is skipped; only the finest failing fails the asset.
        if (!current(level) || level !== finest) return;
        const reason = reasonOf({ ...asset, url: urls[level] ?? asset.url }, cause);
        entry.failure = reason;
        tellAll(entry, { _tag: 'Failed', ...asset, reason });
      };
    }
    urls.forEach((url, level) => {
      const signal = entry.controllers[level]?.signal ?? AbortSignal.abort();
      load({ ...asset, url }, signal).then(loaded(level), failed(level));
    });
    return entry;
  };

  /** Ends an entry: its loads cancelled, and what it lent withdrawn and freed. */
  const end = (entry: Entry): void => {
    entries.delete(entry.asset.id);
    for (const controller of entry.controllers) controller.abort();
    entry.shown?.lent.release();
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
      for (const notice of noticesOf(entry)) asking.get(holder)?.notify(notice);
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
