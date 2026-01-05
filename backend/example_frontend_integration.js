/**
 * Frontend Integration Example for DNSE Lightspeed API
 * ======================================================
 * This file demonstrates how to call the backend API from frontend JavaScript.
 *
 * Prerequisites:
 * 1. Backend API server running on http://localhost:5000
 * 2. Run: python backend/api_server.py
 *
 * Usage:
 * - Copy the functions below into your frontend JavaScript
 * - Call the functions to fetch real-time market data
 * - Handle the responses and update your UI
 *
 * Author: Market Overview Team
 * Date: 2026-01-05
 */

// ============================================================================
// CONFIGURATION
// ============================================================================
const API_BASE_URL = 'http://localhost:5000/api';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generic API fetch helper with error handling
 */
async function fetchAPI(endpoint, options = {}) {
    try {
        const url = `${API_BASE_URL}${endpoint}`;
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `HTTP error! status: ${response.status}`);
        }

        return data;
    } catch (error) {
        console.error(`API Error [${endpoint}]:`, error);
        throw error;
    }
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get VNINDEX real-time data
 */
async function getVNINDEX() {
    try {
        const result = await fetchAPI('/vnindex');

        if (result.success) {
            console.log('VNINDEX Data:', result.data);
            return result.data;
        } else {
            console.error('Failed to fetch VNINDEX:', result.error);
            return null;
        }
    } catch (error) {
        console.error('Error fetching VNINDEX:', error);
        return null;
    }
}

/**
 * Get VN30 real-time data
 */
async function getVN30() {
    try {
        const result = await fetchAPI('/vn30');

        if (result.success) {
            console.log('VN30 Data:', result.data);
            return result.data;
        } else {
            console.error('Failed to fetch VN30:', result.error);
            return null;
        }
    } catch (error) {
        console.error('Error fetching VN30:', error);
        return null;
    }
}

/**
 * Get stock price for a single symbol
 */
async function getStockPrice(symbol) {
    try {
        const result = await fetchAPI(`/stock/${symbol}`);

        if (result.success) {
            console.log(`${symbol} Data:`, result.data);
            return result.data;
        } else {
            console.error(`Failed to fetch ${symbol}:`, result.error);
            return null;
        }
    } catch (error) {
        console.error(`Error fetching ${symbol}:`, error);
        return null;
    }
}

/**
 * Get multiple stocks data at once
 */
async function getMultipleStocks(symbols) {
    try {
        const result = await fetchAPI('/stocks/batch', {
            method: 'POST',
            body: JSON.stringify({ symbols })
        });

        if (result.success) {
            console.log('Multiple Stocks Data:', result.data);
            return result.data;
        } else {
            console.error('Failed to fetch multiple stocks:', result.error);
            return null;
        }
    } catch (error) {
        console.error('Error fetching multiple stocks:', error);
        return null;
    }
}

/**
 * Get market breadth data
 */
async function getMarketBreadth() {
    try {
        const result = await fetchAPI('/market/breadth');

        if (result.success) {
            console.log('Market Breadth:', result.data);
            return result.data;
        } else {
            console.error('Failed to fetch market breadth:', result.error);
            return null;
        }
    } catch (error) {
        console.error('Error fetching market breadth:', error);
        return null;
    }
}

/**
 * Get sector data
 */
async function getSectorData(sector = 'all') {
    try {
        const result = await fetchAPI(`/sector/${sector}`);

        if (result.success) {
            console.log(`Sector ${sector} Data:`, result.data);
            return result.data;
        } else {
            console.error(`Failed to fetch sector ${sector}:`, result.error);
            return null;
        }
    } catch (error) {
        console.error(`Error fetching sector ${sector}:`, error);
        return null;
    }
}

/**
 * Get foreign flow data
 */
async function getForeignFlow(symbol = 'VNINDEX') {
    try {
        const result = await fetchAPI(`/foreign-flow/${symbol}`);

        if (result.success) {
            console.log(`Foreign Flow for ${symbol}:`, result.data);
            return result.data;
        } else {
            console.error(`Failed to fetch foreign flow for ${symbol}:`, result.error);
            return null;
        }
    } catch (error) {
        console.error(`Error fetching foreign flow for ${symbol}:`, error);
        return null;
    }
}

/**
 * Get historical OHLCV data
 */
async function getHistoricalData(symbol, fromDate, toDate, resolution = '1D') {
    try {
        const params = new URLSearchParams({
            from: fromDate,
            to: toDate,
            resolution: resolution
        });

        const result = await fetchAPI(`/historical/${symbol}?${params}`);

        if (result.success) {
            console.log(`Historical Data for ${symbol}:`, result.data);
            return result.data;
        } else {
            console.error(`Failed to fetch historical data for ${symbol}:`, result.error);
            return null;
        }
    } catch (error) {
        console.error(`Error fetching historical data for ${symbol}:`, error);
        return null;
    }
}

