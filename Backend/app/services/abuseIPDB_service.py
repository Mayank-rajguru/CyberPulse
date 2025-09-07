from fastapi import HTTPException

from utils.cache import RedisCache
from config import ABUSE_CHECK_URL, ABUSE_KEY
from utils.http_client import client

cache = RedisCache()


async def abuse_check(ip: str):
    cache_key = f"abuse:{ip}"
    cached = await cache.get_cache(cache_key)
    if cached:
        return cached
    headers = {"Key": ABUSE_KEY, "Accept": "application/json"}
    params = {"ipAddress": ip, "maxAgeInDays": 90}
    r = await client.get(ABUSE_CHECK_URL, params=params, headers=headers)
    if r.status_code == 429:
        raise HTTPException(status_code=429, detail="AbuseIPDB rate limit")
    if r.status_code != 200:
        raise HTTPException(status_code=r.status_code, detail=r.text)
    data = r.json()
    await cache.set_cache(cache_key, data, ttl=60*60*24)
    return data