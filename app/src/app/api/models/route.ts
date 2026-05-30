import { NextResponse } from "next/server";

const DEFAULT_MODELS = {
  default: "lstm_baseline",
  models: [
    { id: "lstm_baseline", label: "LSTM baseline", type: "lstm" },
    { id: "lstm_attention", label: "LSTM attention", type: "lstm" },
    { id: "sk_model_rf", label: "SK random forest", type: "sklearn" },
    { id: "sk_model_gb", label: "SK gradient boosting", type: "sklearn" },
  ],
};

function buildModelsUrl(base: string): string {
  const url = new URL(base);
  url.search = "";
  if (url.pathname.endsWith("/predict")) {
    url.pathname = url.pathname.replace(/\/predict\/?$/, "/models");
  } else {
    url.pathname = `${url.pathname.replace(/\/$/, "")}/models`;
  }
  return url.toString();
}

export async function GET() {
  const inferenceUrl = process.env.INFERENCE_API_URL?.trim();
  if (!inferenceUrl) {
    return NextResponse.json(DEFAULT_MODELS);
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  const key = process.env.INFERENCE_API_KEY?.trim();
  if (key) headers.Authorization = `Bearer ${key}`;

  try {
    const res = await fetch(buildModelsUrl(inferenceUrl), {
      headers,
    });
    if (!res.ok) {
      return NextResponse.json(DEFAULT_MODELS, { status: res.status });
    }
    const data = await res.json();
    if (data && typeof data === "object") {
      return NextResponse.json(data);
    }
    return NextResponse.json(DEFAULT_MODELS);
  } catch (e) {
    return NextResponse.json(DEFAULT_MODELS, { status: 502 });
  }
}
