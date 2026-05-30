from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
import os
from typing import Any

import joblib
import numpy as np
import pandas as pd
import torch
import torch.nn as nn

from src.horizons import feature_cols_for, get_horizon
from src.inference import predict_from_price_frame as sk_predict_from_price_frame
from src.polymarket import PolymarketClient

DEFAULT_MODEL_ID = "lstm_baseline"
DEFAULT_THRESHOLD = 0.5

MODEL_SPECS: dict[str, dict[str, str]] = {
    "lstm_baseline": {
        "label": "LSTM baseline",
        "file": "lstm_baseline.pt",
        "kind": "baseline",
    },
    "lstm_attention": {
        "label": "LSTM attention",
        "file": "lstm_attention.pt",
        "kind": "attention",
    },
}

SK_MODEL_SPECS: dict[str, dict[str, str]] = {
    "sk_model_rf": {
        "label": "SK random forest",
        "file": "model_RandomForest.pkl",
        "horizon_id": "1d",
    },
    "sk_model_gb": {
        "label": "SK gradient boosting",
        "file": "model_GradientBoosting.pkl",
        "horizon_id": "1d",
    },
}

MODEL_ALIASES: dict[str, str] = {
    "model_RandomForest": "sk_model_rf",
    "model_GradientBoosting": "sk_model_gb",
}


