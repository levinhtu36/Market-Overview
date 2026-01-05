"""
DNSE Lightspeed API Service
============================
Service for fetching real-time market data from DNSE (Lightspeed API).

Architecture: Frontend -> Backend (Python) -> DNSE API
This keeps API keys secure and not exposed in the frontend.

Author: Market Overview Team
Date: 2026-01-05
"""

import os
import json
import logging
import time
import hmac
import hashlib
from typing import Dict, Any, Optional, List
from datetime import datetime

import requests
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# ============================================================================
# CONFIGURATION
# ============================================================================
DNSE_API_URL = os.getenv("DNSE_API_URL", "https://services.entrade.com.vn/market-data/v1")
API_KEY = os.getenv("DNSE_API_KEY", "")
SECRET_KEY = os.getenv("DNSE_SECRET_KEY", "")

# Request configuration
REQUEST_TIMEOUT = 10  # seconds
MAX_RETRIES = 3
RETRY_DELAY = 1  # seconds

# ============================================================================
# LOGGING SETUP
# ============================================================================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def validate_api_config() -> bool:
    """Validate that API credentials are configured."""
    if not API_KEY or not SECRET_KEY:
        logger.error("API_KEY or SECRET_KEY not configured. Check your .env file.")
        return False
    return True


def generate_signature(endpoint: str, timestamp: str) -> str:
    """
    Generate HMAC signature for API authentication.

    Args:
        endpoint: API endpoint path
        timestamp: Current timestamp

    Returns:
        HMAC signature string
    """
    message = f"{endpoint}{timestamp}"
    signature = hmac.new(
        SECRET_KEY.encode('utf-8'),
        message.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    return signature


def get_headers(endpoint: str = "") -> Dict[str, str]:
    """
    Generate request headers with authentication.

    Args:
        endpoint: API endpoint path (for signature if needed)

    Returns:
        Dictionary of HTTP headers
    """
    timestamp = str(int(time.time() * 1000))
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
        "X-Timestamp": timestamp
    }

    # Add signature if endpoint is provided and SECRET_KEY exists
    if endpoint and SECRET_KEY:
        signature = generate_signature(endpoint, timestamp)
        headers["X-Signature"] = signature

    return headers


