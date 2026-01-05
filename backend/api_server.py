"""
Flask REST API Server for Market Overview
==========================================
Provides REST API endpoints to integrate DNSE Lightspeed data with frontend.

Usage:
    python api_server.py

Endpoints:
    GET  /api/health              - Health check
    GET  /api/vnindex             - Get VNINDEX data
    GET  /api/vn30                - Get VN30 data
    GET  /api/stock/<symbol>      - Get stock price
    POST /api/stocks/batch        - Get multiple stocks
    GET  /api/market/breadth      - Get market breadth
    GET  /api/sector/<sector>     - Get sector data
    GET  /api/foreign-flow/<symbol> - Get foreign flow data

Author: Market Overview Team
Date: 2026-01-05
"""

import os
import logging
from datetime import datetime
from flask import Flask, jsonify, request
from flask_cors import CORS

# Import backend services
from dnse_service import (
    get_vnindex_data,
    get_vn30_data,
    get_stock_price,
    get_multiple_stocks,
    get_market_breadth,
    get_sector_data,
    get_foreign_flow,
    get_historical_data,
    test_api_connection,
)

# ============================================================================
# APP CONFIGURATION
# ============================================================================
app = Flask(__name__)

# Enable CORS for frontend access
# In production, restrict this to specific origins
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:*", "http://127.0.0.1:*", "https://*.github.io"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def success_response(data, message="Success"):
    """Create standardized success response."""
    return jsonify({
        "success": True,
        "message": message,
        "data": data,
        "timestamp": datetime.now().isoformat()
    })

def error_response(error, status_code=500):
    """Create standardized error response."""
    return jsonify({
        "success": False,
        "error": str(error),
        "timestamp": datetime.now().isoformat()
    }), status_code

# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return success_response({
        "status": "healthy",
        "service": "Market Overview API",
        "version": "1.0.0"
    })

@app.route('/api/vnindex', methods=['GET'])
def api_vnindex():
    """
    Get VNINDEX real-time data.

    Returns:
        JSON with VNINDEX data including price, change, volume, etc.
    """
    try:
        data = get_vnindex_data()

        if data.get("success"):
            return success_response(data, "VNINDEX data fetched successfully")
        else:
            return error_response(data.get("error", "Unknown error"), 500)

    except Exception as e:
        logger.error(f"Error fetching VNINDEX: {str(e)}")
        return error_response(str(e), 500)

@app.route('/api/vn30', methods=['GET'])
def api_vn30():
    """
    Get VN30 real-time data.

    Returns:
        JSON with VN30 data
    """
    try:
        data = get_vn30_data()

        if data.get("success"):
            return success_response(data, "VN30 data fetched successfully")
        else:
            return error_response(data.get("error", "Unknown error"), 500)

    except Exception as e:
        logger.error(f"Error fetching VN30: {str(e)}")
        return error_response(str(e), 500)

@app.route('/api/stock/<symbol>', methods=['GET'])
def api_stock(symbol):
    """
    Get stock price data.

    Args:
        symbol: Stock symbol (e.g., HPG, VNM, VCB)

    Returns:
        JSON with stock price data
    """
    try:
        symbol = symbol.upper()
        data = get_stock_price(symbol)

        if data.get("success"):
            return success_response(data, f"{symbol} data fetched successfully")
        else:
            return error_response(data.get("error", "Unknown error"), 500)

    except Exception as e:
        logger.error(f"Error fetching stock {symbol}: {str(e)}")
        return error_response(str(e), 500)

@app.route('/api/stocks/batch', methods=['POST'])
def api_stocks_batch():
    """
    Get multiple stocks data at once.

    Request body:
        {
            "symbols": ["HPG", "VNM", "VCB"]
        }

    Returns:
        JSON with multiple stocks data
    """
    try:
        request_data = request.get_json()

        if not request_data or "symbols" not in request_data:
            return error_response("Missing 'symbols' in request body", 400)

        symbols = request_data["symbols"]

        if not isinstance(symbols, list):
            return error_response("'symbols' must be a list", 400)

        if len(symbols) == 0:
            return error_response("'symbols' list is empty", 400)

        # Convert to uppercase
        symbols = [s.upper() for s in symbols]

        data = get_multiple_stocks(symbols)

        if data.get("success"):
            return success_response(data, "Batch stocks data fetched successfully")
        else:
            return error_response(data.get("error", "Unknown error"), 500)

    except Exception as e:
        logger.error(f"Error fetching batch stocks: {str(e)}")
        return error_response(str(e), 500)

