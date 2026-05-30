from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from backend.lstm_inference import (
    DEFAULT_MODEL_ID,
    list_available_models,
    predict_market_payload,
)
from src.polymarket import PolymarketClient

app = FastAPI()
client = PolymarketClient(request_delay=0.0)


class MarketSummary(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str | None = None
    slug: str
    question: str
    volume: float = 0.0
    clobTokenIds: list[str] = Field(default_factory=list)
    conditionId: str | None = None


class PredictRequest(BaseModel):
    market: MarketSummary
    horizon: str | None = None


STATUS_BY_CODE: dict[str, int] = {
    "MODEL_NOT_FOUND": 404,
    "MODEL_LOAD_ERROR": 500,
    "MISSING_TOKEN": 400,
    "CLOB_FETCH_ERROR": 502,
    "INSUFFICIENT_HISTORY": 400,
    "FEATURE_ERROR": 400,
    "HORIZON_INVALID": 400,
}


@app.get("/")
async def root():
    return {"ok": True, "message": "Predikt inference API"}


@app.get("/health")
async def health():
    return {"ok": True}


@app.get("/models")
async def models():
    return {"models": list_available_models(), "default": DEFAULT_MODEL_ID}


@app.post("/predict")
async def predict(req: PredictRequest, model: str = Query(DEFAULT_MODEL_ID, min_length=1)):
    result = predict_market_payload(
        req.market.model_dump(),
        model_id=model,
        horizon_id=req.horizon,
        client=client,
    )
    status = STATUS_BY_CODE.get(result.get("code", ""), 200 if result.get("ok") else 500)
    return JSONResponse(result, status_code=status)