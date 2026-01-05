# Market Overview - Backend Service

Backend service cho Market Overview application, cung cấp tích hợp với DNSE Lightspeed API để lấy dữ liệu thị trường chứng khoán real-time.

## Kiến trúc

```
Frontend (HTML/JS) → Backend (Python) → DNSE Lightspeed API
```

**Tại sao cần Backend?**
- Bảo mật: API keys không bao giờ được exposed ở Frontend
- Kiểm soát: Rate limiting, caching, và xử lý lỗi tập trung
- Linh hoạt: Có thể xử lý và transform dữ liệu trước khi gửi cho Frontend

## Cài đặt

### 1. Cài đặt Python Dependencies

```bash
# Từ thư mục backend/
pip install -r requirements.txt
```

hoặc sử dụng virtual environment (khuyến nghị):

```bash
# Tạo virtual environment
python -m venv venv

# Kích hoạt virtual environment
# On Linux/Mac:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

# Cài đặt dependencies
pip install -r requirements.txt
```

### 2. Cấu hình API Keys

1. Copy file `.env.example` thành `.env`:
   ```bash
   cp ../.env.example .env
   ```

2. Mở file `.env` và điền API credentials của bạn:
   ```env
   DNSE_API_KEY=your_actual_api_key_here
   DNSE_SECRET_KEY=your_actual_secret_key_here
   ```

3. **QUAN TRỌNG**: Đảm bảo file `.env` đã được thêm vào `.gitignore`

### 3. Lấy API Keys từ DNSE

