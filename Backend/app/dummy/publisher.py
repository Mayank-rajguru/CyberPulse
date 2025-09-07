import asyncio
import json
import random
from redis.asyncio import Redis
from datetime import datetime

REDIS_URL = "redis://localhost:6379"
CHANNEL = "cyberattacks"

# Some random world coordinates (major cities for demo)
LOCATIONS = [
    {"lat": 40.7128, "lng": -74.0060, "country": "USA"},        # New York
    {"lat": 51.5074, "lng": -0.1278, "country": "UK"},          # London
    {"lat": 35.6895, "lng": 139.6917, "country": "Japan"},      # Tokyo
    {"lat": 28.6139, "lng": 77.2090, "country": "India"},       # Delhi
    {"lat": -33.8688, "lng": 151.2093, "country": "Australia"}, # Sydney
    {"lat": 55.7558, "lng": 37.6173, "country": "Russia"},      # Moscow
]

async def publish_attacks():
    redis = Redis.from_url(REDIS_URL, decode_responses=True)

    try:
        while True:
            loc = random.choice(LOCATIONS)
            attack = {
                "latitude": loc["lat"],
                "longitude": loc["lng"],
                "country": loc["country"],
                "source_ip": f"192.168.{random.randint(0,255)}.{random.randint(0,255)}",
                "timestamp": datetime.utcnow().isoformat(),
            }

            await redis.publish(CHANNEL, json.dumps(attack))
            print(f"🚀 Published attack: {attack}")

            await asyncio.sleep(random.uniform(1, 3))  # 1–3 seconds between attacks

    finally:
        await redis.close()

if __name__ == "__main__":
    asyncio.run(publish_attacks())
