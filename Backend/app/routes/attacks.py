from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from redis.asyncio import Redis
import json, asyncio
import os
from dotenv import load_dotenv

router = APIRouter()
load_dotenv()

REDIS_URL = os.getenv("REDIS_URL")
CHANNEL = "cyberattacks"

redis = Redis.from_url(
    REDIS_URL,
    decode_responses=True,
    ssl=True,
    ssl_cert_reqs=None   # disables cert validation (for testing only!)
)

@router.websocket("/ws/attacks")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    redis = Redis.from_url(REDIS_URL, decode_responses=True)
    pubsub = redis.pubsub()
    await pubsub.subscribe(CHANNEL)

    try:
        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message:
                event = json.loads(message["data"])
                await websocket.send_json(event)
            await asyncio.sleep(0.1)  # prevent busy loop
    except WebSocketDisconnect:
        print("❌ Client disconnected")
    finally:
        await pubsub.unsubscribe(CHANNEL)
        await pubsub.close()
        await redis.close()