1. Đăng ký tài khoản tại [DNSE](https://www.dnse.com.vn/)
2. Truy cập phần Developer API / Lightspeed API
3. Tạo API Key và Secret Key mới
4. Copy và paste vào file `.env`

## Sử dụng

### Test Connection

Kiểm tra kết nối với DNSE API:

```bash
python dnse_service.py
```

Output mong đợi:
```
============================================================
DNSE Lightspeed API - Connection Test
============================================================

1. Checking configuration...
   ✓ API credentials configured
   API URL: https://services.entrade.com.vn/market-data/v1
   API Key: abcd123456...

2. Testing VNINDEX data...
   ✓ Successfully fetched VNINDEX data

3. Testing VN30 data...
   ✓ Successfully fetched VN30 data
============================================================
```

### Sử dụng trong Python Code

#### Import module

```python
from backend import (
    get_vnindex_data,
    get_vn30_data,
    get_stock_price,
    get_market_breadth,
    DNSEWebSocketClient
)
```

#### Lấy dữ liệu VNINDEX

```python
data = get_vnindex_data()

if data.get("success"):
    print(f"VNINDEX: {data['price']}")
    print(f"Change: {data['change']} ({data['change_percent']}%)")
else:
    print(f"Error: {data.get('error')}")
```

#### Lấy giá cổ phiếu

```python
# Một mã cổ phiếu
hpg_data = get_stock_price("HPG")

# Nhiều mã cổ phiếu cùng lúc
symbols = ["HPG", "VNM", "VCB", "VIC"]
batch_data = get_multiple_stocks(symbols)
```

#### Lấy Market Breadth

```python
breadth = get_market_breadth()

if breadth.get("success"):
    print(f"Tăng: {breadth['advancing']}")
    print(f"Giảm: {breadth['declining']}")
    print(f"Đứng giá: {breadth['unchanged']}")
```

#### Lấy dữ liệu lịch sử

```python
# Lấy dữ liệu OHLCV 30 ngày gần nhất
historical = get_historical_data(
    symbol="VNINDEX",
    from_date="2026-01-01",
    to_date="2026-01-31",
    resolution="1D"  # 1D = daily, 1H = hourly, 15 = 15min
)
```

### WebSocket (Real-time Streaming)

Để nhận dữ liệu real-time qua WebSocket:

```python
import asyncio
from backend import DNSEWebSocketClient

async def stream_market_data():
    client = DNSEWebSocketClient()

    try:
        # Kết nối
        await client.connect()

        # Subscribe các mã muốn theo dõi
        await client.subscribe(["VNINDEX", "VN30", "HPG", "VNM"])

        # Lắng nghe dữ liệu real-time
        async for message in client.listen():
            print(f"Received: {message}")

            # Xử lý message
            if message.get("type") == "price_update":
                symbol = message["symbol"]
                price = message["price"]
                print(f"{symbol}: {price}")

    except Exception as e:
        print(f"Error: {e}")

    finally:
        await client.close()

# Chạy
asyncio.run(stream_market_data())
```

## API Functions

### Market Data Functions

| Function | Description | Parameters |
|----------|-------------|------------|
| `get_market_data(symbol)` | Lấy dữ liệu thị trường cho một mã | `symbol`: Mã chỉ số/cổ phiếu |
| `get_vnindex_data()` | Lấy dữ liệu VNINDEX | None |
| `get_vn30_data()` | Lấy dữ liệu VN30 | None |
| `get_stock_price(symbol)` | Lấy giá một cổ phiếu | `symbol`: Mã cổ phiếu |
| `get_multiple_stocks(symbols)` | Lấy giá nhiều cổ phiếu | `symbols`: List các mã |
| `get_market_breadth()` | Lấy market breadth | None |
| `get_sector_data(sector)` | Lấy dữ liệu theo ngành | `sector`: Tên ngành |
| `get_foreign_flow(symbol)` | Lấy dòng tiền nước ngoài | `symbol`: Mã chỉ số/cổ phiếu |
| `get_historical_data(...)` | Lấy dữ liệu lịch sử OHLCV | `symbol`, `from_date`, `to_date`, `resolution` |

### Response Format

Tất cả functions đều trả về dictionary với format:

**Thành công:**
```json
{
    "success": true,
    "data": { ... },
    "timestamp": 1704441600000
}
```

**Lỗi:**
```json
{
    "success": false,
    "error": "Error message",
    "status_code": 404
}
```

## Tích hợp với Frontend

### Option 1: Flask REST API (Khuyến nghị)

Tạo file `backend/api_server.py`:

```python
from flask import Flask, jsonify, request
from backend import get_vnindex_data, get_stock_price

app = Flask(__name__)

@app.route('/api/vnindex')
def api_vnindex():
    data = get_vnindex_data()
    return jsonify(data)

@app.route('/api/stock/<symbol>')
def api_stock(symbol):
    data = get_stock_price(symbol)
    return jsonify(data)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
```

Từ Frontend:
```javascript
// Lấy dữ liệu VNINDEX
fetch('http://localhost:5000/api/vnindex')
    .then(response => response.json())
    .then(data => {
        console.log('VNINDEX:', data);
    });
```

### Option 2: FastAPI (Modern, Async)

```python
from fastapi import FastAPI
from backend import get_vnindex_data

app = FastAPI()

@app.get('/api/vnindex')
async def api_vnindex():
    return get_vnindex_data()
```

### Option 3: Direct Python Script

Chạy Python script định kỳ và export dữ liệu ra JSON file mà Frontend có thể đọc.

## Security Best Practices

1. **NEVER commit `.env` file** - Luôn kiểm tra `.gitignore`
2. **Use environment variables** - Không hardcode API keys trong code
3. **Backend-only API calls** - API keys chỉ được dùng ở backend
4. **Rate limiting** - Implement rate limiting để tránh vượt quota
5. **HTTPS only** - Khi deploy production, chỉ dùng HTTPS
6. **CORS configuration** - Cấu hình CORS đúng cách khi dùng với Frontend

## Troubleshooting

### Lỗi: "API credentials not configured"

**Giải pháp:**
1. Kiểm tra file `.env` có tồn tại không
2. Kiểm tra `DNSE_API_KEY` và `DNSE_SECRET_KEY` đã được điền chưa
3. Restart Python process sau khi sửa `.env`

### Lỗi: "Request timeout"

**Giải pháp:**
1. Kiểm tra kết nối internet
2. Tăng `REQUEST_TIMEOUT` trong `.env`
3. Kiểm tra DNSE API status

### Lỗi: "401 Unauthorized"

**Giải pháp:**
1. API key không đúng hoặc đã hết hạn
2. Kiểm tra lại API credentials trên DNSE portal
3. Regenerate API key nếu cần

### Lỗi: "429 Too Many Requests"

**Giải pháp:**
1. Đã vượt rate limit của DNSE API
2. Implement caching để giảm số request
3. Tăng delay giữa các request

## Development

### Running Tests

```bash
pytest tests/
```

### Code Formatting

```bash
black backend/
```

### Type Checking

```bash
mypy backend/
```

## Roadmap

- [ ] Implement caching layer (Redis)
- [ ] Add rate limiting
- [ ] Add data validation với Pydantic
- [ ] Logging cải tiến với structured logs
- [ ] Monitoring và alerting
- [ ] Docker containerization
- [ ] API documentation với Swagger/OpenAPI

## Support

Nếu gặp vấn đề:
1. Kiểm tra [DNSE API Documentation](https://lightspeed-api.dnse.com.vn/docs)
2. Kiểm tra logs trong console
3. Contact DNSE support: support@dnse.com.vn

## License

Private - Market Overview Team
