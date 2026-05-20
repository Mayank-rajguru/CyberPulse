from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from redis.asyncio import Redis
import json
import asyncio
import os
from dotenv import load_dotenv
import traceback

# Debug: Track module loading
print("🔍 Starting attacks.py import...")

router = APIRouter()
load_dotenv()

REDIS_URL = os.getenv("REDIS_URL")
CHANNEL = "cyberattacks"

print(f"🔍 Attacks module loaded - REDIS_URL: {REDIS_URL}")
print(f"🔍 Channel: {CHANNEL}")

@router.get("/test-attacks")
async def test_attacks():
    """Test endpoint to verify router is working"""
    return {
        "message": "Attacks router is working", 
        "redis_url": REDIS_URL,
        "channel": CHANNEL
    }

@router.websocket("/ws/attacks")
async def websocket_endpoint(websocket: WebSocket):
    print("🔍 WebSocket connection attempt started")
    redis = None
    pubsub = None
    
    try:
        # Accept the WebSocket connection
        await websocket.accept()
        print("✅ WebSocket accepted")
        
        # Initialize Redis connection
        print("🔍 Initializing Redis connection...")
        redis = Redis.from_url(
            REDIS_URL,
            decode_responses=True,
        )
        
        # Test Redis connection
        print("🔍 Testing Redis connection...")
        try:
            result = await redis.ping()
            print("✅ REDIS PING SUCCESS:", result)
        except Exception as e:
            print("❌ REDIS PING FAILED")
            print(repr(e))
            traceback.print_exc()
            raise
        print("✅ Redis connection successful")
        
        # Create pubsub
        print("🔍 Creating Redis pubsub...")
        pubsub = redis.pubsub()
        print("✅ Redis pubsub created")
        
        # Subscribe to channel
        print(f"🔍 Subscribing to channel: {CHANNEL}")
        await pubsub.subscribe(CHANNEL)
        print("✅ Successfully subscribed to Redis channel")
        
        # Initialize heartbeat
        last_heartbeat = asyncio.get_event_loop().time()
        HEARTBEAT_INTERVAL = 5
        
        print("🔍 Starting WebSocket message loop...")
        
        while True:
            now = asyncio.get_event_loop().time()
            
            # Send heartbeat every 5 seconds
            if now - last_heartbeat >= HEARTBEAT_INTERVAL:
                try:
                    heartbeat_data = {"type": "heartbeat", "time": now}
                    await websocket.send_json(heartbeat_data)
                    print(f"💓 Heartbeat sent: {now}")
                    last_heartbeat = now
                except Exception as e:
                    print(f"❌ Failed to send heartbeat: {e}")
                    break

            # Check for Redis messages
            try:
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=0.1)
                
                if message:
                    print(f"🔍 Raw message received: {message}")
                    
                    # Check if message has valid data
                    if message.get("data") and message["data"] != 1:
                        try:
                            # Parse JSON data
                            if isinstance(message["data"], str):
                                event = json.loads(message["data"])
                            else:
                                event = message["data"]
                            
                            print(f"📨 Parsed event: {event}")
                            
                            # Send to WebSocket client
                            await websocket.send_json(event)
                            print("✅ Event sent to client")
                            
                        except json.JSONDecodeError as json_err:
                            print(f"❌ JSON decode error: {json_err}")
                            print(f"❌ Raw data was: {message['data']}")
                        except Exception as send_err:
                            print(f"❌ Error sending message to client: {send_err}")
                            break
                            
            except Exception as e:
                print(f"❌ Error in message processing: {e}")
                # Don't break on message processing errors, just continue

            # Small sleep to prevent busy waiting
            await asyncio.sleep(0.1)
            
    except WebSocketDisconnect:
        print("👋 Client disconnected normally")
    except ConnectionError as e:
        print(f"❌ Connection error: {e}")
    except Exception as e:
        print(f"❌ Unexpected WebSocket error: {e}")
        traceback.print_exc()
    finally:
        # Cleanup
        print("🧹 Cleaning up WebSocket connection...")
        
        try:
            if pubsub:
                print("🔍 Unsubscribing from Redis channel...")
                await pubsub.unsubscribe(CHANNEL)
                await pubsub.close()
                print("✅ Redis pubsub closed")
        except Exception as cleanup_err:
            print(f"❌ Error during pubsub cleanup: {cleanup_err}")
        
        try:
            if redis:
                print("🔍 Closing Redis connection...")
                await redis.aclose()
                print("✅ Redis connection closed")
        except Exception as cleanup_err:
            print(f"❌ Error during Redis cleanup: {cleanup_err}")
            
        print("✅ WebSocket cleanup complete")

print("✅ Attacks module fully loaded with WebSocket endpoint")