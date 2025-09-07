import os, time, asyncio
from datetime import datetime, timedelta, timezone
from contextlib import asynccontextmanager
from typing import Any, Dict
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import httpx
from pydantic import BaseModel
from dotenv import load_dotenv
from utils.cache import RedisCache
import logging
import json
import pycountry
logger = logging.getLogger("uvicorn")

from routes.attacks import router as attacks_router


load_dotenv()
CF_API_TOKEN = os.getenv("CF_API_TOKEN") or ""
ABUSE_KEY = os.getenv("ABUSEIPDB_KEY") or ""
CF_GRAPHQL = "https://api.cloudflare.com/client/v4/graphql"
RADAR_BASE = "https://api.cloudflare.com/client/v4/radar/attacks"

if not CF_API_TOKEN:
    raise RuntimeError("CF_TOKEN env var is required")


cache = RedisCache()
client = httpx.AsyncClient(timeout=20.0)

HEADERS = {"Authorization": f"Bearer {CF_API_TOKEN}"}

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await cache.connect()
    print("✅ Connected to Redis")

    task = asyncio.create_task(publish_attacks_loop())

    yield  # ⬅️ everything after this runs on shutdown

    # Shutdown
    task.cancel()
    if cache.redis:
        await cache.redis.close()
        print("🛑 Redis connection closed")

app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173","http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


async def cached_fetch(url: str, params: Dict = None, cache_key: str = None, ttl: int = 30):
    if not cache_key:
        cache_key = f"url:{url}:{params}"
    cached = await cache.get_cache(cache_key)
    if cached:
        logger.info(f"[CACHE HIT] {cache_key}")
        return cached
    r = await client.get(url, params=params, headers=HEADERS)
    logger.info(f"[CLOUDFLARE FETCH] {url} {r.status_code}")
    if r.status_code != 200:
        logger.error(f"[CLOUDFLARE ERROR] {r.text}")
        raise HTTPException(status_code=r.status_code, detail=f"Upstream error: {r.text}")
    data = r.json()
    await cache.set_cache(cache_key, data, ttl=ttl)
    return data

@app.get("/api/radar/top-targets")
async def radar_top_targets(limit: int = 20, hours: int = 1):
    end = datetime.now(timezone.utc)
    start = end - timedelta(hours=hours)

    params = {
        "name": "attack_target",
        "limit": limit,
        "dateStart": start.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "dateEnd": end.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "format": "json"
    }

    return await cached_fetch(
        f"{RADAR_BASE}/layer7/top/locations/target",
        params=params,
        cache_key=f"radar:top-targets:{limit}:{start.isoformat()}-{end.isoformat()}",
        ttl=30
    )

@app.get("/api/radar/top-pairs")
async def radar_top_pairs(limit: int = 50, hours: int = 1):
    end = datetime.now(timezone.utc)
    start = end - timedelta(hours=hours)

    params = {
        "limit": limit,
        "dateStart": start.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "dateEnd": end.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "format": "json"
    }

    return await cached_fetch(
        f"{RADAR_BASE}/layer7/top/attacks",
        params=params,
        cache_key=f"radar:top-pairs:{limit}:{start.isoformat()}-{end.isoformat()}",
        ttl=30
    )


@app.post("/api/zone/graphql")
async def zone_graphql(query: Dict):
    r = await client.post(CF_GRAPHQL, json=query, headers=HEADERS)
    if r.status_code != 200:
        raise HTTPException(status_code=r.status_code, detail=f"GraphQL error: {r.text}")
    return r.json()

ABUSE_CHECK_URL = "https://api.abuseipdb.com/api/v2/check"
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

@app.get("/api/enrich/ip")
async def enrich_ip(ip: str = Query(..., description="IPv4/IPv6 address")):
    if not ABUSE_KEY:
        raise HTTPException(status_code=400, detail="AbuseIPDB key not configured")
    return await abuse_check(ip)



def detect_spikes(timeseries: list[float], window:int=12, multiplier:float=4.0):
    spikes = []
    for i in range(window, len(timeseries)):
        window_avg = sum(timeseries[i-window:i]) / window
        if window_avg == 0:
            continue
        if timeseries[i] > window_avg * multiplier:
            spikes.append({"index": i, "value": timeseries[i], "baseline": window_avg})
    return spikes

@app.post("/api/detect-spikes")
async def detect_spikes_endpoint(series: Dict):
    values = series.get("values", [])
    if not isinstance(values, list):
        raise HTTPException(status_code=400, detail="values must be array")
    return {"spikes": detect_spikes(values)}

app.include_router(attacks_router)


async def publish_attacks_loop():
    """Continuously fetch Cloudflare attack data and publish to Redis."""
    logger.info("🚀 Starting continuous attacks publisher loop")

    while True:
        try:
            time_Interval = 120
            # Get the current time on the minute boundary, then go back 1 minute to get the last *complete* minute.
            end = datetime.now(timezone.utc)
            start = end - timedelta(minutes=time_Interval)

            # Safety check: if our start time is not before our end time, something is wrong.
            if start >= end:
                logger.info("⏳ No valid time window yet, sleeping...")
                await asyncio.sleep(15)
                continue

            # ✅ use same formatting as your working API route

            logger.info(f"📡 Fetching attacks {start} → {end}")

            data = await cached_fetch(
                f"{RADAR_BASE}/layer7/top/attacks",
                params={
                    "limit": 20,
                    "dateStart": start.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "dateEnd": end.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "format": "json"
                },
                cache_key=f"radar:continuous:{start.isoformat()}-{end.isoformat()}",
                ttl=60
            )

            result = data.get("result", {})
            pairs = result.get("top_0", [])
            if pairs:
                for pair in pairs:
                    event = {
                        "origin": {
                            "code": pair.get("originCountryAlpha2", "XX"),
                            "name": pair.get("originCountryName", "Unknown"),
                        },
                        "target": {
                            "code": pair.get("targetCountryAlpha2", "XX"),
                            "name": pair.get("targetCountryName", "Unknown"),
                        },
                        "value": float(pair.get("value", 0)),
                        "rank": pair.get("rank", -1),
                        "timeRange": {"start": start.isoformat(), "end": end.isoformat()}
                    }
                    await cache.redis.publish("cyberattacks", json.dumps(event, default=str))
                logger.info(f"✅ Published {len(pairs)} attacks to Redis")
            else:
                logger.info("⚠️ No new attacks in this window.")

            await asyncio.sleep(15)

        except Exception as e:
            logger.error(f"❌ Publisher loop error: {e}", exc_info=True)
            await asyncio.sleep(10)