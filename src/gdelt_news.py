"""
GDELT news client.

Uses the `gdeltdoc` library (GDELT Doc 2.0 API — no BigQuery, no account).
Covers a rolling 3-month window.  For deeper history use BigQuery:
  SELECT * FROM `gdelt-bq.gdeltv2.gkg` WHERE DATE(DATE) BETWEEN ...
"""

import logging
import time
from datetime import datetime, timedelta
from typing import Optional

import pandas as pd

logger = logging.getLogger(__name__)

_GDELT_AVAILABLE = False
try:
    from gdeltdoc import GdeltDoc, Filters  # type: ignore
    _GDELT_AVAILABLE = True
except ImportError:
    logger.warning("gdeltdoc not installed – GdeltNewsClient will be unavailable.")


class GdeltNewsClient:
    """Search GDELT for news articles and aggregate them into daily sentiment scores."""

    # GDELT tone field: positive values = positive tone, negative = negative
    NEUTRAL_TONE = 0.0

    def __init__(self, request_delay: float = 1.0):
        if not _GDELT_AVAILABLE:
            raise ImportError("Install gdeltdoc: pip install gdeltdoc")
        self._gd = GdeltDoc()
        self._delay = request_delay

    # ------------------------------------------------------------------
    # Article search
    # ------------------------------------------------------------------

    def search_articles(
        self,
        keyword: str,
        start_date: str,
        end_date: str,
        domain: Optional[str] = None,
        country: Optional[str] = None,
        language: str = "English",
        max_records: int = 250,
    ) -> pd.DataFrame:
        """Return a DataFrame of articles matching the keyword in [start_date, end_date].

        Parameters
        ----------
        keyword : str
            Search query (supports boolean operators, e.g. "Trump OR election").
        start_date / end_date : str
            Format "YYYY-MM-DD".  GDELT only covers the last ~3 months.
        domain : str, optional
            Restrict to a source domain, e.g. "reuters.com".
        country : str, optional
            Two-letter country code, e.g. "US".
        language : str
            Article language filter (default: "English").
        max_records : int
            Safety cap on returned rows (GDELT paginates at 250).

        Returns
        -------
        pd.DataFrame with columns: url, title, date, tone, domain, language, sourcecountry
        """
        filters_kwargs: dict = {
            "keyword": keyword,
            "start_date": start_date,
            "end_date": end_date,
        }
        if domain:
            filters_kwargs["domain"] = domain
        if country:
            filters_kwargs["country"] = country

        time.sleep(self._delay)
        try:
            f = Filters(**filters_kwargs)
            articles = self._gd.article_search(f)
        except Exception as exc:
            logger.error("GDELT search failed for keyword=%r: %s", keyword, exc)
            return self._empty_articles()

        if articles is None or articles.empty:
            logger.warning("No articles found for keyword=%r between %s and %s", keyword, start_date, end_date)
            return self._empty_articles()

        articles = articles.copy()
        articles = self._normalize_columns(articles)
        return articles.head(max_records).reset_index(drop=True)

    # ------------------------------------------------------------------
    # Daily sentiment aggregation
    # ------------------------------------------------------------------

    def daily_sentiment(
        self,
        keyword: str,
        start_date: str,
        end_date: str,
        **kwargs,
    ) -> pd.DataFrame:
        """Aggregate articles into one row per day with mean tone and article count.

        Returns a complete date range (days without news get tone=0, count=0).
        """
        articles = self.search_articles(keyword, start_date, end_date, **kwargs)
        return self._aggregate_daily(articles, start_date, end_date)

    def multi_keyword_sentiment(
        self,
        keywords: list[str],
        start_date: str,
        end_date: str,
        **kwargs,
    ) -> pd.DataFrame:
        """Fetch and merge sentiment for multiple keywords, averaging tones."""
        frames = []
        for kw in keywords:
            df = self.daily_sentiment(kw, start_date, end_date, **kwargs)
            df = df.rename(columns={"tone": f"tone_{kw}", "article_count": f"count_{kw}"})
            frames.append(df.set_index("date"))

        if not frames:
            return self._empty_daily(start_date, end_date)

        merged = pd.concat(frames, axis=1).reset_index()
        tone_cols = [c for c in merged.columns if c.startswith("tone_")]
        count_cols = [c for c in merged.columns if c.startswith("count_")]
        merged["gdelt_tone"] = merged[tone_cols].mean(axis=1).fillna(0.0)
        merged["article_count"] = merged[count_cols].sum(axis=1).fillna(0)
        return merged[["date", "gdelt_tone", "article_count"]].reset_index(drop=True)

    # ------------------------------------------------------------------
    # Chunked search for ranges > 3 months (splits into monthly windows)
    # ------------------------------------------------------------------

    def search_chunked(
        self,
        keyword: str,
        start_date: str,
        end_date: str,
        chunk_days: int = 30,
        **kwargs,
    ) -> pd.DataFrame:
        """Split a long date range into monthly chunks to stay within API limits."""
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")
        frames = []
        cursor = start
        while cursor < end:
            chunk_end = min(cursor + timedelta(days=chunk_days), end)
            df = self.search_articles(
                keyword,
                cursor.strftime("%Y-%m-%d"),
                chunk_end.strftime("%Y-%m-%d"),
                **kwargs,
            )
            frames.append(df)
            cursor = chunk_end + timedelta(days=1)
        if not frames:
            return self._empty_articles()
        return pd.concat(frames, ignore_index=True).drop_duplicates(subset=["url"])

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
        rename = {
            "seendate": "date",
            "socialimage": "image",
            "sourcecountry": "source_country",
        }
        df = df.rename(columns={k: v for k, v in rename.items() if k in df.columns})
        if "date" in df.columns:
            df["date"] = pd.to_datetime(df["date"], errors="coerce", utc=True).dt.normalize()
        if "tone" not in df.columns:
            df["tone"] = 0.0
        df["tone"] = pd.to_numeric(df["tone"], errors="coerce").fillna(0.0)
        return df

    def _aggregate_daily(
        self,
        articles: pd.DataFrame,
        start_date: str,
        end_date: str,
    ) -> pd.DataFrame:
        all_dates = pd.date_range(start=start_date, end=end_date, freq="D", tz="UTC")
        if articles.empty or "date" not in articles.columns:
            result = pd.DataFrame({"date": all_dates, "gdelt_tone": 0.0, "article_count": 0})
            return result

        daily = (
            articles.groupby("date")
            .agg(gdelt_tone=("tone", "mean"), article_count=("tone", "count"))
            .reset_index()
        )
        full = pd.DataFrame({"date": all_dates})
        result = full.merge(daily, on="date", how="left")
        result["gdelt_tone"] = result["gdelt_tone"].fillna(0.0)
        result["article_count"] = result["article_count"].fillna(0).astype(int)
        return result

    @staticmethod
    def _empty_articles() -> pd.DataFrame:
        return pd.DataFrame(columns=["url", "title", "date", "tone", "domain", "language"])

    @staticmethod
    def _empty_daily(start_date: str, end_date: str) -> pd.DataFrame:
        dates = pd.date_range(start=start_date, end=end_date, freq="D", tz="UTC")
        return pd.DataFrame({"date": dates, "gdelt_tone": 0.0, "article_count": 0})
