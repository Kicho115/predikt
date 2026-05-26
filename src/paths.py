"""Repository path constants."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "raw"
PROCESSED_DIR = ROOT / "processed"
MODELS_DIR = PROCESSED_DIR / "models"
