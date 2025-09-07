#importing libs
from redis.asyncio import Redis
from typing import Dict
import logging
from fastapi import HTTPException

#importing dependendancies
from config import CF_API_TOKEN
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

