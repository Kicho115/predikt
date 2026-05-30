import type { MarketSummary } from "@/lib/types";

export const gammaTrendingFetch = {
  pageSize: 120,
  pageCount: 4,
};

function toNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

function parseStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [raw];
    } catch {
      return [raw];
    }
  }
  return [];
}

function parseNumberArray(raw: unknown): number[] {
  if (Array.isArray(raw)) {
    return raw
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
  }
  if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value));
      }
    } catch {
      return [];
    }
  }
  return [];
}

export function parseClobTokenIds(raw: unknown): string[] {
  return parseStringArray(raw);
}

export function parseGammaMarketList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const markets = obj.markets ?? obj.data ?? obj.items;
    if (Array.isArray(markets)) return markets as Record<string, unknown>[];
  }
  return [];
}

function pickYesPrice(m: Record<string, unknown>): number | undefined {
  const direct =
    toOptionalNumber(m.yesPrice) ??
    toOptionalNumber(m.yes_price) ??
    toOptionalNumber(m.lastPrice) ??
    toOptionalNumber(m.last_price) ??
    toOptionalNumber(m.probability);
  if (direct !== undefined) return direct;

  const outcomes = parseStringArray(m.outcomes);
  const prices = parseNumberArray(m.outcomePrices ?? m.outcome_prices);
  if (!outcomes.length || !prices.length) return undefined;

  const yesIndex = outcomes.findIndex(
    (o) => String(o).trim().toLowerCase() === "yes",
  );
  if (yesIndex >= 0 && yesIndex < prices.length) return prices[yesIndex];
  return prices[0];
}

export function normalizeGammaMarket(
  m: Record<string, unknown>,
): MarketSummary | null {
  const slug = typeof m.slug === "string" ? m.slug : "";
  const question = typeof m.question === "string" ? m.question : "";
  if (!slug && !question) return null;

  const tokenIds = parseClobTokenIds(m.clobTokenIds);
  const id = m.id != null ? String(m.id) : null;
  const conditionId =
    typeof m.conditionId === "string"
      ? m.conditionId
      : m.condition_id != null
        ? String(m.condition_id)
        : null;
  const volume = toNumber(m.volume, 0);
  const volume24hr = toNumber(
    m.volume24hr ?? m.volume24h ?? m.volume_24hr ?? m.volume_24h,
    0,
  );
  const priceChange1d = toNumber(
    m.priceChange1d ?? m.price_change_1d ?? m.priceChange24hr,
    0,
  );
  const yesPrice = pickYesPrice(m);
  const endDate =
    typeof m.endDate === "string"
      ? m.endDate
      : typeof m.end_date === "string"
        ? m.end_date
        : null;
  const eventSlug =
    typeof m.eventSlug === "string"
      ? m.eventSlug
      : typeof m.event_slug === "string"
        ? m.event_slug
        : null;

  return {
    id,
    slug,
    question,
    volume: Number.isFinite(volume) ? volume : 0,
    volume24hr: Number.isFinite(volume24hr) ? volume24hr : 0,
    yesPrice,
    priceChange1d: Number.isFinite(priceChange1d) ? priceChange1d : 0,
    endDate,
    eventSlug,
    clobTokenIds: tokenIds,
    conditionId: conditionId ?? toStringOrNull(m.conditionId),
  };
}

export function normalizeGammaMarkets(
  raw: Record<string, unknown>[],
): MarketSummary[] {
  return raw
    .map((item) => normalizeGammaMarket(item))
    .filter((item): item is MarketSummary => item !== null);
}

export function rankTrendingMarkets(markets: MarketSummary[]): MarketSummary[] {
  return [...markets].sort((a, b) => {
    const a24 = a.volume24hr ?? 0;
    const b24 = b.volume24hr ?? 0;
    if (b24 !== a24) return b24 - a24;
    return (b.volume ?? 0) - (a.volume ?? 0);
  });
}
