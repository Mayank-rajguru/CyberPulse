import asyncio
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from utils.cache import RedisCache
from utils.http_client import client
from services.publisher import publish_attacks_loop
from routes import radar, enrich, attacks

logger = logging.getLogger("uvicorn")
cache = RedisCache()

@asynccontextmanager
async def lifespan(app: FastAPI):
    await cache.connect()
    logger.info("Connected to Redis")

    task = asyncio.create_task(publish_attacks_loop(cache))

    yield 

    task.cancel()
    if cache.redis:
        await cache.redis.close()
        logger.info("Redis connection closed")

    await client.aclose()
    logger.info("HTTP client closed")



app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(radar.router)
app.include_router(enrich.router)
app.include_router(attacks.router)
