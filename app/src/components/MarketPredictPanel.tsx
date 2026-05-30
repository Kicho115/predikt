"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import { CHART_TIMEFRAMES } from "@/lib/clob";
import {
  chartTimeframeToHorizon,
  horizonLabel,
  PREDICT_HORIZONS,
} from "@/lib/horizons";
import {
  buildPriceChartPaths,
  formatEndDate,
  formatPriceDelta,
  formatProbPercent,
  formatVolumeUsd,
} from "@/lib/chart";
import type {
  ChartTimeframe,
  MarketSummary,
  PredictHorizon,
  PredictModelId,
  PredictResult,
  PricePoint,
} from "@/lib/types";

import styles from "./MarketPredictPanel.module.css";

type MarketsResponse = {
  markets: MarketSummary[];
  total: number;
};

function SummaryItem({
  label,
  value,
  full,
  mono,
}: {
  label: string;
  value: string;
  full?: boolean;
  mono?: boolean;
}) {
  return (
    <div
      className={`${styles.summaryItem}${full ? ` ${styles.summaryItemFull}` : ""}`}
    >
      <dt className={styles.summaryLabel}>{label}</dt>
      <dd
        className={`${styles.summaryValue}${mono ? ` ${styles.summaryValueMono}` : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

type PriceHistoryResponse = {
  history: PricePoint[];
};

const MODEL_OPTIONS: Array<{ id: PredictModelId; label: string }> = [
  { id: "lstm_baseline", label: "LSTM baseline" },
  { id: "lstm_attention", label: "LSTM attention" },
];

function MarketPriceChart({
  points,
  gradientId,
}: {
  points: PricePoint[];
  gradientId: string;
}) {
  const paths = buildPriceChartPaths(points);
  if (!paths) return null;

  return (
    <svg
      className={styles.chartSvg}
      viewBox={paths.viewBox}
      preserveAspectRatio="none"
      role="img"
      aria-label="Polymarket price history"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1f5bff" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#1f5bff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3, 4].map((i) => (
        <line
          key={`h-${i}`}
          x1="0"
          y1={44 * i}
          x2="560"
          y2={44 * i}
          stroke="rgba(15, 23, 42, 0.06)"
          strokeWidth="1"
        />
      ))}
      <path d={paths.area} fill={`url(#${gradientId})`} />
      <path
        d={paths.line}
        fill="none"
        stroke="#1f5bff"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function displayYesPrice(market: MarketSummary, history: PricePoint[]): number {
  const last = history.length > 0 ? history[history.length - 1].p : null;
  if (last !== null && Number.isFinite(last)) return last;
  return market.yesPrice;
}

type MarketPredictPanelProps = {
  onBack: () => void;
};

export function MarketPredictPanel({ onBack }: MarketPredictPanelProps) {
  const [markets, setMarkets] = useState<MarketSummary[]>([]);
  const [marketsLoading, setMarketsLoading] = useState(true);
  const [marketsError, setMarketsError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<MarketSummary | null>(null);

  const [predictLoading, setPredictLoading] = useState(false);
  const [predictError, setPredictError] = useState<string | null>(null);
  const [predictResult, setPredictResult] = useState<PredictResult | null>(
    null,
  );

  const [timeframe, setTimeframe] = useState<ChartTimeframe>("1D");
  const [predictHorizon, setPredictHorizon] = useState<PredictHorizon>("1d");
  const [predictModel, setPredictModel] =
    useState<PredictModelId>("lstm_baseline");
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const chartGradientId = useMemo(
    () => `chartFill-${selected?.slug ?? "empty"}`,
    [selected?.slug],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setMarketsLoading(true);
      setMarketsError(null);
      try {
        const res = await fetch("/api/markets?limit=200&sort=trending");
        const data: unknown = await res.json();
        if (!res.ok) {
          const err =
            data &&
            typeof data === "object" &&
            "error" in data &&
            typeof (data as { error: unknown }).error === "string"
              ? (data as { error: string }).error
              : `Error ${res.status}`;
          throw new Error(err);
        }
        const parsed = data as MarketsResponse;
        if (!cancelled) {
          setMarkets(Array.isArray(parsed.markets) ? parsed.markets : []);
        }
      } catch (e) {
        if (!cancelled) {
          setMarketsError(
            e instanceof Error ? e.message : "Could not load markets.",
          );
          setMarkets([]);
        }
      } finally {
        if (!cancelled) setMarketsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return markets;
    return markets.filter(
      (m) =>
        m.question.toLowerCase().includes(q) ||
        m.slug.toLowerCase().includes(q),
    );
  }, [markets, query]);

  useEffect(() => {
    if (!selected?.clobTokenIds[0]) {
      setPriceHistory([]);
      setChartError(null);
      setChartLoading(false);
      return;
    }

    const tokenId = selected.clobTokenIds[0];
    const controller = new AbortController();

    async function loadHistory() {
      setChartLoading(true);
      setChartError(null);
      try {
        const res = await fetch(
          `/api/price-history?tokenId=${encodeURIComponent(tokenId)}&timeframe=${timeframe}`,
          { signal: controller.signal },
        );
        const data: unknown = await res.json();
        if (!res.ok) {
          const err =
            data &&
            typeof data === "object" &&
            "error" in data &&
            typeof (data as { error: unknown }).error === "string"
              ? (data as { error: string }).error
              : `Error ${res.status}`;
          throw new Error(err);
        }
        const parsed = data as PriceHistoryResponse;
        if (!controller.signal.aborted) {
          setPriceHistory(Array.isArray(parsed.history) ? parsed.history : []);
        }
      } catch (e) {
        if (controller.signal.aborted) return;
        setPriceHistory([]);
        setChartError(
          e instanceof Error ? e.message : "Could not load price history.",
        );
      } finally {
        if (!controller.signal.aborted) setChartLoading(false);
      }
    }

    loadHistory();
    return () => {
      controller.abort();
      setChartLoading(false);
    };
  }, [selected, timeframe]);

  const liveYesPrice = selected
    ? displayYesPrice(selected, priceHistory)
    : null;
  const priceDeltaPp = selected ? Math.round(selected.priceChange1d * 100) : 0;

  async function handlePredict() {
    if (!selected) return;
    setPredictLoading(true);
    setPredictError(null);
    setPredictResult(null);
    try {
      const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          market: selected,
          horizon: predictHorizon,
          model: predictModel,
        }),
      });
      const data = (await res.json()) as PredictResult & { error?: string };
      if (data.ok && data.direction) {
        setPredictResult(data);
        setPredictError(null);
      } else {
        setPredictResult(null);
        setPredictError(
          data.error ||
            (typeof data === "object" &&
            "error" in data &&
            typeof data.error === "string"
              ? data.error
              : `Error ${res.status}`),
        );
      }
    } catch (e) {
      setPredictError(e instanceof Error ? e.message : "Network error");
    } finally {
      setPredictLoading(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <header className={styles.dashboardHeader}>
        <Image
          src="/Predikt.png"
          alt="Predikt"
          width={320}
          height={86}
          className={styles.brandLogo}
          priority
        />

        <div className={styles.searchBar}>
          <input
            id="market-search"
            className={styles.searchInput}
            type="search"
            placeholder="Search Markets, themes, trends, etc."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={marketsLoading || !!marketsError}
            autoComplete="off"
          />
          <button
            type="button"
            className={styles.searchBtn}
            aria-label="Search"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <button type="button" className={styles.signOutBtn} onClick={onBack}>
          Sign Out
        </button>
      </header>

      <div className={styles.mainGrid}>
        <aside className={styles.panelCol}>
          <h2 className={styles.sectionTitle}>Active Trending markets</h2>
          <div className={styles.marketsCard}>
            {marketsLoading && (
              <p className={styles.status}>Loading markets…</p>
            )}
            {marketsError && (
              <p className={`${styles.status} ${styles.error}`}>
                {marketsError}
              </p>
            )}
            {!marketsLoading && !marketsError && filtered.length === 0 && (
              <p className={styles.empty}>No matching markets.</p>
            )}
            {!marketsLoading && !marketsError && filtered.length > 0 && (
              <MarketsScrollArea>
                <MarketsList
                  filtered={filtered}
                  selected={selected}
                  onSelect={(m) => {
                    setSelected(m);
                    setPredictResult(null);
                    setPredictError(null);
                  }}
                />
              </MarketsScrollArea>
            )}
          </div>
        </aside>

        <section className={styles.panelCol}>
          <div className={styles.sectionTitleSpacer} aria-hidden="true" />
          <div className={styles.detailCard}>
            <div className={styles.detailBody}>
              <div className={styles.chartPanel}>
                <div className={styles.chartTop}>
                  <div className={styles.probBlock}>
                    <span className={styles.probWord}>Sí</span>
                    <div className={styles.probRow}>
                      <span className={styles.probValue}>
                        {liveYesPrice !== null
                          ? formatProbPercent(liveYesPrice)
                          : "—"}
                      </span>
                      <span className={styles.probLabel}>probabilidad</span>
                    </div>
                    {selected && priceDeltaPp !== 0 && (
                      <div className={styles.probChangeRow}>
                        <span className={styles.probChangeLabel}>24h</span>
                        <span
                          className={`${styles.probDelta}${
                            selected.priceChange1d < 0
                              ? ` ${styles.probDeltaDown}`
                              : ""
                          }`}
                        >
                          {formatPriceDelta(selected.priceChange1d)}
                        </span>
                      </div>
                    )}
                  </div>
                  <span className={styles.platformTag}>Polymarket</span>
                </div>

                <div className={styles.chartCanvas}>
                  {!selected && (
                    <div className={styles.chartOverlay}>
                      Select a market to view price history
                    </div>
                  )}
                  {selected && chartLoading && (
                    <div className={styles.chartOverlay}>Loading chart…</div>
                  )}
                  {selected && !chartLoading && chartError && (
                    <div
                      className={`${styles.chartOverlay} ${styles.chartOverlayError}`}
                    >
                      {chartError}
                    </div>
                  )}
                  {selected &&
                    !chartLoading &&
                    !chartError &&
                    priceHistory.length >= 2 && (
                      <MarketPriceChart
                        points={priceHistory}
                        gradientId={chartGradientId}
                      />
                    )}
                  {selected &&
                    !chartLoading &&
                    !chartError &&
                    priceHistory.length < 2 && (
                      <div className={styles.chartOverlay}>
                        Not enough price data for this range
                      </div>
                    )}
                </div>

                <div className={styles.chartFooter}>
                  <div className={styles.chartMetaLeft}>
                    <span>
                      {selected ? formatVolumeUsd(selected.volume) : "—"}
                    </span>
                    <span>
                      {selected ? formatEndDate(selected.endDate) : "—"}
                    </span>
                  </div>
                  <div className={styles.chartTimeframes}>
                    {CHART_TIMEFRAMES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={`${styles.timeframeBtn}${
                          timeframe === t ? ` ${styles.timeframeBtnActive}` : ""
                        }`}
                        disabled={!selected}
                        onClick={() => {
                          setTimeframe(t);
                          setPredictHorizon(chartTimeframeToHorizon(t));
                          setPredictResult(null);
                          setPredictError(null);
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <aside className={styles.marketSidebar}>
                <h3 className={styles.sidebarTitle}>Selected market</h3>
                {selected ? (
                  <dl className={styles.summaryGrid}>
                    <SummaryItem
                      full
                      label="Question"
                      value={selected.question}
                    />
                    <SummaryItem
                      label="Slug"
                      value={selected.slug || "—"}
                      mono
                    />
                    <SummaryItem
                      label="Volume (total)"
                      value={selected.volume.toLocaleString("en")}
                    />
                    <SummaryItem
                      label="Volume (24h)"
                      value={selected.volume24hr.toLocaleString("en")}
                    />
                    <SummaryItem
                      full
                      label="Tokens CLOB"
                      value={
                        selected.clobTokenIds.length
                          ? selected.clobTokenIds.join(", ")
                          : "—"
                      }
                      mono
                    />
                  </dl>
                ) : (
                  <p className={styles.sidebarEmpty}>
                    Choose a market from the list.
                  </p>
                )}
              </aside>
            </div>

            <div className={styles.detailActions}>
              <div
                className={styles.horizonPicker}
                role="group"
                aria-label="Modelo"
              >
                <span className={styles.horizonPickerLabel}>Modelo</span>
                {MODEL_OPTIONS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`${styles.horizonBtn}${
                      predictModel === m.id ? ` ${styles.horizonBtnActive}` : ""
                    }`}
                    disabled={!selected || predictLoading}
                    onClick={() => {
                      setPredictModel(m.id);
                      setPredictResult(null);
                      setPredictError(null);
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <div
                className={styles.horizonPicker}
                role="group"
                aria-label="Horizonte de predicción"
              >
                <span className={styles.horizonPickerLabel}>Horizonte</span>
                {PREDICT_HORIZONS.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    className={`${styles.horizonBtn}${
                      predictHorizon === h.id
                        ? ` ${styles.horizonBtnActive}`
                        : ""
                    }`}
                    disabled={!selected || predictLoading}
                    onClick={() => {
                      setPredictHorizon(h.id);
                      setPredictResult(null);
                      setPredictError(null);
                    }}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={styles.prediktNowBtn}
                disabled={!selected || predictLoading}
                onClick={handlePredict}
              >
                <Image
                  src="/logo-predikt.png"
                  alt=""
                  width={28}
                  height={28}
                  className={styles.prediktIcon}
                />
                <span>{predictLoading ? "Predicting…" : "Predikt Now"}</span>
              </button>
            </div>
          </div>
        </section>
      </div>

      {(predictError || predictResult) && (
        <div className={styles.inferenceCard}>
          <h3 className={styles.inferenceTitle}>
            Predicción ML (
            {predictResult?.horizon_label ?? horizonLabel(predictHorizon)})
          </h3>
          {predictError && (
            <p className={`${styles.status} ${styles.error}`}>{predictError}</p>
          )}
          {predictResult?.direction && (
            <PredictionSummary result={predictResult} />
          )}
        </div>
      )}
    </div>
  );
}

function PredictionSummary({ result }: { result: PredictResult }) {
  const isUp = result.direction === "up";
  const prob = isUp ? result.probability_up : result.probability_down;
  const probPct =
    prob !== undefined && Number.isFinite(prob)
      ? `${(prob * 100).toFixed(1)}%`
      : "—";

  return (
    <div className={styles.predictionBlock}>
      <div
        className={`${styles.predictionBadge} ${
          isUp ? styles.predictionUp : styles.predictionDown
        }`}
      >
        <span className={styles.predictionArrow} aria-hidden="true">
          {isUp ? "↑" : "↓"}
        </span>
        <span className={styles.predictionLabel}>{isUp ? "UP" : "DOWN"}</span>
      </div>
      <dl className={styles.predictionMeta}>
        <div>
          <dt>Confianza</dt>
          <dd>{probPct}</dd>
        </div>
        <div>
          <dt>Precio actual (Sí)</dt>
          <dd>
            {result.current_price !== undefined
              ? formatProbPercent(result.current_price)
              : "—"}
          </dd>
        </div>
        <div>
          <dt>Modelo</dt>
          <dd>{result.model ?? "—"}</dd>
        </div>
        <div>
          <dt>Datos usados</dt>
          <dd>{result.n_prices ?? "—"} días</dd>
        </div>
      </dl>
      <p className={styles.predictionNote}>
        Movimiento del precio Sí · umbral {(result.threshold ?? 0.5).toFixed(2)}
        {result.as_of_date
          ? ` · serie al ${result.as_of_date.slice(0, 16).replace("T", " ")}`
          : ""}
      </p>
    </div>
  );
}

function MarketsScrollArea({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollByPage(direction: "up" | "down") {
    const el = scrollRef.current;
    if (!el) return;
    const amount = Math.max(160, el.clientHeight * 0.75);
    el.scrollBy({
      top: direction === "up" ? -amount : amount,
      behavior: "smooth",
    });
  }

  return (
    <div className={styles.marketsScrollArea}>
      <div ref={scrollRef} className={styles.marketsListScroll}>
        {children}
      </div>
      <div className={styles.scrollRail}>
        <button
          type="button"
          className={styles.scrollArrow}
          aria-label="Scroll up"
          onClick={() => scrollByPage("up")}
        >
          <svg viewBox="0 0 12 8" aria-hidden="true">
            <path d="M6 1.5 10.5 7.5h-9L6 1.5z" fill="currentColor" />
          </svg>
        </button>
        <div className={styles.scrollRailTrack} aria-hidden="true" />
        <button
          type="button"
          className={styles.scrollArrow}
          aria-label="Scroll down"
          onClick={() => scrollByPage("down")}
        >
          <svg viewBox="0 0 12 8" aria-hidden="true">
            <path d="M6 6.5 1.5.5h9L6 6.5z" fill="currentColor" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function MarketsList({
  filtered,
  selected,
  onSelect,
}: {
  filtered: MarketSummary[];
  selected: MarketSummary | null;
  onSelect: (m: MarketSummary) => void;
}) {
  return (
    <ul className={styles.marketList} role="listbox" aria-label="Market list">
      {filtered.map((m, idx) => {
        const isSel =
          selected?.slug === m.slug && selected?.question === m.question;
        return (
          <li key={`${m.id ?? m.slug}-${idx}`}>
            <button
              type="button"
              role="option"
              aria-selected={isSel}
              className={`${styles.marketRow} ${isSel ? styles.marketRowSelected : ""}`}
              onClick={() => onSelect(m)}
            >
              <span className={styles.marketQuestion}>
                {m.question || "(No title)"}
              </span>
              {m.slug ? (
                <span className={styles.marketSlug}>{m.slug}</span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
