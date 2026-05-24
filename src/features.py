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

def build_market_features(df: pd.DataFrame, price_col: str = "price") -> pd.DataFrame:
    """Add technical features to a daily price DataFrame.

    Input  : DataFrame with at minimum a `date` column and `price_col`.
    Output : same DataFrame with added feature columns (rows with NaN kept).

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
