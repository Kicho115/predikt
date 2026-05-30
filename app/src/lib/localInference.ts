import type { MarketSummary, PredictHorizon } from "@/lib/types";

type LocalInferenceResponse = {
  result: Record<string, unknown>;
  status: number;
};

export function localInferenceConfigured(): boolean {
  return false;
}

export async function runLocalInference(
  _market: MarketSummary,
  _horizon: PredictHorizon,
): Promise<LocalInferenceResponse> {
  return {
    result: {
      ok: false,
      error:
        "Local inference not configured. Set INFERENCE_API_URL to your backend.",
      code: "LOCAL_INFERENCE_DISABLED",
    },
    status: 501,
  };
}
