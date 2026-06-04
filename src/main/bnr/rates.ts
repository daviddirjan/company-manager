interface CachedRates {
  rates: Record<string, number>;
  fetchedAt: number;
}

let cache: CachedRates | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function fetchBNRRates(): Promise<Record<string, number>> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
    return cache.rates;
  }

  try {
    const res = await fetch('https://www.bnr.ro/nbrfxrates.xml', {
      signal: AbortSignal.timeout(10_000),
    });
    const xml = await res.text();
    const rates: Record<string, number> = { RON: 1 };
    const re = /<Rate currency="([A-Z]+)"(?:\s+multiplier="(\d+)")?>([\d.]+)<\/Rate>/g;
    for (const [, currency, multiplier, rate] of xml.matchAll(re)) {
      rates[currency] = parseFloat(rate) / (multiplier ? parseInt(multiplier) : 1);
    }
    cache = { rates, fetchedAt: Date.now() };
    return rates;
  } catch {
    return cache?.rates ?? { RON: 1 };
  }
}
