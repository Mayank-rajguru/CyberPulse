from fastapi import APIRouter, HTTPException, Query

from config import ABUSE_KEY
from services.abuseIPDB_service import abuse_check

router = APIRouter()

async def enrich_ip(ip: str = Query(..., description="IPv4/IPv6 address")):
    if not ABUSE_KEY:
        raise HTTPException(status_code=400, detail="AbuseIPDB key not configured")
    return await abuse_check(ip)