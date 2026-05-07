import { NextRequest, NextResponse } from "next/server";

import type { MarketSummary, PredictRequestBody } from "@/lib/types";

function isMarketSummary(x: unknown): x is MarketSummary {
  if (!x || typeof x !== "object") return false;
  const m = x as Record<string, unknown>;
  return (
    typeof m.slug === "string" &&
    typeof m.question === "string" &&
    typeof m.volume === "number" &&
    Number.isFinite(m.volume) &&
    Array.isArray(m.clobTokenIds) &&
    m.clobTokenIds.every((t) => typeof t === "string") &&
    (m.id === null || typeof m.id === "string") &&
    (m.conditionId === null || typeof m.conditionId === "string")
  );
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const payload = body as PredictRequestBody | null;
  if (!payload || typeof payload !== "object" || !isMarketSummary(payload.market)) {
    return NextResponse.json(
      {
        error:
          "Body debe ser { market: { slug, question, volume, clobTokenIds, id, conditionId } }",
      },
      { status: 400 }
    );
  }

  const inferenceUrl = process.env.INFERENCE_API_URL?.trim();
  if (!inferenceUrl) {
    return NextResponse.json(
      {
        error:
          "INFERENCE_API_URL no está configurada. Añádela en .env.local para habilitar inferencia.",
        code: "INFERENCE_NOT_CONFIGURED",
      },
      { status: 501 }
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const key = process.env.INFERENCE_API_KEY?.trim();
  if (key) headers.Authorization = `Bearer ${key}`;

  try {
    const res = await fetch(inferenceUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = { raw: text };
    }
    const out =
      parsed !== null && typeof parsed === "object"
        ? parsed
        : { result: parsed };
    return NextResponse.json(out, { status: res.status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
