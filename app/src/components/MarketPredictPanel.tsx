"use client";

import { useEffect, useMemo, useState } from "react";

import type { MarketSummary } from "@/lib/types";

import styles from "./MarketPredictPanel.module.css";

type MarketsResponse = {
  markets: MarketSummary[];
  total: number;
};

function CardHeader({ label, htmlFor }: { label: string; htmlFor?: string }) {
  const Tag = htmlFor ? "label" : "span";
  return (
    <div className={styles.cardHeader}>
      <span className={styles.cardIcon} aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" />
        </svg>
      </span>
      <Tag className={styles.label} {...(htmlFor ? { htmlFor } : {})}>
        {label}
      </Tag>
    </div>
  );
}

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

export function MarketPredictPanel() {
  const [markets, setMarkets] = useState<MarketSummary[]>([]);
  const [marketsLoading, setMarketsLoading] = useState(true);
  const [marketsError, setMarketsError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<MarketSummary | null>(null);

  const [predictLoading, setPredictLoading] = useState(false);
  const [predictError, setPredictError] = useState<string | null>(null);
  const [predictJson, setPredictJson] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setMarketsLoading(true);
      setMarketsError(null);
      try {
        const res = await fetch("/api/markets?limit=200&offset=0");
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
            e instanceof Error
              ? e.message
              : "Could not load markets.",
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

  async function handlePredict() {
    if (!selected) return;
    setPredictLoading(true);
    setPredictError(null);
    setPredictJson(null);
    try {
      const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ market: selected }),
      });
      const data: unknown = await res.json();
      setPredictJson(JSON.stringify(data, null, 2));
      if (!res.ok) {
        const msg =
          data &&
          typeof data === "object" &&
          "error" in data &&
          typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : `Error ${res.status}`;
        setPredictError(msg);
      }
    } catch (e) {
      setPredictError(e instanceof Error ? e.message : "Network error");
    } finally {
      setPredictLoading(false);
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.leftColumn}>
        <div className={styles.card}>
          <CardHeader label="Search markets" htmlFor="market-search" />
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3-3" strokeLinecap="round" />
              </svg>
            </span>
            <input
              id="market-search"
              className={styles.search}
              type="search"
              placeholder="Filter by title or slug…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={marketsLoading || !!marketsError}
              autoComplete="off"
            />
          </div>
        </div>

        <div className={`${styles.card} ${styles.cardMarkets}`}>
          <CardHeader label="Active markets" />
          {marketsLoading && <p className={styles.status}>Loading markets…</p>}
          {marketsError && (
            <p className={`${styles.status} ${styles.error}`}>{marketsError}</p>
          )}
          {!marketsLoading && !marketsError && filtered.length === 0 && (
            <p className={styles.empty}>No matching markets.</p>
          )}
          {!marketsLoading && !marketsError && filtered.length > 0 && (
            <MarketsList
              filtered={filtered}
              selected={selected}
              onSelect={setSelected}
            />
          )}
        </div>
      </div>

      <div className={styles.rightColumn}>
        <div className={styles.card}>
          <CardHeader label="Selected market" />
          {selected ? (
            <dl className={styles.summaryGrid}>
              <SummaryItem full label="Question" value={selected.question} />
              <SummaryItem label="Slug" value={selected.slug || "—"} mono />
              <SummaryItem
                label="Volume"
                value={selected.volume.toLocaleString("en")}
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
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <path d="M8 12h8M12 8v8" strokeLinecap="round" />
                </svg>
              </span>
              <p className={styles.status}>Choose a market from the list.</p>
            </div>
          )}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primary}
              disabled={!selected || predictLoading}
              onClick={handlePredict}
            >
              {predictLoading ? "Sending…" : "Send to prediction"}
            </button>
            {predictLoading && (
              <span className={styles.status}>Calling API…</span>
            )}
          </div>
        </div>

        {(predictError || predictJson) && (
          <div className={styles.card}>
            <CardHeader label="Inference response" />
            {predictError && (
              <p className={`${styles.status} ${styles.error}`}>{predictError}</p>
            )}
            {predictJson && <pre className={styles.pre}>{predictJson}</pre>}
          </div>
        )}
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
    <div className={styles.listWrap}>
      <ul className={styles.list} role="listbox" aria-label="Market list">
        {filtered.map((m, idx) => {
          const isSel =
            selected?.slug === m.slug && selected?.question === m.question;
          return (
            <li key={`${m.id ?? m.slug}-${idx}`}>
              <button
                type="button"
                role="option"
                aria-selected={isSel}
                className={`${styles.row} ${isSel ? styles.rowSelected : ""}`}
                onClick={() => onSelect(m)}
              >
                {m.question || "(No title)"}
                {m.slug ? <span className={styles.slug}>{m.slug}</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
