export type MarketSummary = {
  id: string | null;
  slug: string;
  question: string;
  volume: number;
  clobTokenIds: string[];
  conditionId: string | null;
  volume24hr?: number;
  yesPrice?: number;
  priceChange1d?: number;
  endDate?: string | null;
  eventSlug?: string | null;
};

export type ChartTimeframe = "1D" | "1W" | "1M" | "ALL";

export type PredictHorizon = "1d" | "1w";

export type PredictModelId = string;

export type PricePoint = {
  t: number;
  p: number;
};

export type PredictRequestBody = {
  market: MarketSummary;
  horizon?: PredictHorizon;
  model?: PredictModelId;
};

export type ModelInfo = {
  id: string;
  label?: string;
  available?: boolean;
  type?: string;
  horizon?: PredictHorizon | string;
};

export type PredictResult = {
  ok?: boolean;
  direction?: "up" | "down";
  label?: number;
  probability_up?: number;
  probability_down?: number;
  threshold?: number;
  model?: string;
  model_label?: string;
  horizon?: PredictHorizon;
  horizon_label?: string;
  as_of_date?: string;
  current_price?: number;
  n_prices?: number;
  slug?: string;
  question?: string;
  token_id?: string;
  predicted_at?: string;
  error?: string;
  code?: string;
};
