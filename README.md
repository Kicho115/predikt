# Predikt

Market prediction demo with a FastAPI inference backend and a Next.js frontend.

## Requirements

- Python 3.10+
- Node.js 18+ and pnpm (or npm)

## Backend (FastAPI)

From the repo root:

```bash
python -m venv .venv
# Windows PowerShell
\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

uvicorn backend.main:app --reload
```

Optional environment variable for model location (defaults to data/processed):

```bash
# Windows PowerShell
$env:MODEL_DIR="C:\path\to\models"
```

The backend exposes:

- GET /models
- POST /predict?model=...

## Frontend (Next.js)

From the app folder:

```bash
cd app
pnpm install
pnpm dev
```

Open http://localhost:3000.

Create app/.env.local if you want to call the backend:

```bash
INFERENCE_API_URL=http://localhost:8000/predict
```

## Generate models

## Load dataset

Primary (recommended): download the prepared dataset from Google Drive and extract into `data/raw`:

1. Open the folder in your browser: https://drive.google.com/drive/folders/1aZKLhm752pbeKUIG_efxDsdaC2HwJaCw?usp=sharing
2. Download the folder as a ZIP and extract so the CSV files land under `data/raw/` (you should end up with `data/raw/prices_*.csv` and `data/raw/markets_catalog.csv`).

Alternative: use the Polymarket collector to fetch fresh data into `data/raw`:

```bash
python scripts/collect_polymarket.py --target 500 --min-volume 1000
```

Either method produces the same required files: `data/raw/prices_*.csv` and `data/raw/markets_catalog.csv`.

### Sklearn (.pkl)

Run the notebook at notebooks/Notebook_ML.ipynb. It produces sklearn bundles like:

- horizon_1d.pkl
- horizon_1w.pkl
- best_model.pkl
- baseline_v1.pkl
- model_RandomForest.pkl
- model_GradientBoosting.pkl

Place the .pkl files under data/processed (or set MODEL_DIR to their folder).

### LSTM (.pt)

Run the notebooks:

- notebooks/deep-learning/05_lstm_baseline.ipynb
- notebooks/deep-learning/lstm_atention.ipynb

They save lstm_baseline.pt and lstm_attention.pt under data/processed by default.
