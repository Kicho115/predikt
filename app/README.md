# Predikt (web)

Interfaz Next.js para elegir un mercado **activo** de Polymarket y enviar su payload al servicio de inferencia.

## Desarrollo

Desde esta carpeta (`app/`):

```bash
pnpm install
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Variables de entorno

Copia `.env.example` a `.env.local` y define:

| Variable | Descripción |
|----------|-------------|
| `INFERENCE_API_URL` | Opcional. URL del POST de inferencia (p. ej. `http://127.0.0.1:8000/predict`). Si está definida, Next hace proxy a ese servicio. |
| `INFERENCE_API_KEY` | Opcional. Si existe, se envía `Authorization: Bearer …` al backend remoto. |
| `PREDIKT_ROOT` | Opcional. Ruta al repo con `processed/models/best_model.pkl`. Por defecto se detecta subiendo desde `app/`. |
| `PREDIKT_PYTHON` | Opcional. Ejecutable Python (`python` en Windows). |

**Sin `INFERENCE_API_URL`:** `/api/predict` usa barras diarias y `horizon` (`1d`|`1w`) con `processed/models/horizon_{id}.pkl`.

Servidor HTTP alternativo (desde la raíz del repo):

```bash
python scripts/serve_inference.py --port 8000
```

Luego en `.env.local`: `INFERENCE_API_URL=http://127.0.0.1:8000/predict`

Los navegadores solo hablan con Next (`/api/markets`, `/api/predict`). Las llamadas a Polymarket y a inferencia salen del servidor.

## Contrato JSON (inferencia)

El cliente envía un POST a `/api/predict` con:

```json
{
  "market": {
    "id": "… | null",
    "slug": "…",
    "question": "…",
    "volume": 0,
    "clobTokenIds": ["…"],
    "conditionId": "… | null"
  }
}
```

Next valida esta forma y reenvía el mismo JSON a `INFERENCE_API_URL`.

## Rutas internas

- `GET /api/markets` — Mercados activos vía [Gamma API](https://gamma-api.polymarket.com). Por defecto `sort=trending`: agrupa por evento y ordena por volumen 24h. Query: `limit`, `offset` (sobre la lista ya ordenada), `search` (opcional), `sort=trending|default`.
- `GET /api/price-history` — Historial de precios YES vía [CLOB API](https://clob.polymarket.com). Query: `tokenId` (primer `clobTokenId`), `timeframe` (`1D`|`1W`|`1M`|`ALL`).
- `POST /api/predict` — Proxy al backend de inferencia.