// ============================================================================
// UI UPDATE FUNCTIONS (EXAMPLE)
// ============================================================================

/**
 * Update VNINDEX display on UI
 */
async function updateVNINDEXDisplay() {
    const data = await getVNINDEX();

    if (data) {
        // Example: Update DOM elements
        document.getElementById('vnindex-price').textContent = data.price || 'N/A';
        document.getElementById('vnindex-change').textContent = data.change || 'N/A';
        document.getElementById('vnindex-change-pct').textContent =
            data.change_percent ? `${data.change_percent}%` : 'N/A';

        // Add color styling based on change
        const changeElement = document.getElementById('vnindex-change');
        if (data.change > 0) {
            changeElement.classList.add('text-green');
            changeElement.classList.remove('text-red');
        } else if (data.change < 0) {
            changeElement.classList.add('text-red');
            changeElement.classList.remove('text-green');
        }
    }
}

/**
 * Update market breadth display on UI
 */
async function updateMarketBreadthDisplay() {
    const data = await getMarketBreadth();

    if (data) {
        document.getElementById('advancing').textContent = data.advancing || '0';
        document.getElementById('declining').textContent = data.declining || '0';
        document.getElementById('unchanged').textContent = data.unchanged || '0';

        // Calculate and display breadth ratio
        const total = (data.advancing || 0) + (data.declining || 0);
        const breadthRatio = total > 0 ? (data.advancing / total * 100).toFixed(1) : 0;
        document.getElementById('breadth-ratio').textContent = `${breadthRatio}%`;
    }
}

/**
 * Refresh all market data
 */
async function refreshAllData() {
    try {
        // Fetch all data in parallel
        const [vnindex, vn30, breadth] = await Promise.all([
            getVNINDEX(),
            getVN30(),
            getMarketBreadth()
        ]);

        console.log('All data refreshed:', { vnindex, vn30, breadth });

        // Update UI
        updateVNINDEXDisplay();
        updateMarketBreadthDisplay();

        return { vnindex, vn30, breadth };
    } catch (error) {
        console.error('Error refreshing data:', error);
        return null;
    }
}

// ============================================================================
// AUTO-REFRESH SETUP
// ============================================================================

/**
 * Setup auto-refresh for real-time updates
 */
function setupAutoRefresh(intervalSeconds = 30) {
    // Initial fetch
    refreshAllData();

    // Setup interval
    const intervalId = setInterval(() => {
        console.log('Auto-refreshing market data...');
        refreshAllData();
    }, intervalSeconds * 1000);

    console.log(`Auto-refresh enabled (every ${intervalSeconds}s)`);

    // Return interval ID so it can be cleared if needed
    return intervalId;
}

/**
 * Stop auto-refresh
 */
function stopAutoRefresh(intervalId) {
    if (intervalId) {
        clearInterval(intervalId);
        console.log('Auto-refresh stopped');
    }
}

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/**
 * Example 1: Simple data fetch on page load
 */
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Page loaded, fetching market data...');

    // Fetch VNINDEX
    const vnindexData = await getVNINDEX();
    console.log('VNINDEX:', vnindexData);

    // Fetch multiple stocks
    const stocks = await getMultipleStocks(['HPG', 'VNM', 'VCB', 'VIC']);
    console.log('Stocks:', stocks);
});

/**
 * Example 2: Setup auto-refresh on page load
 */
// Uncomment to enable auto-refresh
// let refreshInterval;
// window.addEventListener('load', () => {
//     refreshInterval = setupAutoRefresh(30); // Refresh every 30 seconds
// });

/**
 * Example 3: Fetch data on button click
 */
// document.getElementById('refresh-btn').addEventListener('click', async () => {
//     console.log('Refresh button clicked');
//     await refreshAllData();
// });

/**
 * Example 4: Fetch historical data for chart
 */
async function loadChartData() {
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0];

    const historicalData = await getHistoricalData(
        'VNINDEX',
        thirtyDaysAgo,
        today,
        '1D'
    );

    if (historicalData) {
        // Use data to render chart
        console.log('Chart data loaded:', historicalData);
        // renderChart(historicalData);
    }
}

// ============================================================================
// EXPORT (for ES6 modules)
// ============================================================================

// If using ES6 modules, export the functions
// export {
//     getVNINDEX,
//     getVN30,
//     getStockPrice,
//     getMultipleStocks,
//     getMarketBreadth,
//     getSectorData,
//     getForeignFlow,
//     getHistoricalData,
//     refreshAllData,
//     setupAutoRefresh,
//     stopAutoRefresh
// };
