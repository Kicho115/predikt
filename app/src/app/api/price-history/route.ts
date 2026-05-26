import { NextRequest, NextResponse } from "next/server";

import { fetchClobPriceHistory } from "@/lib/clob";
import type { ChartTimeframe } from "@/lib/types";

const VALID_TIMEFRAMES = new Set<ChartTimeframe>([
  "1D",
  "1W",
  "1M",
  "ALL",
]);

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const tokenId = (sp.get("tokenId") || "").trim();
  const rawTf = (sp.get("timeframe") || "1D").toUpperCase();
  const timeframe = (
    rawTf === "1S" ? "1W" : rawTf
  ) as ChartTimeframe;

  if (!tokenId) {
    return NextResponse.json({ error: "tokenId is required" }, { status: 400 });
  }
  if (!VALID_TIMEFRAMES.has(timeframe)) {
    return NextResponse.json(
      { error: `Invalid timeframe. Use: ${[...VALID_TIMEFRAMES].join(", ")}` },
      { status: 400 },
    );
  }

  try {
    const history = await fetchClobPriceHistory(tokenId, timeframe);
    return NextResponse.json({ history, timeframe, tokenId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
