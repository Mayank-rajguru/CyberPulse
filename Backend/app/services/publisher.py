from datetime import datetime, timezone, timedelta
import logging
import asyncio
import json

from utils.cache import RedisCache
from config import RADAR_BASE
from services.cloudflare_service import cached_fetch

logger = logging.getLogger("uvicorn")

async def publish_attacks_loop(cache: RedisCache):
    """Continuously fetch Cloudflare attack data and publish to Redis."""
    logger.info("publisher loop is live")

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

            logger.info(f"Fetching attacks {start} → {end}")

            data = await cached_fetch(
                f"{RADAR_BASE}/layer7/top/attacks",
                params={
                    "limit": 20,
                    "dateStart": start.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "dateEnd": end.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "format": "json"
                },
                cache=cache,
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
                logger.info(f"Published {len(pairs)} attacks to Redis")
            else:
                logger.info("No new attacks in this window.")

            await asyncio.sleep(15)

        except Exception as e:
            logger.error(f"Publisher loop error!!: {e}", exc_info=True)
            await asyncio.sleep(10)