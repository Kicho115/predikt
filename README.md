# Predikt

Sistema de predicción de movimientos en mercados de predicción descentralizados (Polymarket)
usando señales endógenas de precios y features técnicas.

## Estructura del proyecto

```
predikt/
├── raw/               # CSV de precios (prices_*.csv) y catálogo
├── processed/         # Reportes, matriz de entrenamiento, modelos .pkl
├── scripts/
│   ├── 01_validate_dataset.py
│   └── 02_train_baseline.py
├── notebooks/
│   ├── 01_data_collection.ipynb   # Descarga Polymarket (Gamma + CLOB)
│   ├── 02_eda.ipynb               # Análisis exploratorio
│   ├── 03_feature_engineering.ipynb  # Construcción de features
│   └── 04_baseline_model.ipynb    # Modelos clásicos de ML + calibración
├── src/
│   ├── polymarket.py   # Cliente Polymarket API (Gamma + CLOB)
│   └── features.py     # Ingeniería de características
└── requirements.txt
```

## Setup

```powershell
# Crear y activar entorno virtual
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Instalar dependencias
pip install -r requirements.txt

# Registrar kernel Jupyter
python -m ipykernel install --user --name predikt --display-name "Python 3 (predikt)"
```

## Inferencia local (web + modelo entrenado)

Entrena modelos con barras **diarias** (única resolución fiable en CLOB):

```powershell
python scripts/04_train_horizons.py --horizons 1d 1w
```

Salida: `processed/models/horizon_1d.pkl`, `horizon_1w.pkl`.

En la app: horizonte **1 día** o **1 semana** (los datos de entrenamiento son diarios; no hay historial fiable por debajo de 24 h).

## Pipeline ML (scripts)

Desde la raíz del repo, con el entorno activado:

```powershell
# Paso 1 — validar CSV en raw/ (mín. 30 precios por mercado)
python scripts/01_validate_dataset.py

# Paso 2 — baseline logístico únicamente
python scripts/02_train_baseline.py

# Paso 2b — comparar LR, Random Forest, Gradient Boosting, XGBoost
pip install xgboost
python scripts/03_compare_models.py --tune-threshold
```

Salidas en `processed/`:

| Archivo | Descripción |
| ------- | ----------- |
| `dataset_validation_report.csv` | Cobertura y elegibilidad por mercado |
| `eligible_slugs.json` | Slugs usados para entrenar |
| `train_matrix.csv` | Panel día × mercado con features |
| `models/baseline_v1.pkl` | Pipeline StandardScaler + LogisticRegression |
| `models/metrics.json` | Métricas en test (split temporal por mercado) |

Opciones: `--min-prices 30`, `--require-closed` (solo slugs con `endDate` pasado en el catálogo).

## Ejecución (notebooks)

Abrir los notebooks en Jupyter y ejecutar en orden con el kernel **Python 3 (predikt)**:

1. `01_data_collection.ipynb` — descarga precios de Polymarket
2. `02_eda.ipynb` — visualización y análisis exploratorio
3. `03_feature_engineering.ipynb` — construcción de la matriz de features
4. `04_baseline_model.ipynb` — entrenamiento y comparación de modelos baseline
5. `deep-learning/05_lstm_baseline.ipynb` — baseline LSTM con features de precio
6. `Notebook_ML.ipynb` — visualización del pipeline ML (métricas, modelos, confusion matrices)

## Fuentes de datos

| Dataset            | Fuente                                 | Acceso            |
| ------------------ | -------------------------------------- | ----------------- |
| Precios Polymarket | CLOB API (`clob.polymarket.com`)       | Público, sin auth |
| Lista de mercados  | Gamma API (`gamma-api.polymarket.com`) | Público, sin auth |

## Modelos implementados

### Avance actual (Classical ML)

- **Baseline**: mayoría de clase
- **Modelo 1**: Logistic Regression
- **Modelo 2**: Random Forest (features de mercado)
- **Modelo 3**: Gradient Boosting (features de mercado)

### Siguiente avance (Deep Learning)

- LSTM baseline sobre series de precios (ver notebook 05)
- Temporal Fusion Transformer (`pytorch-forecasting`) para la serie temporal

## Métricas de evaluación

- Accuracy, Precision, Recall, F1-score (macro y weighted)
- Brier Score (calibración)
- Calibración de probabilidades: Isotonic Regression