@app.route('/api/market/breadth', methods=['GET'])
def api_market_breadth():
    """
    Get market breadth data.

    Returns:
        JSON with market breadth (advancing, declining, unchanged, etc.)
    """
    try:
        data = get_market_breadth()

        if data.get("success"):
            return success_response(data, "Market breadth data fetched successfully")
        else:
            return error_response(data.get("error", "Unknown error"), 500)

    except Exception as e:
        logger.error(f"Error fetching market breadth: {str(e)}")
        return error_response(str(e), 500)

@app.route('/api/sector/<sector>', methods=['GET'])
def api_sector(sector):
    """
    Get sector data.

    Args:
        sector: Sector name or "all" for all sectors

    Returns:
        JSON with sector data
    """
    try:
        data = get_sector_data(sector)

        if data.get("success"):
            return success_response(data, f"Sector {sector} data fetched successfully")
        else:
            return error_response(data.get("error", "Unknown error"), 500)

    except Exception as e:
        logger.error(f"Error fetching sector {sector}: {str(e)}")
        return error_response(str(e), 500)

@app.route('/api/foreign-flow/<symbol>', methods=['GET'])
def api_foreign_flow(symbol):
    """
    Get foreign flow data.

    Args:
        symbol: Index or stock symbol

    Returns:
        JSON with foreign flow data
    """
    try:
        symbol = symbol.upper()
        data = get_foreign_flow(symbol)

        if data.get("success"):
            return success_response(data, f"Foreign flow for {symbol} fetched successfully")
        else:
            return error_response(data.get("error", "Unknown error"), 500)

    except Exception as e:
        logger.error(f"Error fetching foreign flow for {symbol}: {str(e)}")
        return error_response(str(e), 500)

@app.route('/api/historical/<symbol>', methods=['GET'])
def api_historical(symbol):
    """
    Get historical OHLCV data.

    Query parameters:
        from: Start date (YYYY-MM-DD)
        to: End date (YYYY-MM-DD)
        resolution: Resolution (1D, 1H, 15, 5, 1) - default 1D

    Returns:
        JSON with historical OHLCV data
    """
    try:
        symbol = symbol.upper()
        from_date = request.args.get('from')
        to_date = request.args.get('to')
        resolution = request.args.get('resolution', '1D')

        if not from_date or not to_date:
            return error_response("Missing 'from' or 'to' query parameters", 400)

        data = get_historical_data(symbol, from_date, to_date, resolution)

        if data.get("success"):
            return success_response(data, f"Historical data for {symbol} fetched successfully")
        else:
            return error_response(data.get("error", "Unknown error"), 500)

    except Exception as e:
        logger.error(f"Error fetching historical data for {symbol}: {str(e)}")
        return error_response(str(e), 500)

# ============================================================================
# ERROR HANDLERS
# ============================================================================

@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors."""
    return error_response("Endpoint not found", 404)

@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors."""
    return error_response("Internal server error", 500)

# ============================================================================
# MAIN
# ============================================================================

if __name__ == '__main__':
    # Test API connection on startup
    logger.info("Testing DNSE API connection...")
    test_api_connection()

    # Get configuration
    host = os.getenv('API_HOST', '0.0.0.0')
    port = int(os.getenv('API_PORT', 5000))
    debug = os.getenv('API_DEBUG', 'True').lower() == 'true'

    # Start server
    logger.info(f"Starting API server on {host}:{port}")
    logger.info(f"Debug mode: {debug}")
    logger.info("Available endpoints:")
    logger.info("  GET  /api/health")
    logger.info("  GET  /api/vnindex")
    logger.info("  GET  /api/vn30")
    logger.info("  GET  /api/stock/<symbol>")
    logger.info("  POST /api/stocks/batch")
    logger.info("  GET  /api/market/breadth")
    logger.info("  GET  /api/sector/<sector>")
    logger.info("  GET  /api/foreign-flow/<symbol>")
    logger.info("  GET  /api/historical/<symbol>")

    app.run(host=host, port=port, debug=debug)
