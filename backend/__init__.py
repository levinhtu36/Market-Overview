"""
Market Overview - Backend Package
==================================
Backend services for Market Overview application.

This package provides:
- DNSE Lightspeed API integration for real-time market data
- Secure API key management
- REST API and WebSocket support
- Data fetching and processing services

Modules:
    dnse_service: DNSE Lightspeed API client and utilities

Author: Market Overview Team
Date: 2026-01-05
"""

from .dnse_service import (
    # Market data functions
    get_market_data,
    get_vnindex_data,
    get_vn30_data,
    get_stock_price,
    get_multiple_stocks,
    get_market_breadth,
    get_sector_data,
    get_foreign_flow,
    get_historical_data,

    # WebSocket client
    DNSEWebSocketClient,

    # Test function
    test_api_connection,
)

__version__ = "1.0.0"
__author__ = "Market Overview Team"

__all__ = [
    "get_market_data",
    "get_vnindex_data",
    "get_vn30_data",
    "get_stock_price",
    "get_multiple_stocks",
    "get_market_breadth",
    "get_sector_data",
    "get_foreign_flow",
    "get_historical_data",
    "DNSEWebSocketClient",
    "test_api_connection",
]
