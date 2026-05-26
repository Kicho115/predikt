import { NextRequest, NextResponse } from "next/server";

import {
  gammaTrendingFetch,
  normalizeGammaMarkets,
  parseGammaMarketList,
  rankTrendingMarkets,
} from "@/lib/gamma";
import type { MarketSummary } from "@/lib/types";

const GAMMA_BASE = "https://gamma-api.polymarket.com";

async function fetchGammaMarketsPage(
  pageOffset: number,
  pageSize: number,
): Promise<Record<string, unknown>[]> {
  const url = new URL(`${GAMMA_BASE}/markets`);
  url.searchParams.set("closed", "false");
  url.searchParams.set("active", "true");
  url.searchParams.set("limit", String(pageSize));
  url.searchParams.set("offset", String(pageOffset));

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate: 30 },
  });
  if (!res.ok) {
    throw new Error(`Gamma API error: ${res.status}`);
  }
  const data: unknown = await res.json();
  return parseGammaMarketList(data);
}

async function fetchActiveMarketsPool(): Promise<MarketSummary[]> {
  const { pageSize, pageCount } = gammaTrendingFetch;
  const offsets = Array.from({ length: pageCount }, (_, i) => i * pageSize);

  const pages = await Promise.all(
    offsets.map((offset) => fetchGammaMarketsPage(offset, pageSize)),
  );

  const seen = new Set<string>();
  const raw: Record<string, unknown>[] = [];
  for (const page of pages) {
    for (const item of page) {
      const id =
        typeof item.id === "string"
          ? item.id
          : typeof item.slug === "string"
            ? item.slug
            : null;
      if (id && seen.has(id)) continue;
      if (id) seen.add(id);
      raw.push(item);
    }
  }

  return normalizeGammaMarkets(raw);
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(sp.get("limit")) || 100, 1), 500);
  const offset = Math.max(Number(sp.get("offset")) || 0, 0);
  const search = (sp.get("search") || "").trim().toLowerCase();
  const sort = (sp.get("sort") || "trending").toLowerCase();

  let markets: MarketSummary[];
  try {
    const pool = await fetchActiveMarketsPool();
    markets = sort === "trending" ? rankTrendingMarkets(pool) : pool;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const filtered = search
    ? markets.filter(
        (m) =>
          m.question.toLowerCase().includes(search) ||
          m.slug.toLowerCase().includes(search) ||
          (m.eventSlug?.toLowerCase().includes(search) ?? false),
      )
    : markets;

  const page = filtered.slice(offset, offset + limit);

  return NextResponse.json({
    markets: page,
    total: filtered.length,
    limit,
    offset,
    sort: sort === "trending" ? "trending" : "default",
  });
}
