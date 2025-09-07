from redis.asyncio import Redis
import json
import asyncio

REDIS_URL = "redis://localhost:6379"
CHANNEL = "cyberattacks"

async def publish_attack_event(event: dict):
    redis = Redis.from_url(REDIS_URL, decode_responses=True)
    await redis.publish(CHANNEL, json.dumps(event))

# Example attack event
async def test_event():
    event = {
        "source_ip": "192.168.1.10",
        "country": "US",
        "latitude": 37.7749,
        "longitude": -122.4194,
        "target": "yourserver.com",
        "action": "blocked",
        "timestamp": "2025-09-05T12:00:00Z"
    }
    await publish_attack_event(event)

# Run for testing
if __name__ == "__main__":
    asyncio.run(test_event())
