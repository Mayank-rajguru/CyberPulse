import asyncio
import json
import logging
from datetime import datetime, timezone, timedelta

from utils.cache import RedisCache
from config import RADAR_BASE
from services.cloudflare_service import cached_fetch, fetch_layer7_summary_data

logger = logging.getLogger("uvicorn")


async def publish_attacks_loop(cache: RedisCache):
    """Continuously fetch Cloudflare Layer7 attack data and publish to Redis."""
    logger.info("Publisher loop is live")

    while True:
        try:
            # ---- Time window: last 2 minutes ----
            time_Interval = 120
            end = datetime.now(timezone.utc)
            start = end - timedelta(minutes=time_Interval)

# Safety: ensure end > start by at least 1 second
            if end <= start:
                end = start + timedelta(seconds=1)




            logger.info(f"Fetching attacks {start} → {end}")

            # ---- 1. Fetch top attack pairs ----
            top_pairs_data = await cached_fetch(
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
            top_pairs = top_pairs_data.get("result", {}).get("top_0", [])
            for pair in top_pairs:
                event = {
                    "type": "attack",
                    "origin": {
                        "code": pair.get("originCountryAlpha2", "XX"),
                        "name": pair.get("originCountryName", "Unknown")
                    },
                    "target": {
                        "code": pair.get("targetCountryAlpha2", "XX"),
                        "name": pair.get("targetCountryName", "Unknown")
                    },
                    "value": float(pair.get("value", 0)),
                    "rank": pair.get("rank", -1),
                    "timeRange": {"start": start.isoformat(), "end": end.isoformat()}
                }
                await cache.redis.publish("cyberattacks", json.dumps(event, default=str))
            logger.info(f"Published {len(top_pairs)} top-pairs to Redis")

            # ---- 2. Fetch top attack targets ----
            top_targets_data = await cached_fetch(
                f"{RADAR_BASE}/layer7/top/locations/target",
                params={
                    "name": "attack_target",
                    "limit": 10,
                    "dateStart": start.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "dateEnd": end.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "format": "json"
                },
                cache=cache,
                cache_key=f"radar:top-targets:{start.isoformat()}-{end.isoformat()}",
                ttl=60
            )
            top_targets = top_targets_data.get("result", {}).get("top_0", [])
            await cache.redis.set("radar:top_targets", json.dumps(top_targets), ex=60)
            top_targets_event = {"type": "top_targets", "data": top_targets}
            await cache.redis.publish("cyberattacks", json.dumps(top_targets_event))
            logger.info(f"Updated top-targets in Redis: {len(top_targets)} items")

            # ---- 3. Fetch Layer7 summary ----
            layer7_summary = await fetch_layer7_summary_data(
            cache=cache,
            date_start=start.strftime("%Y-%m-%dT%H:%M:%SZ"),
            date_end=end.strftime("%Y-%m-%dT%H:%M:%SZ"),
            limit=5
            )

            await cache.redis.set("radar:layer7_summary", json.dumps(layer7_summary), ex=60)
            layer7_summary_event = {"type": "layer7_summary", "data": layer7_summary}
            await cache.redis.publish("cyberattacks", json.dumps(layer7_summary_event))
            logger.info("Updated Layer7 summary in Redis")

            # ---- Sleep before next fetch ----
            await asyncio.sleep(15)

        except Exception as e:
            logger.error(f"Publisher loop error: {e}", exc_info=True)
            await asyncio.sleep(10)
