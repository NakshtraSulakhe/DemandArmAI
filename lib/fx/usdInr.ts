const FALLBACK_RATE = 96.623;
const CACHE_MS = 60 * 60 * 1000;

let cached: { rate: number; at: number } | null = null;

/** Latest USD to INR rate, cached for an hour. Falls back to the RBI reference rate. */
export async function getUsdToInrRate(): Promise<number> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.rate;
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: AbortSignal.timeout(4000),
    });
    const data = await response.json();
    const rate = Number(data?.rates?.INR);
    if (rate > 0) {
      cached = { rate, at: Date.now() };
      return rate;
    }
  } catch (error) {
    console.warn('USD to INR rate lookup failed:', error);
  }
  return cached?.rate || FALLBACK_RATE;
}
