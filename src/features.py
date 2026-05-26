"""Feature engineering for the Predikt ML pipeline.

Exports:
    - build_market_features(df) -> endogenous price-based features
    - build_labels(df) -> binary up/down label
    - temporal_split(df) -> time-ordered train/test split
"""

from typing import Tuple

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Market features (endogenous)
# ---------------------------------------------------------------------------

def build_market_features(
    df: pd.DataFrame,
    price_col: str = "price",
    *,
    ret_windows: tuple[int, int, int] = (1, 3, 7),
    ma_short: int = 7,
    ma_long: int = 14,
    vol_window: int = 7,
) -> pd.DataFrame:
    """Add technical features to a price series (one row per bar).

    Column names stay ``ret_1d`` / ``ma7`` etc. for compatibility; window sizes
    are in *bars* (1 bar = 1 hour for hourly data, 1 day for daily data).
    """
    df = df.copy().sort_values("date").reset_index(drop=True)
    p = df[price_col].astype(float)
    w1, w3, w7 = ret_windows
    log_ret = np.log(p + 1e-8) - np.log(p.shift(w1) + 1e-8)

    df["ret_1d"] = log_ret
    df["ret_3d"] = np.log(p + 1e-8) - np.log(p.shift(w3) + 1e-8)
    df["ret_7d"] = np.log(p + 1e-8) - np.log(p.shift(w7) + 1e-8)
    df["ma7"] = p.rolling(ma_short, min_periods=max(2, ma_short // 2)).mean()
    df["ma14"] = p.rolling(ma_long, min_periods=max(3, ma_long // 2)).mean()
    df["ma_ratio"] = df["ma7"] / (df["ma14"] + 1e-8)
    df["vol7"] = log_ret.rolling(vol_window, min_periods=max(2, vol_window // 2)).std()
    df["price"] = p

    return df

def build_labels(
    df: pd.DataFrame,
    price_col: str = "price",
    *,
    forward_steps: int = 1,
) -> pd.DataFrame:
    """Binary label: 1 if price rises after ``forward_steps`` bars, else 0."""
    df = df.copy()
    future = df[price_col].shift(-forward_steps)
    df["label"] = (future > df[price_col]).astype("Int64")
    return df


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
