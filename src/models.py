"""Classifier candidates for up/down prediction."""

from __future__ import annotations

from typing import Any

import numpy as np
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

RANDOM_STATE = 42


def _pos_weight(y: np.ndarray) -> float:
    """scale_pos_weight for XGBoost: count(neg) / count(pos)."""
    pos = max(int((y == 1).sum()), 1)
    neg = max(int((y == 0).sum()), 1)
    return neg / pos


def build_model(name: str, y_train: np.ndarray | None = None) -> Any:
    """Return an unfitted estimator (Pipeline or classifier) by name."""
    name = name.lower().replace("-", "_")

    if name in ("logistic", "logistic_regression", "lr"):
        return Pipeline(
            [
                ("scaler", StandardScaler()),
                (
                    "clf",
                    LogisticRegression(
                        max_iter=2000,
                        class_weight="balanced",
                        random_state=RANDOM_STATE,
                    ),
                ),
            ]
        )

    if name in ("rf", "random_forest"):
        return RandomForestClassifier(
            n_estimators=300,
            max_depth=12,
            min_samples_leaf=20,
            class_weight="balanced_subsample",
            n_jobs=-1,
            random_state=RANDOM_STATE,
        )

    if name in ("gb", "gradient_boosting", "gbt"):
        return GradientBoostingClassifier(
            n_estimators=200,
            max_depth=5,
            learning_rate=0.05,
            min_samples_leaf=20,
            random_state=RANDOM_STATE,
        )

    if name in ("xgb", "xgboost"):
        try:
            from xgboost import XGBClassifier
        except ImportError as exc:
            raise ImportError(
                "XGBoost not installed. Run: pip install xgboost"
            ) from exc
        spw = _pos_weight(y_train) if y_train is not None else 1.0
        return XGBClassifier(
            n_estimators=300,
            max_depth=6,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            scale_pos_weight=spw,
            eval_metric="logloss",
            random_state=RANDOM_STATE,
            n_jobs=-1,
        )

    raise ValueError(f"Unknown model: {name}")


def model_names(include_xgb: bool = True) -> list[str]:
    names = ["logistic_regression", "random_forest", "gradient_boosting"]
    if include_xgb:
        try:
            import xgboost  # noqa: F401
            names.append("xgboost")
        except ImportError:
            pass
    return names


def build_all_models(y_train: np.ndarray, include_xgb: bool = True) -> dict[str, Any]:
    """Build all available model estimators."""
    out: dict[str, Any] = {}
    for name in model_names(include_xgb=include_xgb):
        key = name
        if key == "xgboost":
            out[key] = build_model("xgboost", y_train=y_train)
        elif key == "logistic_regression":
            out[key] = build_model("logistic_regression")
        elif key == "random_forest":
            out[key] = build_model("random_forest")
        else:
            out[key] = build_model("gradient_boosting")
    return out
