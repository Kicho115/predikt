# Predikt

Sistema de predicción de movimientos en mercados de predicción descentralizados (Polymarket)
usando señales endógenas de precios y features técnicas.

## Estructura del proyecto

```
predikt/
├── data/
│   ├── raw/           # CSV tal como llegan de las APIs (ignorado en git)
│   └── processed/     # Features procesadas, modelos .pkl (ignorado en git)
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

## Ejecución (en orden)

Abrir los notebooks en Jupyter y ejecutar en orden con el kernel **Python 3 (predikt)**:

1. `01_data_collection.ipynb` — descarga precios de Polymarket
2. `02_eda.ipynb` — visualización y análisis exploratorio
3. `03_feature_engineering.ipynb` — construcción de la matriz de features
4. `04_baseline_model.ipynb` — entrenamiento y comparación de modelos baseline
5. `deep-learning/05_lstm_baseline.ipynb` — baseline LSTM con features de precio

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
