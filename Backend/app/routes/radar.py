from fastapi import APIRouter, Depends
from utils.cache import RedisCache  # your existing Redis wrapper
import json

router = APIRouter()

@router.get("/api/radar/layer7-summary")
async def get_layer7_summary(cache: RedisCache = Depends()):
    data = await cache.redis.get("radar:layer7_summary")
    if data:
        return json.loads(data)
    return {"message": "No data available"}

@router.get("/api/radar/top-targets")
async def get_top_targets(cache: RedisCache = Depends()):
    data = await cache.redis.get("radar:top_targets")
    if data:
        return json.loads(data)
    return {"message": "No data available"}
