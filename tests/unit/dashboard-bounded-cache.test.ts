import { describe, expect, it } from 'vitest';
import { BoundedCache } from '../../src/dashboard/readers/bounded-cache.js';

describe('dashboard bounded cache', () => {
  it('evicts least recently used entries when max entries is exceeded', () => {
    let now = 1_000;
    const cache = new BoundedCache<string, number>({
      maxEntries: 2,
      maxAgeMs: 5_000,
      now: () => now,
    });

    cache.set('a', 1);
    now += 1;
    cache.set('b', 2);
    now += 1;
    expect(cache.get('a')).toBe(1);
    now += 1;
    cache.set('c', 3);

    expect(cache.snapshot().entries).toBe(2);
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBe(3);
  });

  it('expires stale entries based on max age', () => {
    let now = 2_000;
    const cache = new BoundedCache<string, string>({
      maxEntries: 3,
      maxAgeMs: 100,
      now: () => now,
    });

    cache.set('fresh', 'value');
    now += 101;

    expect(cache.get('fresh')).toBeUndefined();
    expect(cache.snapshot().entries).toBe(0);
  });
});