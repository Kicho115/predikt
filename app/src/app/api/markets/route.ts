import { NextRequest, NextResponse } from "next/server";

import { normalizeGammaMarket } from "@/lib/gamma";
import type { MarketSummary } from "@/lib/types";

const GAMMA_BASE = "https://gamma-api.polymarket.com";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(sp.get("limit")) || 100, 1), 500);
  const offset = Math.max(Number(sp.get("offset")) || 0, 0);
  const search = (sp.get("search") || "").trim().toLowerCase();

  const url = new URL(`${GAMMA_BASE}/markets`);
  url.searchParams.set("closed", "false");
  url.searchParams.set("active", "true");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));

  let data: unknown;
  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 30 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Gamma API error: ${res.status}` },
        { status: res.status }
      );
    }
    data = await res.json();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const rawList = Array.isArray(data)
    ? data
    : data !== null &&
        typeof data === "object" &&
        "markets" in data &&
        Array.isArray((data as { markets: unknown }).markets)
      ? (data as { markets: unknown[] }).markets
      : [];

  const markets: MarketSummary[] = [];
  for (const item of rawList) {
    if (item !== null && typeof item === "object") {
      const n = normalizeGammaMarket(item as Record<string, unknown>);
      if (n) markets.push(n);
    }
  }

  const filtered = search
    ? markets.filter(
        (m) =>
          m.question.toLowerCase().includes(search) ||
          m.slug.toLowerCase().includes(search)
      )
    : markets;

  return NextResponse.json({
    markets: filtered,
    total: filtered.length,
    limit,
    offset,
  });
}
