"""Load raw Polymarket price CSVs and build training matrices."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

import numpy as np
import pandas as pd

from src.features import build_labels, build_market_features, temporal_split
from src.horizons import HorizonSpec, feature_cols_for, get_horizon
from src.paths import PROCESSED_DIR, RAW_DIR

FEATURE_COLS = [
    "ret_1d",
    "ret_3d",
    "ret_7d",
    "ma7",
    "ma14",
    "ma_ratio",
    "vol7",
    "price",
]

DEFAULT_MIN_PRICES = 30
DEFAULT_MIN_ROWS_AFTER_FEATURES = 15
DEFAULT_TRAIN_RATIO = 0.70


def load_price_file(path: Path) -> pd.DataFrame:
    """Load a single ``prices_{slug}.csv`` file."""
    df = pd.read_csv(path)
    if "date" not in df.columns or "price" not in df.columns:
        return pd.DataFrame()
    df["date"] = pd.to_datetime(df["date"], utc=True, errors="coerce").dt.normalize()
    df["price"] = pd.to_numeric(df["price"], errors="coerce")
    df = df.dropna(subset=["date", "price"]).copy()
    if "slug" not in df.columns or df["slug"].isna().all():
        df["slug"] = path.stem.replace("prices_", "", 1)
    if "question" not in df.columns:
        df["question"] = ""
    df = df.sort_values("date").drop_duplicates(subset=["date"], keep="last")
    return df.reset_index(drop=True)


def iter_price_files(raw_dir: Path | None = None) -> list[Path]:
    directory = raw_dir or RAW_DIR
    return sorted(directory.glob("prices_*.csv"))


def load_markets_catalog(raw_dir: Path | None = None) -> pd.DataFrame:
    path = (raw_dir or RAW_DIR) / "markets_catalog.csv"
    if not path.is_file():
        return pd.DataFrame()
    catalog = pd.read_csv(path)
    if "endDate" in catalog.columns:
        catalog["endDate"] = pd.to_datetime(catalog["endDate"], utc=True, errors="coerce")
    return catalog


def validate_markets(
    raw_dir: Path | None = None,
    min_prices: int = DEFAULT_MIN_PRICES,
    catalog: pd.DataFrame | None = None,
) -> pd.DataFrame:
    """Scan price CSVs and return a per-market validation report."""
    raw_dir = raw_dir or RAW_DIR
    if catalog is None:
        catalog = load_markets_catalog(raw_dir)

    catalog_by_slug: dict[str, pd.Series] = {}
    if not catalog.empty and "slug" in catalog.columns:
        catalog_by_slug = {row["slug"]: row for _, row in catalog.iterrows()}

    now = datetime.now(timezone.utc)
    rows: list[dict] = []

    for path in iter_price_files(raw_dir):
        slug = path.stem.replace("prices_", "", 1)
        df = load_price_file(path)
        n_prices = len(df)
        n_unique_dates = int(df["date"].nunique()) if n_prices else 0
        dup_days = max(n_prices - n_unique_dates, 0)

        cat = catalog_by_slug.get(slug)
        end_date = cat["endDate"] if cat is not None and "endDate" in cat.index else pd.NaT
        in_catalog = cat is not None
        is_closed = bool(pd.notna(end_date) and end_date <= now) if in_catalog else None

        eligible = n_prices >= min_prices
        reason = "" if eligible else f"n_prices < {min_prices}"

        rows.append(
            {
                "slug": slug,
                "file": path.name,
                "n_prices": n_prices,
                "n_unique_dates": n_unique_dates,
                "dup_days": dup_days,
                "start_date": df["date"].min() if n_prices else pd.NaT,
                "end_date": df["date"].max() if n_prices else pd.NaT,
                "in_catalog": in_catalog,
                "catalog_end_date": end_date,
                "is_closed": is_closed,
                "eligible": eligible,
                "exclude_reason": reason,
            }
        )

    report = pd.DataFrame(rows)
    if not report.empty:
        report = report.sort_values(["eligible", "n_prices"], ascending=[False, False])
    return report


def eligible_slugs(
    report: pd.DataFrame,
    *,
    require_closed: bool = False,
) -> list[str]:
    """Return slugs marked eligible in the validation report."""
    mask = report["eligible"].astype(bool)
    if require_closed and "is_closed" in report.columns:
        mask &= report["is_closed"].fillna(True).astype(bool)
    return report.loc[mask, "slug"].tolist()


def featurize_market(
    df: pd.DataFrame,
    horizon: HorizonSpec | None = None,
) -> pd.DataFrame:
    """Apply feature engineering and labels to one market series."""
    h = horizon or get_horizon("1d")
    cols = feature_cols_for(h)
    g = build_market_features(
        df,
        price_col="price",
        ret_windows=h.ret_windows,
        ma_short=h.ma_short,
        ma_long=h.ma_long,
        vol_window=h.vol_window,
    )
    g = build_labels(g, price_col="price", forward_steps=h.label_steps)
    g["label"] = g["label"].astype("float64")
    return g.dropna(subset=cols + ["label"]).reset_index(drop=True)


def build_training_matrix(
    slugs: Iterable[str] | None = None,
    raw_dir: Path | None = None,
    min_rows_after_features: int = DEFAULT_MIN_ROWS_AFTER_FEATURES,
    horizon: HorizonSpec | None = None,
) -> pd.DataFrame:
    """Build a panel dataset (one row per market-bar with features + label)."""
    raw_dir = raw_dir or RAW_DIR
    h = horizon or get_horizon("1d")
    slug_filter = set(slugs) if slugs is not None else None
    parts: list[pd.DataFrame] = []

    for path in iter_price_files(raw_dir):
        slug = path.stem.replace("prices_", "", 1)
        if slug_filter is not None and slug not in slug_filter:
            continue
        df = load_price_file(path)
        if df.empty:
            continue
        g = featurize_market(df, horizon=h)
        if len(g) < min_rows_after_features:
            continue
        g["horizon"] = h.id
        parts.append(g)

    if not parts:
        return pd.DataFrame()
    return pd.concat(parts, ignore_index=True)


def split_panel_temporal(
    matrix: pd.DataFrame,
    train_ratio: float = DEFAULT_TRAIN_RATIO,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Temporal train/test split applied independently per slug."""
    train_parts: list[pd.DataFrame] = []
    test_parts: list[pd.DataFrame] = []

    for _, g in matrix.groupby("slug", sort=False):
        if len(g) < 4:
            continue
        tr, te = temporal_split(g, train_ratio=train_ratio, date_col="date")
        if not tr.empty:
            train_parts.append(tr)
        if not te.empty:
            test_parts.append(te)

    train_df = pd.concat(train_parts, ignore_index=True) if train_parts else pd.DataFrame()
    test_df = pd.concat(test_parts, ignore_index=True) if test_parts else pd.DataFrame()
    return train_df, test_df


def save_eligible_slugs(slugs: list[str], path: Path | None = None) -> Path:
    out = path or (PROCESSED_DIR / "eligible_slugs.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(slugs, indent=2), encoding="utf-8")
    return out
