#importing libs
from redis.asyncio import Redis
import json
from typing import Dict
import logging
from fastapi import HTTPException
from datetime import datetime, timezone, timedelta

#importing dependendancies
from config import CF_API_TOKEN, RADAR_BASE
from utils.cache import RedisCache
from utils.http_client import client

#intializing
HEADERS = {"Authorization": f"Bearer {CF_API_TOKEN}"}
logger = logging.getLogger("uvicorn")

async def cached_fetch(url: str, params:Dict = None, cache: RedisCache = None, cache_key: str = None, ttl: int = 30):
    if not cache_key:
        cache_key = f"url:{url}:{params}"
    cached = await cache.get_cache(cache_key)
    if cached:
        logger.info(f"[cache HIT] {cache_key}")
    r = await client.get(url, params=params, headers=HEADERS)
    logger.info(f"[Cloudflare Fetch] {url} {r.status_code}")
    if r.status_code != 200:
        logger.error(f"[Cloudflare Error] {r.text}")
        raise HTTPException(status_code=r.status_code, detail=f"Upstream error: {r.text}")
    data = r.json()
    await cache.set_cache(cache_key, data, ttl=ttl)
    return data

async def fetch_layer7_summary_data(cache: RedisCache, date_start, date_end, limit: int = 10):
    # Ensure date_start and date_end are in correct ISO format already
    http_data = await cached_fetch(
        f"{RADAR_BASE}/layer7/summary/http_method",
        params={"dateStart": date_start, "dateEnd": date_end, "limitPerGroup": limit},
        cache=cache,
        cache_key=f"radar:layer7:http:{date_start}-{date_end}",
        ttl=60
    )

    industry_data = await cached_fetch(
        f"{RADAR_BASE}/layer7/summary/industry",
        params={"dateStart": date_start, "dateEnd": date_end, "limitPerGroup": limit},
        cache=cache,
        cache_key=f"radar:layer7:industry:{date_start}-{date_end}",
        ttl=60
    )

    summary = {
        "http_method_summary": http_data.get("result", {}).get("summary_0", []),
        "targeted_industry_summary": industry_data.get("result", {}).get("summary_0", []),
    }

    await cache.redis.set("radar:layer7_summary", json.dumps(summary), ex=60)
    logger.info("Updated Layer7 summary in Redis")
    return summary