class LSTMClassifier(nn.Module):
    def __init__(self, n_feat: int, hidden: int, n_layers: int = 1):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=n_feat,
            hidden_size=hidden,
            num_layers=n_layers,
            batch_first=True,
        )
        self.fc = nn.Linear(hidden, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out, _ = self.lstm(x)
        last = out[:, -1, :]
        return self.fc(last).squeeze(-1)


class AdditiveAttention(nn.Module):
    def __init__(self, hidden_size: int):
        super().__init__()
        self.W = nn.Linear(hidden_size, hidden_size, bias=True)
        self.v = nn.Linear(hidden_size, 1, bias=False)

    def forward(self, h: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        scores = self.v(torch.tanh(self.W(h))).squeeze(-1)
        weights = torch.softmax(scores, dim=1)
        context = torch.sum(h * weights.unsqueeze(-1), dim=1)
        return context, weights


class LSTMAttentionClassifier(nn.Module):
    def __init__(self, n_feat: int, hidden: int, n_layers: int = 1):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=n_feat,
            hidden_size=hidden,
            num_layers=n_layers,
            batch_first=True,
        )
        self.attn = AdditiveAttention(hidden)
        self.fc = nn.Linear(hidden, 1)

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        out, _ = self.lstm(x)
        context, weights = self.attn(out)
        logits = self.fc(context).squeeze(-1)
        return logits, weights


@dataclass(frozen=True)
class ModelBundle:
    id: str
    label: str
    model: nn.Module
    lookback: int
    feature_cols: list[str]
    scaler_mean: np.ndarray
    scaler_scale: np.ndarray
    threshold: float = DEFAULT_THRESHOLD


_MODEL_CACHE: dict[str, ModelBundle] = {}


def _torch_load_checkpoint(path: Path) -> Any:
    # PyTorch 2.6 defaults weights_only=True; these checkpoints store metadata.
    try:
        return torch.load(path, map_location="cpu", weights_only=False)
    except TypeError:
        return torch.load(path, map_location="cpu")


def get_repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def get_model_dir() -> Path:
    raw = os.getenv("MODEL_DIR")
    if raw:
        return Path(raw).expanduser().resolve()
    return get_repo_root() / "data" / "processed"


def list_available_models() -> list[dict[str, Any]]:
    model_dir = get_model_dir()
    out: list[dict[str, Any]] = []
    for model_id, spec in MODEL_SPECS.items():
        path = model_dir / spec["file"]
        out.append(
            {
                "id": model_id,
                "label": spec["label"],
                "file": spec["file"],
                "available": path.is_file(),
                "type": "lstm",
            }
        )
    for model_id, spec in SK_MODEL_SPECS.items():
        path = model_dir / spec["file"]
        out.append(
            {
                "id": model_id,
                "label": spec["label"],
                "file": spec["file"],
                "available": path.is_file(),
                "type": "sklearn",
                "horizon": spec.get("horizon_id"),
            }
        )
    return out


def resolve_model_id(model_id: str) -> str:
    return MODEL_ALIASES.get(model_id, model_id)


def load_model_bundle(model_id: str) -> ModelBundle:
    if model_id in _MODEL_CACHE:
        return _MODEL_CACHE[model_id]
    if model_id not in MODEL_SPECS:
        raise KeyError(f"Unknown model id '{model_id}'.")

    spec = MODEL_SPECS[model_id]
    path = get_model_dir() / spec["file"]
    if not path.is_file():
        raise FileNotFoundError(f"Missing model file: {path}")

    payload = _torch_load_checkpoint(path)
    if not isinstance(payload, dict) or "model_state" not in payload:
        raise ValueError("Invalid model payload.")

    feature_cols = list(payload.get("feature_cols") or [])
    lookback = int(payload.get("lookback") or 0)
    hidden_size = int(payload.get("hidden_size") or 0)
    n_layers = int(payload.get("n_layers") or 1)
    scaler_mean = np.asarray(payload.get("scaler_mean"), dtype=np.float32)
    scaler_scale = np.asarray(payload.get("scaler_scale"), dtype=np.float32)

    if not feature_cols or lookback <= 0 or hidden_size <= 0:
        raise ValueError("Missing required model metadata.")

    n_features = len(feature_cols)
    if spec["kind"] == "attention":
        model: nn.Module = LSTMAttentionClassifier(n_features, hidden_size, n_layers)
    else:
        model = LSTMClassifier(n_features, hidden_size, n_layers)

    model.load_state_dict(payload["model_state"])
    model.eval()

    bundle = ModelBundle(
        id=model_id,
        label=spec["label"],
        model=model,
        lookback=lookback,
        feature_cols=feature_cols,
        scaler_mean=scaler_mean,
        scaler_scale=scaler_scale,
    )
    _MODEL_CACHE[model_id] = bundle
    return bundle


def load_sklearn_bundle(
    model_id: str,
    horizon_id: str | None = None,
) -> tuple[dict[str, Any], Any, dict[str, str]]:
    if model_id not in SK_MODEL_SPECS:
        raise KeyError(f"Unknown model id '{model_id}'.")

    spec = SK_MODEL_SPECS[model_id]
    path = get_model_dir() / spec["file"]
    if not path.is_file():
        raise FileNotFoundError(f"Missing model file: {path}")

    obj = joblib.load(path)
    if isinstance(obj, dict) and "model" in obj:
        bundle: dict[str, Any] = dict(obj)
    else:
        bundle = {"model": obj}

    bundle.setdefault("model_name", spec["label"])

    raw_horizon = bundle.get("horizon") or spec.get("horizon_id") or horizon_id
    horizon = get_horizon(raw_horizon)
    if not bundle.get("feature_cols"):
        bundle["feature_cols"] = feature_cols_for(horizon)
    bundle.setdefault("threshold", DEFAULT_THRESHOLD)
    bundle["horizon"] = horizon.id

    return bundle, horizon, spec


def fetch_daily_prices(token_id: str, client: PolymarketClient | None = None) -> pd.DataFrame:
    api = client or PolymarketClient(request_delay=0.0)
    return api.get_price_history(token_id, interval="max", fidelity=1440, bar="1d")


def _prepare_window(
    prices: pd.DataFrame,
    feature_cols: list[str],
    lookback: int,
) -> tuple[pd.DataFrame, np.ndarray]:
    if prices.empty:
        raise ValueError("No price history available.")

    missing = [c for c in feature_cols if c not in prices.columns]
    if missing:
        raise ValueError(f"Missing feature columns: {', '.join(missing)}")

    df = prices.sort_values("date").reset_index(drop=True)
    if len(df) < lookback:
        raise ValueError("Insufficient history for lookback window.")

    window = df.tail(lookback).copy()
    values = window[feature_cols].values.astype(np.float32)
    return window, values


def _scale_features(values: np.ndarray, mean: np.ndarray, scale: np.ndarray) -> np.ndarray:
    mean = np.asarray(mean, dtype=np.float32).reshape(1, -1)
    scale = np.asarray(scale, dtype=np.float32).reshape(1, -1)
    scale = np.where(scale == 0, 1.0, scale)
    return (values - mean) / scale


def _predict_proba(values: np.ndarray, bundle: ModelBundle) -> float:
    scaled = _scale_features(values, bundle.scaler_mean, bundle.scaler_scale)
    x = torch.from_numpy(scaled).float().unsqueeze(0)
    with torch.no_grad():
        output = bundle.model(x)
        logits = output[0] if isinstance(output, tuple) else output
        return float(torch.sigmoid(logits).cpu().numpy().reshape(-1)[0])


def _estimate_change_pct(df: pd.DataFrame) -> float:
    if len(df) < 2:
        return 0.01
    last = float(df["price"].iloc[-1])
    prev = float(df["price"].iloc[-2])
    if prev > 0:
        pct = abs((last - prev) / prev)
        if pct > 0:
            return pct
    series = df["price"].astype(float).values
    prevs = series[:-1]
    diffs = np.diff(series)
    mask = prevs != 0
    if mask.any():
        pct_changes = np.abs(diffs[mask] / prevs[mask])
        avg = float(np.nanmean(pct_changes)) if len(pct_changes) else 0.0
        if avg > 0:
            return avg
    return 0.01


def predict_from_prices(
    prices: pd.DataFrame,
    bundle: ModelBundle,
    *,
    horizon_id: str | None = None,
) -> dict[str, Any]:
    try:
        horizon = get_horizon(horizon_id)
    except ValueError as exc:
        return {"ok": False, "error": str(exc), "code": "HORIZON_INVALID"}

    try:
        window, values = _prepare_window(prices, bundle.feature_cols, bundle.lookback)
    except ValueError as exc:
        message = str(exc)
        if "Insufficient" in message:
            return {
                "ok": False,
                "error": message,
                "code": "INSUFFICIENT_HISTORY",
                "n_prices": len(prices),
                "min_prices": bundle.lookback,
            }
        return {"ok": False, "error": message, "code": "FEATURE_ERROR"}

    steps = max(1, int(horizon.label_steps))
    as_of = window["date"].iloc[-1]
    as_of_str = as_of.isoformat() if hasattr(as_of, "isoformat") else str(as_of)
    current_price = round(float(window["price"].iloc[-1]), 4)

    if steps == 1:
        proba_up = _predict_proba(values, bundle)
        label = int(proba_up >= bundle.threshold)
        direction = "up" if label == 1 else "down"
        return {
            "ok": True,
            "direction": direction,
            "label": label,
            "probability_up": round(proba_up, 4),
            "probability_down": round(1.0 - proba_up, 4),
            "threshold": bundle.threshold,
            "model": bundle.id,
            "model_label": bundle.label,
            "horizon": horizon.id,
            "horizon_label": horizon.label,
            "as_of_date": as_of_str,
            "current_price": current_price,
            "n_prices": len(prices),
        }

    if set(bundle.feature_cols) != {"price"}:
        return {
            "ok": False,
            "error": "Weekly rollout only supports price-only models.",
            "code": "FEATURE_ERROR",
        }

    df = prices.sort_values("date").reset_index(drop=True).copy()
    df["date"] = pd.to_datetime(df["date"], utc=True, errors="coerce")
    df = df.dropna(subset=["date"]).reset_index(drop=True)
    change_pct = _estimate_change_pct(df)
    rollout: list[dict[str, Any]] = []

    for step in range(steps):
        window, values = _prepare_window(df, bundle.feature_cols, bundle.lookback)
        proba_up = _predict_proba(values, bundle)
        label = int(proba_up >= bundle.threshold)
        direction = "up" if label == 1 else "down"
        last_price = float(window["price"].iloc[-1])
        signed_change = change_pct if direction == "up" else -change_pct
        next_price = max(0.0001, last_price * (1.0 + signed_change))
        next_date = window["date"].iloc[-1] + pd.Timedelta(days=1)
        rollout.append(
            {
                "step": step + 1,
                "probability_up": round(proba_up, 4),
                "direction": direction,
                "projected_price": round(next_price, 4),
            }
        )
        df = pd.concat(
            [df, pd.DataFrame([{"date": next_date, "price": next_price}])],
            ignore_index=True,
        )

    final = rollout[-1]
    label = 1 if final["direction"] == "up" else 0
    forecast_through = df["date"].iloc[-1]
    forecast_str = (
        forecast_through.isoformat()
        if hasattr(forecast_through, "isoformat")
        else str(forecast_through)
    )

    return {
        "ok": True,
        "direction": final["direction"],
        "label": label,
        "probability_up": final["probability_up"],
        "probability_down": round(1.0 - float(final["probability_up"]), 4),
        "threshold": bundle.threshold,
        "model": bundle.id,
        "model_label": bundle.label,
        "horizon": horizon.id,
        "horizon_label": horizon.label,
        "as_of_date": as_of_str,
        "forecast_through": forecast_str,
        "current_price": current_price,
        "n_prices": len(prices),
        "rollout_steps": steps,
        "rollout": rollout,
    }


def predict_market_payload(
    market: dict[str, Any],
    *,
    model_id: str,
    horizon_id: str | None = None,
    client: PolymarketClient | None = None,
) -> dict[str, Any]:
    token_ids = market.get("clobTokenIds") or []
    if not isinstance(token_ids, list) or not token_ids:
        return {
            "ok": False,
            "error": "market.clobTokenIds must include at least one token id.",
            "code": "MISSING_TOKEN",
        }

    resolved_id = resolve_model_id(model_id)
    use_lstm = resolved_id in MODEL_SPECS
    use_sklearn = resolved_id in SK_MODEL_SPECS

    if not use_lstm and not use_sklearn:
        return {"ok": False, "error": f"Unknown model id '{model_id}'.", "code": "MODEL_NOT_FOUND"}

    token_id = str(token_ids[0])
    api = client or PolymarketClient(request_delay=0.0)

    try:
        prices = fetch_daily_prices(token_id, client=api)
    except Exception as exc:
        return {
            "ok": False,
            "error": f"Failed to fetch price history: {exc}",
            "code": "CLOB_FETCH_ERROR",
        }

    if use_lstm:
        try:
            bundle = load_model_bundle(resolved_id)
        except KeyError as exc:
            return {"ok": False, "error": str(exc), "code": "MODEL_NOT_FOUND"}
        except FileNotFoundError as exc:
            return {"ok": False, "error": str(exc), "code": "MODEL_NOT_FOUND"}
        except Exception as exc:
            return {
                "ok": False,
                "error": f"Failed to load model: {exc}",
                "code": "MODEL_LOAD_ERROR",
            }

        result = predict_from_prices(prices, bundle, horizon_id=horizon_id)
    else:
        try:
            sk_bundle, horizon, spec = load_sklearn_bundle(resolved_id, horizon_id=horizon_id)
        except KeyError as exc:
            return {"ok": False, "error": str(exc), "code": "MODEL_NOT_FOUND"}
        except FileNotFoundError as exc:
            return {"ok": False, "error": str(exc), "code": "MODEL_NOT_FOUND"}
        except Exception as exc:
            return {
                "ok": False,
                "error": f"Failed to load model: {exc}",
                "code": "MODEL_LOAD_ERROR",
            }

        result = sk_predict_from_price_frame(
            prices,
            sk_bundle,
            horizon=horizon,
            slug=str(market.get("slug") or ""),
            question=str(market.get("question") or ""),
        )
        if result.get("ok"):
            result["model"] = resolved_id
            result["model_label"] = spec["label"]
            result["horizon"] = horizon.id
            result["horizon_label"] = horizon.label
    result.update(
        {
            "token_id": token_id,
            "predicted_at": datetime.now(timezone.utc).isoformat(),
            "slug": str(market.get("slug") or ""),
            "question": str(market.get("question") or ""),
        }
    )
    return result
