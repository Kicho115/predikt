import type { ChartTimeframe, PredictHorizon } from "@/lib/types";

export const PREDICT_HORIZONS: Array<{ id: PredictHorizon; label: string }> = [
  { id: "1d", label: "Next day" },
  { id: "1w", label: "Next week" },
];

export function chartTimeframeToHorizon(
  raw: ChartTimeframe | string,
): PredictHorizon {
  const key = String(raw).trim().toUpperCase();
  switch (key) {
    case "1W":
      return "1w";
    case "1D":
      return "1d";
    case "1M":
    case "ALL":
      return "1w";
    default:
      return "1d";
  }
}

export function horizonLabel(horizon: PredictHorizon): string {
  const match = PREDICT_HORIZONS.find((h) => h.id === horizon);
  return match ? match.label : horizon;
}
