from datetime import datetime, timezone, timedelta
from fastapi import APIRouter

from config import RADAR_BASE
from services.cloudflare_service import cached_fetch

router = APIRouter()

@router.get("/api/radar/top-targets")
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

@router.get("/api/radar/top-pairs")
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
