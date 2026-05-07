"use client";

import { useEffect, useMemo, useState } from "react";

import type { MarketSummary } from "@/lib/types";

import styles from "./MarketPredictPanel.module.css";

type MarketsResponse = {
  markets: MarketSummary[];
  total: number;
};

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
              : "No se pudieron cargar los mercados.",
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
      setPredictError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setPredictLoading(false);
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.card}>
        <label className={styles.label} htmlFor="market-search">
          Buscar mercado
        </label>
        <input
          id="market-search"
          className={styles.search}
          type="search"
          placeholder="Filtrar por título o slug…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={marketsLoading || !!marketsError}
          autoComplete="off"
        />
      </div>

      <div className={styles.card}>
        <span className={styles.label}>Mercados activos</span>
        {marketsLoading && <p className={styles.status}>Cargando mercados…</p>}
        {marketsError && (
          <p className={`${styles.status} ${styles.error}`}>{marketsError}</p>
        )}
        {!marketsLoading && !marketsError && filtered.length === 0 && (
          <p className={styles.empty}>No hay mercados que coincidan.</p>
        )}
        {!marketsLoading && !marketsError && filtered.length > 0 && (
          <div className={styles.listWrap}>
            <ul
              className={styles.list}
              role="listbox"
              aria-label="Lista de mercados"
            >
              {filtered.map((m, idx) => {
                const isSel =
                  selected?.slug === m.slug &&
                  selected?.question === m.question;
                return (
                  <li key={`${m.id ?? m.slug}-${idx}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSel}
                      className={`${styles.row} ${isSel ? styles.rowSelected : ""}`}
                      onClick={() => setSelected(m)}
                    >
                      {m.question || "(Sin título)"}
                      {m.slug ? (
                        <span className={styles.slug}>{m.slug}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <div className={styles.card}>
        <span className={styles.label}>Mercado seleccionado</span>
        {selected ? (
          <dl className={styles.summary}>
            <dt>Pregunta</dt>
            <dd>{selected.question}</dd>
            <dt>Slug</dt>
            <dd>{selected.slug || "—"}</dd>
            <dt>Volumen</dt>
            <dd>{selected.volume.toLocaleString("en")}</dd>
            <dt>Tokens CLOB</dt>
            <dd>
              {selected.clobTokenIds.length
                ? selected.clobTokenIds.join(", ")
                : "—"}
            </dd>
          </dl>
        ) : (
          <p className={styles.status}>Elige un mercado de la lista.</p>
        )}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primary}
            disabled={!selected || predictLoading}
            onClick={handlePredict}
          >
            {predictLoading ? "Enviando…" : "Enviar a predicción"}
          </button>
          {predictLoading && (
            <span className={styles.status}>Llamando a la API…</span>
          )}
        </div>
      </div>

      {(predictError || predictJson) && (
        <div className={styles.card}>
          <span className={styles.label}>Respuesta de inferencia</span>
          {predictError && (
            <p className={`${styles.status} ${styles.error}`}>{predictError}</p>
          )}
          {predictJson && <pre className={styles.pre}>{predictJson}</pre>}
        </div>
      )}
    </div>
  );
}
