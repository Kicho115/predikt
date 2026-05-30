import type { ChartTimeframe, PricePoint } from "@/lib/types";

const CLOB_BASE = "https://clob.polymarket.com";

export const CHART_TIMEFRAMES: ChartTimeframe[] = ["1D", "1W", "1M", "ALL"];

const TIMEFRAME_MAP: Record<
  ChartTimeframe,
  { interval: string; fidelity: number }
> = {
  "1D": { interval: "1d", fidelity: 60 },
  "1W": { interval: "1w", fidelity: 240 },
  "1M": { interval: "1m", fidelity: 720 },
  ALL: { interval: "max", fidelity: 1440 },
};

type HistoryResponse = {
  history?: Array<{ t: number; p: number }>;
};

export async function fetchClobPriceHistory(
  tokenId: string,
  timeframe: ChartTimeframe,
): Promise<PricePoint[]> {
  const { interval, fidelity } = TIMEFRAME_MAP[timeframe];
  const url = new URL(`${CLOB_BASE}/prices-history`);
  url.searchParams.set("market", tokenId);
  url.searchParams.set("interval", interval);
  url.searchParams.set("fidelity", String(fidelity));

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate: 30 },
  });
  if (!res.ok) {
    throw new Error(`CLOB API error: ${res.status}`);
  }

  const data = (await res.json()) as HistoryResponse;
  const history = Array.isArray(data.history) ? data.history : [];
  return history
    .map((point) => ({
      t: Number(point.t),
      p: Number(point.p),
    }))
    .filter((point) => Number.isFinite(point.t) && Number.isFinite(point.p))
    .sort((a, b) => a.t - b.t);
}
