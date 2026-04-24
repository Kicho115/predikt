"""
Feature engineering for the Predikt ML pipeline.

Exports:
  - build_market_features(df)   → endogenous price-based features
  - build_labels(df)            → binary up/down label
  - build_tfidf_features(news)  → sparse TF-IDF matrix + vectorizer
  - merge_features(prices, news_daily) → merged DataFrame ready for models
"""

import re
import logging
from typing import Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Market features (endogenous)
# ---------------------------------------------------------------------------

def build_market_features(df: pd.DataFrame, price_col: str = "price") -> pd.DataFrame:
    """Add technical features to a daily price DataFrame.

    Input  : DataFrame with at minimum a `date` column and `price_col`.
    Output : same DataFrame with added feature columns (rows with NaN dropped).

    Features
    --------
    ret_1d   : 1-day log return
    ret_3d   : 3-day log return
    ret_7d   : 7-day log return
    ma7      : 7-day simple moving average
    ma14     : 14-day simple moving average
    ma_ratio : ma7 / ma14  (momentum proxy)
    vol7     : 7-day rolling std of log returns (volatility)
    price    : current closing price (probability proxy)
    """
    df = df.copy().sort_values("date").reset_index(drop=True)
    p = df[price_col].astype(float)
    log_ret = np.log(p + 1e-8) - np.log(p.shift(1) + 1e-8)

    df["ret_1d"] = log_ret
    df["ret_3d"] = np.log(p + 1e-8) - np.log(p.shift(3) + 1e-8)
    df["ret_7d"] = np.log(p + 1e-8) - np.log(p.shift(7) + 1e-8)
    df["ma7"] = p.rolling(7, min_periods=3).mean()
    df["ma14"] = p.rolling(14, min_periods=5).mean()
    df["ma_ratio"] = df["ma7"] / (df["ma14"] + 1e-8)
    df["vol7"] = log_ret.rolling(7, min_periods=3).std()
    df["price"] = p

    return df


# ---------------------------------------------------------------------------
# Labels
# ---------------------------------------------------------------------------

def build_labels(df: pd.DataFrame, price_col: str = "price") -> pd.DataFrame:
    """Add binary classification label.

    label = 1  if next-day price > today's price  (UP)
    label = 0  if next-day price <= today's price  (DOWN / FLAT)

    The last row will have label = NaN and must be dropped before training.
    """
    df = df.copy()
    df["label"] = (df[price_col].shift(-1) > df[price_col]).astype("Int64")
    return df


# ---------------------------------------------------------------------------
# Text / TF-IDF features
# ---------------------------------------------------------------------------

_STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "is", "was", "are", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "it", "its", "this", "that", "these", "those",
    "he", "she", "they", "we", "i", "you", "his", "her", "their", "our",
    "my", "your", "from", "as", "by", "not", "no", "so", "if", "then",
    "than", "more", "most", "up", "out", "about", "into", "over", "also",
    "after", "before", "between", "through", "during", "said", "says",
}


def clean_text(text: str) -> str:
    """Lowercase, remove punctuation and stopwords."""
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    tokens = [t for t in text.split() if t not in _STOPWORDS and len(t) > 2]
    return " ".join(tokens)


def build_tfidf_features(
    news_daily: pd.DataFrame,
    text_col: str = "titles",
    max_features: int = 500,
    ngram_range: Tuple[int, int] = (1, 2),
    vectorizer: Optional[TfidfVectorizer] = None,
    fit: bool = True,
) -> Tuple[pd.DataFrame, TfidfVectorizer]:
    """Convert daily aggregated news text into TF-IDF feature matrix.

    Parameters
    ----------
    news_daily : DataFrame with `date` and `text_col` (one string per day).
    max_features : vocabulary size cap.
    vectorizer : pass a pre-fitted vectorizer to transform without re-fitting.
    fit : if True, fit vectorizer on the provided data.

    Returns
    -------
    tfidf_df  : DataFrame indexed by date, columns = tfidf_0 … tfidf_N
    vectorizer: fitted TfidfVectorizer
    """
    news_daily = news_daily.copy()
    if text_col not in news_daily.columns:
        raise ValueError(f"Column '{text_col}' not found in news_daily DataFrame.")

    texts = news_daily[text_col].fillna("").apply(clean_text).tolist()

    if vectorizer is None:
        vectorizer = TfidfVectorizer(
            max_features=max_features,
            ngram_range=ngram_range,
            sublinear_tf=True,
        )

    if fit:
        matrix = vectorizer.fit_transform(texts)
    else:
        matrix = vectorizer.transform(texts)

    feature_names = [f"tfidf_{i}" for i in range(matrix.shape[1])]
    tfidf_df = pd.DataFrame.sparse.from_spmatrix(
        matrix, index=news_daily.index, columns=feature_names
    )
    tfidf_df.insert(0, "date", news_daily["date"].values)
    return tfidf_df, vectorizer


# ---------------------------------------------------------------------------
# Feature merge
# ---------------------------------------------------------------------------

def merge_features(
    prices_df: pd.DataFrame,
    news_daily: pd.DataFrame,
    date_col: str = "date",
) -> pd.DataFrame:
    """Left-join price features with daily GDELT sentiment.

    Both DataFrames must have a `date` column (timezone-aware or naive; this
    function normalises to date-only before merging).

    Returns the merged DataFrame with `gdelt_tone` and `article_count` added.
    Days without news data get gdelt_tone=0, article_count=0.
    """

    def _to_date(series: pd.Series) -> pd.Series:
        s = pd.to_datetime(series, utc=True, errors="coerce")
        return s.dt.normalize()

    p = prices_df.copy()
    n = news_daily.copy()
    p[date_col] = _to_date(p[date_col])
    n[date_col] = _to_date(n[date_col])

    # Deduplicate by date (keep first occurrence)
    n = n.drop_duplicates(subset=[date_col]).set_index(date_col)

    tone_cols = [c for c in ["gdelt_tone", "article_count"] if c in n.columns]
    merged = p.merge(n[tone_cols], left_on=date_col, right_index=True, how="left")
    if "gdelt_tone" in merged.columns:
        merged["gdelt_tone"] = merged["gdelt_tone"].fillna(0.0)
    if "article_count" in merged.columns:
        merged["article_count"] = merged["article_count"].fillna(0).astype(int)
    return merged.reset_index(drop=True)


# ---------------------------------------------------------------------------
# Train / test split (temporal — no shuffle)
# ---------------------------------------------------------------------------

def temporal_split(
    df: pd.DataFrame,
    train_ratio: float = 0.70,
    date_col: str = "date",
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """Split a time-ordered DataFrame into train and test sets without shuffling."""
    df = df.sort_values(date_col).reset_index(drop=True)
    split_idx = int(len(df) * train_ratio)
    return df.iloc[:split_idx].copy(), df.iloc[split_idx:].copy()
