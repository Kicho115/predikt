import { NextRequest, NextResponse } from "next/server";

import { chartTimeframeToHorizon } from "@/lib/horizons";
import {
  localInferenceConfigured,
  runLocalInference,
} from "@/lib/localInference";
import type {
  MarketSummary,
  PredictHorizon,
  PredictModelId,
  PredictRequestBody,
} from "@/lib/types";

function isMarketSummary(x: unknown): x is MarketSummary {
  if (!x || typeof x !== "object") return false;
  const m = x as Record<string, unknown>;
  return (
    typeof m.slug === "string" &&
    typeof m.question === "string" &&
    typeof m.volume === "number" &&
    Number.isFinite(m.volume) &&
    (m.volume24hr === undefined ||
      (typeof m.volume24hr === "number" && Number.isFinite(m.volume24hr))) &&
    (m.eventSlug === undefined ||
      m.eventSlug === null ||
      typeof m.eventSlug === "string") &&
    (m.yesPrice === undefined ||
      (typeof m.yesPrice === "number" && Number.isFinite(m.yesPrice))) &&
    (m.priceChange1d === undefined ||
      (typeof m.priceChange1d === "number" &&
        Number.isFinite(m.priceChange1d))) &&
    (m.endDate === undefined ||
      m.endDate === null ||
      typeof m.endDate === "string") &&
    Array.isArray(m.clobTokenIds) &&
    m.clobTokenIds.every((t) => typeof t === "string") &&
    (m.id === null || typeof m.id === "string") &&
    (m.conditionId === null || typeof m.conditionId === "string")
  );
}

function parseHorizon(raw: unknown): PredictHorizon {
  if (raw === "1d" || raw === "1w") return raw;
  return chartTimeframeToHorizon("1d");
}

function parseModel(raw: unknown): PredictModelId | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed ? trimmed : undefined;
}

async function proxyToInferenceService(
  body: unknown,
  model?: PredictModelId,
): Promise<NextResponse> {
  const inferenceUrl = process.env.INFERENCE_API_URL!.trim();
  const url = new URL(inferenceUrl);
  if (model) url.searchParams.set("model", model);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const key = process.env.INFERENCE_API_KEY?.trim();
  if (key) headers.Authorization = `Bearer ${key}`;

  try {
    const res = await fetch(url.toString(), {
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

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const payload = body as PredictRequestBody | null;
  if (
    !payload ||
    typeof payload !== "object" ||
    !isMarketSummary(payload.market)
  ) {
    return NextResponse.json(
      {
        error: "Body must be { market: { ... }, horizon?: 1d|1w }",
      },
      { status: 400 },
    );
  }

  const horizon = parseHorizon(payload.horizon);
  const model = parseModel(payload.model);
  const requestBody = { ...payload, horizon, model };

  const inferenceUrl = process.env.INFERENCE_API_URL?.trim();
  if (inferenceUrl) {
    return proxyToInferenceService(requestBody, model);
  }

  if (!localInferenceConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "No inference backend. Either set INFERENCE_API_URL or place trained models under processed/models/ and ensure Python is on PATH.",
        code: "INFERENCE_NOT_CONFIGURED",
      },
      { status: 501 },
    );
  }

  const { result, status } = await runLocalInference(payload.market, horizon);
  return NextResponse.json(result, { status });
}
