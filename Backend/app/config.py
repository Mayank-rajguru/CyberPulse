from dotenv import load_dotenv
import os

load_dotenv()
CF_API_TOKEN = os.getenv("CF_API_TOKEN") or ""
ABUSE_KEY = os.getenv("ABUSEIPDB_KEY") or ""

CF_GRAPHQL = "https://api.cloudflare.com/client/v4/graphql"
RADAR_BASE = "https://api.cloudflare.com/client/v4/radar/attacks"
ABUSE_CHECK_URL = "https://api.abuseipdb.com/api/v2/check"

if not CF_API_TOKEN:
    raise RuntimeError("CF_Token env var is required")