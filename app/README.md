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
| `INFERENCE_API_URL` | URL absoluta del POST de inferencia (p. ej. `http://127.0.0.1:8000/predict`). Si falta, `/api/predict` responde **501** con un mensaje claro. |
| `INFERENCE_API_KEY` | Opcional. Si existe, se envía `Authorization: Bearer …` al backend. |

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

- `GET /api/markets` — Lista mercados con `active=true` y `closed=false` vía [Gamma API](https://gamma-api.polymarket.com). Query: `limit`, `offset`, `search` (opcional).
- `POST /api/predict` — Proxy al backend de inferencia.
