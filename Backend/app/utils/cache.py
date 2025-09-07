from redis.asyncio import Redis
import json
from typing import Optional

class RedisCache:
    def __init__(self, url="redis://localhost:6379", db=0):
        self.url = url
        self.db = db
        self.redis = None

    async def connect(self):
        self.redis = Redis.from_url(self.url, decode_responses=True, db=self.db)

    async def set_cache(self, key:str, value:dict, ttl: int=60):
        await self.redis.set(key, json.dumps(value), ex=ttl)

    async def get_cache(self, key:str) -> Optional[dict]:
        data = await self.redis.get(key)
        return json.loads(data) if data else None
    
    async def publish_event(self, channel:str, event: dict):
        await self.redis.publish(channel, json.dumps(event))