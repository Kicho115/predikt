"""Local up/down inference for a single Polymarket market."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

from src.dataset import DEFAULT_MIN_PRICES
from src.features import build_market_features
from src.horizons import (
    DEFAULT_HORIZON_ID,
    HorizonSpec,
    feature_cols_for,
    get_horizon,
    normalize_horizon_id,
)
from src.paths import MODELS_DIR
from src.polymarket import PolymarketClient

DEFAULT_THRESHOLD = 0.5


def load_model_bundle(
    models_dir: Path | None = None,
    horizon_id: str | None = None,
) -> dict[str, Any]:
    """Load model for a horizon (``horizon_1d.pkl``), else legacy ``best_model.pkl``."""
    directory = models_dir or MODELS_DIR
    hid = normalize_horizon_id(horizon_id)

    candidates = [directory / f"horizon_{hid}.pkl"]
    if hid == DEFAULT_HORIZON_ID:
        candidates.extend([directory / "best_model.pkl", directory / "baseline_v1.pkl"])

    for path in candidates:
        if not path.is_file():
            continue
        bundle = joblib.load(path)
        if isinstance(bundle, dict) and "model" in bundle:
            bundle.setdefault("feature_cols", feature_cols_for(get_horizon(hid)))
            bundle.setdefault("threshold", DEFAULT_THRESHOLD)
            bundle.setdefault("horizon", hid)
            return bundle
        return {
            "model": bundle,
            "model_name": path.stem,
            "threshold": DEFAULT_THRESHOLD,
            "feature_cols": feature_cols_for(get_horizon(hid)),
            "horizon": hid,
        }

    raise FileNotFoundError(
        f"No model for horizon '{hid}'. Train with: python scripts/04_train_horizons.py --horizons {hid}"
    )


def latest_feature_row(
    df: pd.DataFrame,
    horizon: HorizonSpec,
) -> pd.Series | None:
    cols = feature_cols_for(horizon)
    if df.empty:
        return None
    featured = build_market_features(
        df,
        price_col="price",
        ret_windows=horizon.ret_windows,
        ma_short=horizon.ma_short,
        ma_long=horizon.ma_long,
        vol_window=horizon.vol_window,
    )
    valid = featured.dropna(subset=cols)
    if valid.empty:
        return None
    return valid.iloc[-1]


def predict_from_price_frame(
    df: pd.DataFrame,
    bundle: dict[str, Any],
    *,
    horizon: HorizonSpec,
    slug: str = "",
    question: str = "",
) -> dict[str, Any]:
    feature_cols: list[str] = list(bundle.get("feature_cols") or feature_cols_for(horizon))
    model = bundle["model"]
    threshold = float(bundle.get("threshold", DEFAULT_THRESHOLD))
    model_name = str(bundle.get("model_name", "unknown"))
    min_bars = horizon.min_bars

    n_prices = len(df)
    if n_prices < min_bars:
        return {
            "ok": False,
            "error": f"Need at least {min_bars} price bars for {horizon.id}; got {n_prices}.",
            "code": "INSUFFICIENT_HISTORY",
            "n_prices": n_prices,
            "min_prices": min_bars,
            "horizon": horizon.id,
        }

    row = latest_feature_row(df, horizon)
    if row is None:
        return {
            "ok": False,
            "error": "Could not compute features (not enough history after rolling windows).",
            "code": "FEATURE_ERROR",
            "n_prices": n_prices,
            "horizon": horizon.id,
        }

    X = row[feature_cols].values.astype(float).reshape(1, -1)
    if hasattr(model, "predict_proba"):
        proba_up = float(model.predict_proba(X)[0, 1])
    else:
        proba_up = float(int(model.predict(X)[0]))

    label = int(proba_up >= threshold)
    direction = "up" if label == 1 else "down"
    as_of = row["date"]
    as_of_str = as_of.isoformat() if hasattr(as_of, "isoformat") else str(as_of)

    return {
        "ok": True,
        "direction": direction,
        "label": label,
        "probability_up": round(proba_up, 4),
        "probability_down": round(1.0 - proba_up, 4),
        "threshold": threshold,
        "model": model_name,
        "horizon": horizon.id,
        "horizon_label": horizon.label,
        "as_of_date": as_of_str,
        "current_price": round(float(row["price"]), 4),
        "n_prices": n_prices,
        "slug": slug,
        "question": question,
        "features": {c: round(float(row[c]), 6) for c in feature_cols},
    }


def fetch_daily_prices(
    token_id: str,
    client: PolymarketClient | None = None,
) -> pd.DataFrame:
    """Daily YES prices (CLOB fidelity 1440) — only resolution used for inference."""
    api = client or PolymarketClient(request_delay=0.0)
    return api.get_price_history(token_id, interval="max", fidelity=1440, bar="1d")


def predict_market_payload(
    market: dict[str, Any],
    *,
    horizon_id: str | None = None,
    bundle: dict[str, Any] | None = None,
    client: PolymarketClient | None = None,
) -> dict[str, Any]:
    """Predict up/down for a market at the given horizon."""
    horizon = get_horizon(horizon_id)
    slug = str(market.get("slug") or "")
    question = str(market.get("question") or "")
    token_ids = market.get("clobTokenIds") or []
    if not isinstance(token_ids, list) or not token_ids:
        return {
            "ok": False,
            "error": "market.clobTokenIds must include at least one token id.",
            "code": "MISSING_TOKEN",
        }

    token_id = str(token_ids[0])

    try:
        bundle = bundle or load_model_bundle(horizon_id=horizon.id)
    except FileNotFoundError as exc:
        return {
            "ok": False,
            "error": str(exc),
            "code": "MODEL_NOT_FOUND",
            "horizon": horizon.id,
        }

    try:
        prices = fetch_daily_prices(token_id, client=client)
    except Exception as exc:
        return {
            "ok": False,
            "error": f"Failed to fetch price history: {exc}",
            "code": "CLOB_FETCH_ERROR",
            "horizon": horizon.id,
        }

    result = predict_from_price_frame(
        prices,
        bundle,
        horizon=horizon,
        slug=slug,
        question=question,
    )
    result["token_id"] = token_id
    result["predicted_at"] = datetime.now(timezone.utc).isoformat()
    return result


def list_available_horizons(models_dir: Path | None = None) -> list[str]:
    directory = models_dir or MODELS_DIR
    found: list[str] = []
    for hid in ("1d", "1w"):
        if (directory / f"horizon_{hid}.pkl").is_file():
            found.append(hid)
    if not found and (directory / "best_model.pkl").is_file():
        found.append("1d")
    return found
