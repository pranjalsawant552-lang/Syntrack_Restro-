// ✅ Shared in-memory request cache/dedup helper.
//
// Why this exists: the HAR-based speed report (17 Sep 2026) showed
// /setting/current, /category/category_list and /product/all_prodcut_list
// each being hit 2-4 TIMES within a single browser session -- not because
// the data changed, but because every page that needs it (ProductsPage,
// PosPage, InvoicesPage, CategoryPage, StockManagementPage, ...) calls its
// own `fetch` on mount with no shared cache. This module gives API helpers
// a one-line way to fix that: identical calls made again within `ttlMs`
// reuse the same result (or the same in-flight promise, so two components
// mounting in the same tick don't even fire two requests) instead of
// re-hitting the network.
//
// This is deliberately NOT a general client-side cache for big paginated
// collections (products/invoices) -- those already fetch only what's on
// screen (see ProductsPage/InvoicesPage). It's for small, slow-changing
// reference data: shop settings, categories, roles, "all products" /
// "all stock" snapshots used by POS-style screens that need the full set.

type CacheEntry<T> = { promise: Promise<T>; expiresAt: number };

const cache = new Map<string, CacheEntry<any>>();

/**
 * Returns the cached value for `key` if it's still fresh (or already in
 * flight), otherwise calls `fn()`, caches the result for `ttlMs`, and
 * returns it. A rejected call is NOT cached, so the next call retries.
 */
export function cachedRequest<T>(key: string, fn: () => Promise<T>, ttlMs = 30_000): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.promise as Promise<T>;

  const promise = fn().catch((err) => {
    // Don't poison the cache with a failed request -- let the next caller retry.
    cache.delete(key);
    throw err;
  });

  cache.set(key, { promise, expiresAt: now + ttlMs });
  return promise;
}

/** Drop every cached entry whose key starts with `prefix` (e.g. after a mutation). */
export function invalidateCache(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}
