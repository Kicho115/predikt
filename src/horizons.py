"""Prediction horizon definitions (daily bars only — CLOB fidelity 1440)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class HorizonSpec:
    """One prediction horizon on daily price bars."""

    id: str
    label: str
    label_steps: int
    min_bars: int
    ret_windows: tuple[int, int, int] = (1, 3, 7)
    ma_short: int = 7
    ma_long: int = 14
    vol_window: int = 7


HORIZONS: dict[str, HorizonSpec] = {
    "1d": HorizonSpec(
        id="1d",
        label="próximo día",
        label_steps=1,
        min_bars=30,
    ),
    "1w": HorizonSpec(
        id="1w",
        label="próxima semana",
        label_steps=7,
        min_bars=45,
    ),
}

DEFAULT_HORIZON_ID = "1d"

HORIZON_ALIASES: dict[str, str] = {
    "1d": "1d",
    "1w": "1w",
    "1m": "1d",
    "all": "1d",
}


def normalize_horizon_id(raw: str | None) -> str:
    key = (raw or DEFAULT_HORIZON_ID).strip().lower()
    return HORIZON_ALIASES.get(key, DEFAULT_HORIZON_ID)


def get_horizon(horizon_id: str | None) -> HorizonSpec:
    hid = normalize_horizon_id(horizon_id)
    if hid not in HORIZONS:
        raise ValueError(f"Unknown horizon '{horizon_id}'. Use: {', '.join(HORIZONS)}")
    return HORIZONS[hid]


def feature_cols_for(horizon: HorizonSpec) -> list[str]:
    return [
        "ret_1d",
        "ret_3d",
        "ret_7d",
        "ma7",
        "ma14",
        "ma_ratio",
        "vol7",
        "price",
    ]
