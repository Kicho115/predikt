import type { PricePoint } from "@/lib/types";

type ChartPaths = {
  viewBox: string;
  line: string;
  area: string;
};

const CHART_WIDTH = 560;
const CHART_HEIGHT = 176;

export function buildPriceChartPaths(points: PricePoint[]): ChartPaths | null {
  if (!Array.isArray(points) || points.length < 2) return null;

  const filtered = points.filter(
    (p) => Number.isFinite(p.p) && Number.isFinite(p.t),
  );
  if (filtered.length < 2) return null;

  const times = filtered.map((p) => p.t);
  const prices = filtered.map((p) => p.p);
  const minT = Math.min(...times);
  const maxT = Math.max(...times);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const tRange = maxT - minT || filtered.length - 1 || 1;
  const pRange = maxP - minP || 1;

  const coords = filtered.map((p, idx) => {
    const x = tRange
      ? ((p.t - minT) / tRange) * CHART_WIDTH
      : (idx / (filtered.length - 1)) * CHART_WIDTH;
    const y = CHART_HEIGHT - ((p.p - minP) / pRange) * CHART_HEIGHT;
    return { x, y };
  });

  const line = coords
    .map(
      (pt, idx) =>
        `${idx === 0 ? "M" : "L"}${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`,
    )
    .join(" ");
  const area = `${line} L ${CHART_WIDTH} ${CHART_HEIGHT} L 0 ${CHART_HEIGHT} Z`;

  return {
    viewBox: `0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`,
    line,
    area,
  };
}

export function formatEndDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatPriceDelta(delta: number): string {
  if (!Number.isFinite(delta)) return "-";
  const pct = delta * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

export function formatProbPercent(value: number): string {
  if (!Number.isFinite(value)) return "-";
  return `${(value * 100).toFixed(1)}%`;
}

export function formatVolumeUsd(value: number): string {
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