def make_api_request(
    endpoint: str,
    method: str = "GET",
    params: Optional[Dict[str, Any]] = None,
    data: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Make API request with retry logic and error handling.

    Args:
        endpoint: API endpoint path (e.g., "/index/VNINDEX")
        method: HTTP method (GET, POST, etc.)
        params: Query parameters
        data: Request body data

    Returns:
        API response as dictionary or error dictionary
    """
    if not validate_api_config():
        return {"error": "API credentials not configured", "success": False}

    url = f"{DNSE_API_URL}{endpoint}"
    headers = get_headers(endpoint)

    for attempt in range(MAX_RETRIES):
        try:
            logger.info(f"API Request [{attempt + 1}/{MAX_RETRIES}]: {method} {url}")

            response = requests.request(
                method=method,
                url=url,
                headers=headers,
                params=params,
                json=data,
                timeout=REQUEST_TIMEOUT
            )

            # Log response status
            logger.info(f"Response status: {response.status_code}")

            # Handle successful response
            if response.status_code == 200:
                result = response.json()
                result["success"] = True
                return result

            # Handle client errors (4xx) - don't retry
            elif 400 <= response.status_code < 500:
                error_msg = f"Client error: {response.status_code}"
                logger.error(f"{error_msg} - {response.text}")
                return {
                    "error": error_msg,
                    "status_code": response.status_code,
                    "message": response.text,
                    "success": False
                }

            # Handle server errors (5xx) - retry
            else:
                error_msg = f"Server error: {response.status_code}"
                logger.warning(f"{error_msg} - Attempt {attempt + 1}")
                if attempt < MAX_RETRIES - 1:
                    time.sleep(RETRY_DELAY * (attempt + 1))
                    continue

                return {
                    "error": error_msg,
                    "status_code": response.status_code,
                    "success": False
                }

        except requests.exceptions.Timeout:
            logger.warning(f"Request timeout - Attempt {attempt + 1}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY * (attempt + 1))
                continue
            return {"error": "Request timeout", "success": False}

        except requests.exceptions.ConnectionError as e:
            logger.warning(f"Connection error: {str(e)} - Attempt {attempt + 1}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY * (attempt + 1))
                continue
            return {"error": f"Connection error: {str(e)}", "success": False}

        except Exception as e:
            logger.error(f"Unexpected error: {str(e)}")
            return {"error": f"Unexpected error: {str(e)}", "success": False}

    return {"error": "Max retries exceeded", "success": False}


# ============================================================================
# MARKET DATA FUNCTIONS
# ============================================================================

def get_market_data(symbol: str = "VN30") -> Dict[str, Any]:
    """
    Lấy dữ liệu thị trường real-time cho một chỉ số hoặc mã cổ phiếu.

    Args:
        symbol: Mã chỉ số hoặc cổ phiếu (VD: "VNINDEX", "VN30", "HPG")

    Returns:
        Dictionary chứa dữ liệu thị trường hoặc thông báo lỗi

    Example:
        >>> data = get_market_data("VNINDEX")
        >>> if data.get("success"):
        >>>     print(f"Index: {data['symbol']}, Price: {data['price']}")
    """
    endpoint = f"/index/{symbol}"
    return make_api_request(endpoint)


def get_vnindex_data() -> Dict[str, Any]:
    """
    Lấy dữ liệu real-time của chỉ số VNINDEX.

    Returns:
        Dictionary chứa dữ liệu VNINDEX
    """
    return get_market_data("VNINDEX")


def get_vn30_data() -> Dict[str, Any]:
    """
    Lấy dữ liệu real-time của chỉ số VN30.

    Returns:
        Dictionary chứa dữ liệu VN30
    """
    return get_market_data("VN30")


def get_stock_price(symbol: str) -> Dict[str, Any]:
    """
    Lấy giá cổ phiếu real-time.

    Args:
        symbol: Mã cổ phiếu (VD: "HPG", "VNM", "VCB")

    Returns:
        Dictionary chứa thông tin giá cổ phiếu
    """
    endpoint = f"/stock/{symbol}"
    return make_api_request(endpoint)


def get_multiple_stocks(symbols: List[str]) -> Dict[str, Any]:
    """
    Lấy giá nhiều cổ phiếu cùng lúc.

    Args:
        symbols: Danh sách mã cổ phiếu

    Returns:
        Dictionary chứa thông tin nhiều cổ phiếu
    """
    endpoint = "/stocks/batch"
    data = {"symbols": symbols}
    return make_api_request(endpoint, method="POST", data=data)


def get_market_breadth() -> Dict[str, Any]:
    """
    Lấy thông tin độ rộng thị trường (market breadth).
    Bao gồm số lượng mã tăng/giảm/đứng giá, thanh khoản, v.v.

    Returns:
        Dictionary chứa thông tin market breadth
    """
    endpoint = "/market/breadth"
    return make_api_request(endpoint)


def get_sector_data(sector: str = "all") -> Dict[str, Any]:
    """
    Lấy dữ liệu theo ngành.

    Args:
        sector: Tên ngành hoặc "all" để lấy tất cả

    Returns:
        Dictionary chứa dữ liệu ngành
    """
    endpoint = f"/sector/{sector}"
    return make_api_request(endpoint)


def get_foreign_flow(symbol: str = "VNINDEX") -> Dict[str, Any]:
    """
    Lấy dữ liệu dòng tiền nước ngoài.

    Args:
        symbol: Mã chỉ số hoặc cổ phiếu

    Returns:
        Dictionary chứa dữ liệu dòng tiền nước ngoài
    """
    endpoint = f"/foreign-flow/{symbol}"
    return make_api_request(endpoint)


def get_historical_data(
    symbol: str,
    from_date: str,
    to_date: str,
    resolution: str = "1D"
) -> Dict[str, Any]:
    """
    Lấy dữ liệu lịch sử OHLCV.

    Args:
        symbol: Mã chỉ số hoặc cổ phiếu
        from_date: Ngày bắt đầu (format: YYYY-MM-DD)
        to_date: Ngày kết thúc (format: YYYY-MM-DD)
        resolution: Độ phân giải (1D, 1H, 15, 5, 1)

    Returns:
        Dictionary chứa dữ liệu OHLCV lịch sử
    """
    endpoint = "/historical"
    params = {
        "symbol": symbol,
        "from": from_date,
        "to": to_date,
        "resolution": resolution
    }
    return make_api_request(endpoint, params=params)


# ============================================================================
# WEBSOCKET SUPPORT (for real-time streaming)
# ============================================================================

class DNSEWebSocketClient:
    """
    WebSocket client for real-time data streaming from DNSE.

    Usage:
        >>> client = DNSEWebSocketClient()
        >>> await client.connect()
        >>> await client.subscribe(["VNINDEX", "VN30"])
        >>> async for message in client.listen():
        >>>     print(message)
    """

    def __init__(self):
        self.ws_url = os.getenv("DNSE_WS_URL", "wss://services.entrade.com.vn/ws")
        self.ws = None
        self.subscriptions = []
        logger.info("WebSocket client initialized")

    async def connect(self):
        """Establish WebSocket connection."""
        try:
            import websockets

            if not validate_api_config():
                raise ValueError("API credentials not configured")

            # Connect with authentication
            headers = get_headers()
            self.ws = await websockets.connect(
                self.ws_url,
                extra_headers=headers
            )
            logger.info("WebSocket connected")

            # Send authentication message
            auth_msg = {
                "type": "auth",
                "apiKey": API_KEY,
                "timestamp": int(time.time() * 1000)
            }
            await self.ws.send(json.dumps(auth_msg))

        except ImportError:
            logger.error("websockets library not installed. Install with: pip install websockets")
            raise
        except Exception as e:
            logger.error(f"WebSocket connection error: {str(e)}")
            raise

    async def subscribe(self, symbols: List[str]):
        """
        Subscribe to real-time data for specific symbols.

        Args:
            symbols: List of symbols to subscribe to
        """
        if not self.ws:
            raise ConnectionError("WebSocket not connected")

        subscribe_msg = {
            "type": "subscribe",
            "symbols": symbols
        }
        await self.ws.send(json.dumps(subscribe_msg))
        self.subscriptions.extend(symbols)
        logger.info(f"Subscribed to: {symbols}")

    async def unsubscribe(self, symbols: List[str]):
        """Unsubscribe from symbols."""
        if not self.ws:
            return

        unsubscribe_msg = {
            "type": "unsubscribe",
            "symbols": symbols
        }
        await self.ws.send(json.dumps(unsubscribe_msg))
        for symbol in symbols:
            if symbol in self.subscriptions:
                self.subscriptions.remove(symbol)
        logger.info(f"Unsubscribed from: {symbols}")

    async def listen(self):
        """
        Listen for incoming WebSocket messages.

        Yields:
            Parsed JSON messages from the server
        """
        if not self.ws:
            raise ConnectionError("WebSocket not connected")

        try:
            async for message in self.ws:
                try:
                    data = json.loads(message)
                    yield data
                except json.JSONDecodeError:
                    logger.warning(f"Failed to parse message: {message}")
        except Exception as e:
            logger.error(f"WebSocket listen error: {str(e)}")
            raise

    async def close(self):
        """Close WebSocket connection."""
        if self.ws:
            await self.ws.close()
            logger.info("WebSocket closed")


# ============================================================================
# TESTING & MAIN
# ============================================================================

def test_api_connection():
    """Test API connection and configuration."""
    print("=" * 60)
    print("DNSE Lightspeed API - Connection Test")
    print("=" * 60)

    # Check configuration
    print("\n1. Checking configuration...")
    if validate_api_config():
        print("   ✓ API credentials configured")
    else:
        print("   ✗ API credentials missing")
        print("   → Please check your .env file")
        return False

    print(f"   API URL: {DNSE_API_URL}")
    print(f"   API Key: {API_KEY[:10]}..." if len(API_KEY) > 10 else "   API Key: (too short)")

    # Test VNINDEX data
    print("\n2. Testing VNINDEX data...")
    result = get_vnindex_data()
    if result.get("success"):
        print("   ✓ Successfully fetched VNINDEX data")
        print(f"   Data: {json.dumps(result, indent=2, ensure_ascii=False)}")
    else:
        print(f"   ✗ Failed to fetch data: {result.get('error')}")

    # Test VN30 data
    print("\n3. Testing VN30 data...")
    result = get_vn30_data()
    if result.get("success"):
        print("   ✓ Successfully fetched VN30 data")
    else:
        print(f"   ✗ Failed to fetch data: {result.get('error')}")

    print("\n" + "=" * 60)
    return True


if __name__ == "__main__":
    # Run connection test
    test_api_connection()

    # Example usage
    print("\n\nExample usage:")
    print("-" * 60)

    # Get VNINDEX
    print("\n>>> get_vnindex_data()")
    data = get_vnindex_data()
    print(json.dumps(data, indent=2, ensure_ascii=False))

    # Get stock price
    print("\n>>> get_stock_price('HPG')")
    data = get_stock_price("HPG")
    print(json.dumps(data, indent=2, ensure_ascii=False))

    # Get market breadth
    print("\n>>> get_market_breadth()")
    data = get_market_breadth()
    print(json.dumps(data, indent=2, ensure_ascii=False))
