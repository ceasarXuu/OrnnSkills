export interface BoundedCacheOptions {
  readonly maxEntries: number;
  readonly maxAgeMs: number;
  readonly now?: () => number;
}

export interface BoundedCacheSnapshot {
  readonly entries: number;
  readonly maxEntries: number;
  readonly maxAgeMs: number;
}

interface CacheEntry<V> {
  value: V;
  accessedAt: number;
}

export const DEFAULT_DASHBOARD_CACHE_MAX_AGE_MS = 15 * 60 * 1000;

export class BoundedCache<K, V> {
  private readonly store = new Map<K, CacheEntry<V>>();
  private readonly now: () => number;

  constructor(private readonly options: BoundedCacheOptions) {
    this.now = options.now ?? (() => Date.now());
  }

  get(key: K): V | undefined {
    const now = this.now();
    this.pruneExpired(now);

    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }

    if (now - entry.accessedAt > this.options.maxAgeMs) {
      this.store.delete(key);
      return undefined;
    }

    entry.accessedAt = now;
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V): void {
    const now = this.now();
    this.pruneExpired(now);

    if (this.store.has(key)) {
      this.store.delete(key);
    }
    this.store.set(key, { value, accessedAt: now });
    this.evictOverflow();
  }

  clear(): void {
    this.store.clear();
  }

  snapshot(): BoundedCacheSnapshot {
    this.pruneExpired(this.now());
    return {
      entries: this.store.size,
      maxEntries: this.options.maxEntries,
      maxAgeMs: this.options.maxAgeMs,
    };
  }

  private evictOverflow(): void {
    while (this.store.size > this.options.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey === undefined) {
        break;
      }
      this.store.delete(oldestKey);
    }
  }

  private pruneExpired(now: number): void {
    const cutoff = now - this.options.maxAgeMs;
    for (const [key, entry] of this.store) {
      if (entry.accessedAt >= cutoff) {
        continue;
      }
      this.store.delete(key);
    }
  }
}