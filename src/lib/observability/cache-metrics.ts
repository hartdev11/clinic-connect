/**
 * Cache hit/miss counters for analytics Redis cache. Fail-safe: never throws.
 */
let cacheHitTotal = 0;
let cacheMissTotal = 0;

export function recordCacheHit(): void {
  try {
    cacheHitTotal += 1;
    if (process.env.OBS_LOG_CACHE === "true") {
      console.log(
        JSON.stringify({
          type: "cache_hit",
          timestamp: new Date().toISOString(),
          totalHits: cacheHitTotal,
          totalMisses: cacheMissTotal,
        })
      );
    }
  } catch {
    // no-op
  }
}

export function recordCacheMiss(): void {
  try {
    cacheMissTotal += 1;
    if (process.env.OBS_LOG_CACHE === "true") {
      console.log(
        JSON.stringify({
          type: "cache_miss",
          timestamp: new Date().toISOString(),
          totalHits: cacheHitTotal,
          totalMisses: cacheMissTotal,
        })
      );
    }
  } catch {
    // no-op
  }
}

export function getCacheTotals(): { totalHits: number; totalMisses: number } {
  return { totalHits: cacheHitTotal, totalMisses: cacheMissTotal };
}

export function getCacheHitRate(): number {
  const total = cacheHitTotal + cacheMissTotal;
  return total > 0 ? cacheHitTotal / total : 0;
}
