"""Training helpers: metrics, evaluation, threshold search."""

from __future__ import annotations

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    brier_score_loss,
    classification_report,
    confusion_matrix,
    f1_score,
)


def majority_baseline(y: np.ndarray) -> dict:
    values, counts = np.unique(y, return_counts=True)
    pred = np.full_like(y, values[counts.argmax()])
    return _metrics_dict(y, pred, proba=None)


def _metrics_dict(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    proba: np.ndarray | None,
) -> dict:
    out: dict = {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "balanced_accuracy": float(balanced_accuracy_score(y_true, y_pred)),
        "f1_macro": float(f1_score(y_true, y_pred, average="macro", zero_division=0)),
        "confusion_matrix": confusion_matrix(y_true, y_pred).tolist(),
        "classification_report": classification_report(
            y_true, y_pred, target_names=["down", "up"], zero_division=0
        ),
    }
    if proba is not None:
        out["brier_score"] = float(brier_score_loss(y_true, proba))
    return out


def evaluate_classifier(
    estimator,
    X_test: np.ndarray,
    y_test: np.ndarray,
    *,
    threshold: float = 0.5,
) -> dict:
    """Fit is assumed done; predict with optional probability threshold."""
    if hasattr(estimator, "predict_proba"):
        proba = estimator.predict_proba(X_test)[:, 1]
        y_pred = (proba >= threshold).astype(int)
    else:
        proba = None
        y_pred = estimator.predict(X_test).astype(int)
    return _metrics_dict(y_test, y_pred, proba)


def find_best_threshold(
    estimator,
    X_val: np.ndarray,
    y_val: np.ndarray,
    metric: str = "accuracy",
) -> tuple[float, dict]:
    """Grid-search probability threshold on a validation set."""
    if not hasattr(estimator, "predict_proba"):
        pred = estimator.predict(X_val).astype(int)
        return 0.5, _metrics_dict(y_val, pred, proba=None)

    proba = estimator.predict_proba(X_val)[:, 1]
    best_t = 0.5
    best_score = -1.0
    best_metrics: dict = {}

    for t in np.linspace(0.25, 0.75, 51):
        pred = (proba >= t).astype(int)
        if metric == "balanced_accuracy":
            score = balanced_accuracy_score(y_val, pred)
        else:
            score = accuracy_score(y_val, pred)
        if score > best_score:
            best_score = score
            best_t = float(t)
            best_metrics = _metrics_dict(y_val, pred, proba=proba)

    best_metrics["threshold"] = best_t
    return best_t, best_metrics
