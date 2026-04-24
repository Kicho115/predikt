"""
Polymarket API client.

Two-step flow:
  1. Gamma API  → list closed markets, extract clobTokenIds
  2. CLOB API   → fetch daily price history using the token ID
"""

import time
import logging
from typing import Optional

import requests
import pandas as pd

GAMMA_BASE = "https://gamma-api.polymarket.com"
CLOB_BASE = "https://clob.polymarket.com"

logger = logging.getLogger(__name__)


class PolymarketClient:
    def __init__(self, request_delay: float = 0.5):
        self._session = requests.Session()
        self._session.headers.update({"Accept": "application/json"})
        self._delay = request_delay

    # ------------------------------------------------------------------
    # Gamma API — market catalogue
    # ------------------------------------------------------------------

    def list_markets(
        self,
        closed: bool = True,
        active: bool = False,
        limit: int = 100,
        offset: int = 0,
        min_volume: float = 0.0,
        end_date_min: str = "",
        end_date_max: str = "",
    ) -> pd.DataFrame:
        """Return a DataFrame of markets from the Gamma API.

        Columns include: slug, question, clobTokenIds, volume, startDate, endDate.
        """
        params: dict = {
            "closed": str(closed).lower(),
            "active": str(active).lower(),
            "limit": limit,
            "offset": offset,
        }
        if end_date_min:
            params["end_date_min"] = end_date_min
        if end_date_max:
            params["end_date_max"] = end_date_max
        resp = self._get(f"{GAMMA_BASE}/markets", params=params)
        markets = resp if isinstance(resp, list) else resp.get("markets", resp)

        rows = []
        for m in markets:
            token_ids = m.get("clobTokenIds") or []
            if isinstance(token_ids, str):
                import json
                try:
                    token_ids = json.loads(token_ids)
                except Exception:
                    token_ids = [token_ids]
            rows.append(
                {
                    "slug": m.get("slug", ""),
                    "question": m.get("question", ""),
                    "outcomes": m.get("outcomes", ""),
                    "volume": float(m.get("volume") or 0),
                    "startDate": m.get("startDate", ""),
                    "endDate": m.get("endDate", ""),
                    "clobTokenIds": token_ids,
                }
            )

        df = pd.DataFrame(rows)
        if min_volume > 0 and "volume" in df.columns:
            df = df[df["volume"] >= min_volume]
        return df.reset_index(drop=True)

    def top_markets(
        self,
        n: int = 10,
        min_volume: float = 50_000.0,
        end_date_min: str = "2025-01-01",
        end_date_max: str = "2026-12-31",
    ) -> pd.DataFrame:
        """Return the top-n closed markets sorted by volume.

        Parameters
        ----------
        end_date_min / end_date_max : str
            Only include markets that closed in this window.  Defaults to 2025+
            because older markets do not retain CLOB price history.
        """
        df = self.list_markets(
            closed=True,
            active=False,
            limit=200,
            min_volume=min_volume,
            end_date_min=end_date_min,
            end_date_max=end_date_max,
        )
        return df.nlargest(n, "volume").reset_index(drop=True)

    # ------------------------------------------------------------------
    # CLOB API — price history
    # ------------------------------------------------------------------

    def get_price_history(
        self,
        token_id: str,
        interval: str = "max",
        fidelity: int = 1440,
        start_ts: Optional[int] = None,
        end_ts: Optional[int] = None,
    ) -> pd.DataFrame:
        """Fetch daily price history for a single CLOB token.

        Parameters
        ----------
        token_id : str
            The clobTokenId (asset ID) for one side of a market.
        interval : str
            Aggregation window: "max", "1m", "1w", "1d", "6h", "1h".
        fidelity : int
            Resolution in minutes (1440 = daily).
        start_ts / end_ts : int, optional
            Unix timestamps to restrict the window.

        Returns
        -------
        pd.DataFrame with columns: date (datetime), price (float)
        """
        params: dict = {
            "market": token_id,
            "interval": interval,
            "fidelity": fidelity,
        }
        if start_ts is not None:
            params["startTs"] = start_ts
        if end_ts is not None:
            params["endTs"] = end_ts

        resp = self._get(f"{CLOB_BASE}/prices-history", params=params)
        history = resp.get("history", [])

        if not history:
            logger.warning("No price history returned for token %s", token_id)
            return pd.DataFrame(columns=["date", "price"])

        df = pd.DataFrame(history)
        df = df.rename(columns={"t": "timestamp", "p": "price"})
        df["date"] = pd.to_datetime(df["timestamp"], unit="s", utc=True).dt.normalize()
        df["price"] = pd.to_numeric(df["price"], errors="coerce")
        df = df[["date", "price"]].dropna().sort_values("date").reset_index(drop=True)
        # Keep last price per day when fidelity < 1440
        df = df.groupby("date", as_index=False).last()
        return df

    def fetch_market_prices(
        self,
        market_row: pd.Series,
        outcome_index: int = 0,
    ) -> pd.DataFrame:
        """Convenience wrapper: fetch prices for one row from list_markets().

        Picks `outcome_index` from clobTokenIds (0 = YES outcome by convention).
        """
        token_ids = market_row["clobTokenIds"]
        if not token_ids:
            raise ValueError(f"No clobTokenIds for market {market_row['slug']}")
        token_id = token_ids[outcome_index]
        df = self.get_price_history(token_id)
        df["slug"] = market_row["slug"]
        df["question"] = market_row["question"]
        return df

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _get(self, url: str, params: Optional[dict] = None) -> dict:
        time.sleep(self._delay)
        try:
            resp = self._session.get(url, params=params, timeout=30)
            resp.raise_for_status()
            return resp.json()
        except requests.HTTPError as exc:
            logger.error("HTTP %s for %s | %s", exc.response.status_code, url, exc.response.text)
            raise
        except Exception as exc:
            logger.error("Request failed for %s: %s", url, exc)
            raise
